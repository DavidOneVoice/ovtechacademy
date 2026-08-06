import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../src/firebase";
import { getProgressId } from "../lms/progress";
import { revokeApprovedCertificate } from "../services/certificateAdministration";
import "./Admin.css";
import "./GraduatedStudents.css";

const normalized = (value) => String(value || "").trim().toLowerCase();

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : value.toDate ? value.toDate() :
    value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => toDate(value)?.toLocaleDateString() || "—";
const textValue = (value) => String(value || "").trim() || "—";
const isListed = (graduate) => graduate.profile.showInAlumniDirectory === true;
const getName = (graduate) => graduate.profile.displayName || graduate.application.fullName || "Unnamed student";
const getEmail = (graduate) => graduate.application.email || graduate.profile.email || graduate.profile.professionalEmail || "";
const getPhone = (graduate) => graduate.application.whatsapp || graduate.application.phone || graduate.profile.phone || graduate.profile.whatsapp || "";
const getCourse = (graduate) => graduate.profile.course || graduate.profile.track || graduate.application.track || "";
const getMethod = (graduate) => graduate.application.learningMethod || graduate.profile.learningMethod || "";

const attendanceText = (application) => {
  const stats = application.attendance?.[application.track];
  if (!stats) return "Not available";
  const attended = Number(stats.attendedDays || 0);
  const held = Number(stats.lectureDays || 0);
  return `${attended} of ${held} classes${held ? ` (${Math.round((attended / held) * 100)}%)` : ""}`;
};

const progressText = (progress) => {
  if (!progress) return "Not available";
  if (Number.isFinite(progress.progressPercentage)) return `${Math.round(progress.progressPercentage)}%`;
  return `${progress.completedLessonIds?.length || 0} lessons completed`;
};

const GraduatedStudents = () => {
  const [graduates, setGraduates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [alumniFilter, setAlumniFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [revocationTarget, setRevocationTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const loadGraduates = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [applicationSnapshot, profileSnapshot] = await Promise.all([
        getDocs(collection(db, "scholarshipApplications")),
        getDocs(collection(db, "certificateProfile")),
      ]);
      const applications = new Map(applicationSnapshot.docs.map((item) => [item.id, item.data()]));
      const joined = profileSnapshot.docs
        .filter((item) => normalized(item.data().status) === "approved" && applications.has(item.id))
        .map((item) => ({ id: item.id, profile: item.data(), application: applications.get(item.id) }));
      setGraduates(joined);
    } catch (firebaseError) {
      if (import.meta.env.DEV) console.error("Unable to load graduated students:", firebaseError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraduates(); }, [loadGraduates]);

  const courseOptions = useMemo(() => [...new Set(graduates.map(getCourse).filter(Boolean))].sort(), [graduates]);
  const methodOptions = useMemo(() => [...new Set(graduates.map(getMethod).filter(Boolean))].sort(), [graduates]);
  const visibleGraduates = useMemo(() => {
    const term = normalized(search);
    return graduates.filter((graduate) => {
      const matchesSearch = !term || [getName(graduate), getEmail(graduate), getPhone(graduate), graduate.profile.certificateId]
        .some((value) => normalized(value).includes(term));
      return matchesSearch &&
        (courseFilter === "All" || getCourse(graduate) === courseFilter) &&
        (methodFilter === "All" || getMethod(graduate) === methodFilter) &&
        (alumniFilter === "All" || (alumniFilter === "listed") === isListed(graduate));
    }).sort((a, b) => {
      if (sort === "name-asc" || sort === "name-desc") {
        const result = getName(a).localeCompare(getName(b), undefined, { sensitivity: "base" });
        return sort === "name-asc" ? result : -result;
      }
      const aTime = toDate(a.profile.completionDate)?.getTime() || 0;
      const bTime = toDate(b.profile.completionDate)?.getTime() || 0;
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [graduates, search, courseFilter, methodFilter, alumniFilter, sort]);

  const summary = useMemo(() => {
    const now = new Date();
    return {
      total: graduates.length,
      thisMonth: graduates.filter(({ profile }) => {
        const date = toDate(profile.completionDate);
        return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length,
      listed: graduates.filter(isListed).length,
      private: graduates.filter((graduate) => !isListed(graduate)).length,
    };
  }, [graduates]);

  const openDetails = async (graduate) => {
    setSelected(graduate);
    setProgress(null);
    setDetailsLoading(true);
    try {
      const progressId = getProgressId({ id: graduate.id, ...graduate.application });
      const [current, legacy] = await Promise.all([
        getDoc(doc(db, "progress", progressId)),
        getDoc(doc(db, "studentProgress", progressId)),
      ]);
      setProgress(current.exists() ? current.data() : legacy.exists() ? legacy.data() : null);
    } catch (firebaseError) {
      if (import.meta.env.DEV) console.error("Unable to load graduate progress:", firebaseError);
    } finally { setDetailsLoading(false); }
  };

  const revokeCertificate = async (event) => {
    event.preventDefault();
    const revocationReason = reason.trim();
    if (!revocationTarget || !revocationReason) return;
    setSaving(true);
    try {
      await revokeApprovedCertificate({ db, studentId: revocationTarget.id, reason: revocationReason });
      setGraduates((items) => items.filter((item) => item.id !== revocationTarget.id));
      setSelected((current) => current?.id === revocationTarget.id ? null : current);
      setRevocationTarget(null);
      setReason("");
      setToast("Certificate revoked successfully.");
      setTimeout(() => setToast(""), 2600);
    } catch (firebaseError) {
      if (import.meta.env.DEV) console.error("Certificate revocation failed:", firebaseError);
      setToast("Unable to revoke certificate. Please try again.");
    } finally { setSaving(false); }
  };

  const certificateLink = (graduate) => `/verify/${encodeURIComponent(graduate.profile.certificateId)}`;
  const showRevoke = (graduate) => { setRevocationTarget(graduate); setReason(""); };

  return <main className="admin-page graduates-page">
    {toast && <div className="admin-toast">{toast}</div>}
    <section className="admin-header"><div><span>OVTech Admin</span><h1>Graduated Students</h1><p>Manage approved certificate holders and their public alumni visibility.</p></div><div className="admin-header-actions"><a href="/admin" className="admin-home-btn">Admin Dashboard</a><a href="/enrolled-students" className="admin-home-btn">Enrolled Students</a></div></section>

    {!loading && !error && <section className="graduate-summary" aria-label="Graduate summary">
      <article><span>Total Graduates</span><strong>{summary.total}</strong></article>
      <article><span>Graduated This Month</span><strong>{summary.thisMonth}</strong></article>
      <article><span>Listed in Alumni Directory</span><strong>{summary.listed}</strong></article>
      <article><span>Not Listed Publicly</span><strong>{summary.private}</strong></article>
    </section>}

    <section className="admin-table-card">
      <div className="admin-table-heading"><div><h2>Graduate Directory</h2><p>Graduation is based on approved certificate profiles.</p></div></div>
      <div className="graduate-filters">
        <label className="graduate-search"><span>Search graduates</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone or certificate ID" /></label>
        <label><span>Course / track</span><select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}><option value="All">All courses</option>{courseOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label><span>Learning method</span><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="All">All methods</option>{methodOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label><span>Alumni visibility</span><select value={alumniFilter} onChange={(event) => setAlumniFilter(event.target.value)}><option value="All">All</option><option value="listed">Listed publicly</option><option value="private">Not listed publicly</option></select></label>
        <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest graduates</option><option value="oldest">Oldest graduates</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label>
      </div>

      {loading && <p className="admin-loading">Loading graduated students...</p>}
      {error && <div className="graduate-state"><p>Unable to load graduated students.</p><button type="button" className="admin-view-btn" onClick={loadGraduates}>Retry</button></div>}
      {!loading && !error && graduates.length === 0 && <p className="admin-empty">No graduated students yet.</p>}
      {!loading && !error && graduates.length > 0 && visibleGraduates.length === 0 && <p className="admin-empty">No graduates match your search or filters.</p>}
      {!loading && !error && visibleGraduates.length > 0 && <div className="admin-table-wrap graduate-table"><table><thead><tr><th>Graduate</th><th>Contact</th><th>Course / Track</th><th>Method</th><th>Completion</th><th>Certificate ID</th><th>Alumni</th><th>Actions</th></tr></thead><tbody>
        {visibleGraduates.map((graduate) => <tr key={graduate.id}>
          <td data-label="Graduate"><div className="graduate-person">{graduate.profile.photoUrl ? <img src={graduate.profile.photoUrl} alt={`${getName(graduate)} professional profile`} /> : <span className="graduate-avatar" aria-hidden="true">{getName(graduate).charAt(0)}</span>}<strong>{getName(graduate)}</strong></div></td>
          <td data-label="Contact"><span className="graduate-contact">{textValue(getEmail(graduate))}<small>{textValue(getPhone(graduate))}</small></span></td>
          <td data-label="Course / Track">{textValue(getCourse(graduate))}</td><td data-label="Method">{textValue(getMethod(graduate))}</td><td data-label="Completion">{formatDate(graduate.profile.completionDate)}</td><td data-label="Certificate ID"><code>{textValue(graduate.profile.certificateId)}</code></td><td data-label="Alumni"><span className={`graduate-status ${isListed(graduate) ? "listed" : "private"}`}>{isListed(graduate) ? "Listed publicly" : "Not listed publicly"}</span></td>
          <td data-label="Actions"><div className="graduate-actions"><button className="admin-view-btn" onClick={() => openDetails(graduate)}>View Student</button>{graduate.profile.certificateId && <a href={certificateLink(graduate)} target="_blank" rel="noreferrer">View Certificate</a>}<button className="admin-delete" onClick={() => showRevoke(graduate)}>Revoke Certificate</button></div></td>
        </tr>)}</tbody></table></div>}
    </section>

    {selected && <div className="admin-modal-overlay"><div className="admin-modal graduate-modal"><button className="admin-modal-close" onClick={() => setSelected(null)}>×</button><h2>{getName(selected)}</h2><p className="admin-modal-email">{textValue(getEmail(selected))}</p><div className="admin-details-grid">
      <div><strong>Phone / WhatsApp</strong><span>{textValue(getPhone(selected))}</span></div><div><strong>Course / Track</strong><span>{textValue(getCourse(selected))}</span></div><div><strong>Learning Method</strong><span>{textValue(getMethod(selected))}</span></div><div><strong>Certificate Status</strong><span>{textValue(selected.profile.status)}</span></div><div><strong>Completion Date</strong><span>{formatDate(selected.profile.completionDate)}</span></div><div><strong>Certificate ID</strong><span>{textValue(selected.profile.certificateId)}</span></div><div><strong>Alumni Visibility</strong><span>{isListed(selected) ? "Listed publicly" : "Not listed publicly"}</span></div><div><strong>Submitted Date</strong><span>{formatDate(selected.profile.submittedAt || selected.application.createdAt)}</span></div><div><strong>Attendance</strong><span>{attendanceText(selected.application)}</span></div><div><strong>Progress</strong><span>{detailsLoading ? "Loading..." : progressText(progress)}</span></div>
    </div><div className="admin-certificate-actions">{selected.profile.certificateId && <a className="admin-certificate-link" href={certificateLink(selected)} target="_blank" rel="noreferrer">View Certificate</a>}<button type="button" className="secondary" onClick={() => showRevoke(selected)}>Revoke Certificate</button></div></div></div>}

    {revocationTarget && <div className="admin-modal-overlay"><div className="admin-delete-modal admin-certificate-dialog"><h2>Revoke Certificate</h2><form onSubmit={revokeCertificate} className="admin-change-form"><label>Reason for revocation<textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this certificate is being revoked." /></label><div className="admin-delete-actions"><button type="button" className="admin-cancel-delete" disabled={saving} onClick={() => setRevocationTarget(null)}>Cancel</button><button type="submit" className="admin-confirm-delete" disabled={saving || !reason.trim()}>{saving ? "Revoking certificate..." : "Confirm Revocation"}</button></div></form></div></div>}
  </main>;
};

export default GraduatedStudents;
