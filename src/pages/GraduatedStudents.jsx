import { recordCohortId } from "../data/cohort";
import AdminWorkspace from "../components/AdminWorkspace";
import AssessmentReviewSummary from "../components/AssessmentReviewSummary";
import useAdminCohort from "../hooks/useAdminCohort";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../src/firebase";
import { getProgressId } from "../lms/progress";
import { revokeApprovedCertificate } from "../services/certificateAdministration";
import "./Admin.css";
import "./GraduatedStudents.css";
import { normalizeProgrammeName } from "../data/programmes";
import { attendanceStats } from "../attendance/model";
import { isFinalAssessmentStudent } from "../lms/finalAssessment";

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
const getCourse = (graduate) => normalizeProgrammeName(graduate.profile.course || graduate.profile.track || graduate.application.track || "");
const getMethod = (graduate) => graduate.application.learningMethod || graduate.profile.learningMethod || "";

const attendanceText = (application) => {
  if (!Object.keys(application.attendance || {}).some((track) =>
    normalizeProgrammeName(track) === normalizeProgrammeName(application.track))) return "Not available";
  const stats = attendanceStats(application, application.track);
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
  const [allGraduates, setGraduates] = useState([]);
  const cohort = useAdminCohort(allGraduates);
  const graduates = cohort.scopedRecords;
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
        .map((item) => ({ id: item.id, cohortId: recordCohortId(applications.get(item.id)), profile: item.data(), application: applications.get(item.id) }));
      setGraduates(joined);
    } catch (firebaseError) {
      if (import.meta.env.DEV) console.error("Unable to load graduated students:", firebaseError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraduates(); }, [loadGraduates]);

  const courseOptions = useMemo(() => [...new Set(graduates.map((graduate) => normalizeProgrammeName(getCourse(graduate))).filter(Boolean))].sort(), [graduates]);
  const methodOptions = useMemo(() => [...new Set(graduates.map(getMethod).filter(Boolean))].sort(), [graduates]);
  const visibleGraduates = useMemo(() => {
    const term = normalized(search);
    return graduates.filter((graduate) => {
      const matchesSearch = !term || [getName(graduate), getEmail(graduate), getPhone(graduate), graduate.profile.certificateId]
        .some((value) => normalized(value).includes(term));
      return matchesSearch &&
        (courseFilter === "All" || normalizeProgrammeName(getCourse(graduate)) === courseFilter) &&
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

  const hasFilters = search || courseFilter !== "All" || methodFilter !== "All" || alumniFilter !== "All";
  const resetFilters = () => {
    setSearch("");
    setCourseFilter("All");
    setMethodFilter("All");
    setAlumniFilter("All");
  };
  const changeCohort = (id) => {
    setSelected(null);
    setRevocationTarget(null);
    resetFilters();
    cohort.setSelectedId(id);
  };

  return (
    <AdminWorkspace cohort={{ ...cohort, setSelectedId: changeCohort }} title="Graduates" description="Manage certificates and alumni visibility for each cohort.">
      <main className="admin-page graduates-page">
        {toast && <div className="admin-toast" role="status">{toast}</div>}

        {!loading && !error && (
          <section className="graduate-summary" aria-label="Graduate summary">
            <article><span>Total graduates</span><strong>{summary.total}</strong><small>Approved certificates</small></article>
            <article><span>Completed this month</span><strong>{summary.thisMonth}</strong><small>Across the selected cohort</small></article>
            <article><span>Public alumni profiles</span><strong>{summary.listed}</strong><small>Visible in the alumni directory</small></article>
            <article><span>Private profiles</span><strong>{summary.private}</strong><small>Not listed in the directory</small></article>
          </section>
        )}

        <section className="admin-table-card graduate-directory" aria-labelledby="graduate-directory-title">
          <div className="admin-table-heading">
            <div><h2 id="graduate-directory-title">Graduate directory</h2><p>Students with an approved certificate profile.</p></div>
            {!loading && !error && <span className="graduate-total">{graduates.length} {graduates.length === 1 ? "graduate" : "graduates"}</span>}
          </div>
          <div className="graduate-filters">
            <label className="graduate-search"><span>Search graduates</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone or certificate ID" /></label>
            <label><span>Course / track</span><select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}><option value="All">All courses</option>{courseOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>Learning method</span><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="All">All methods</option>{methodOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>Alumni visibility</span><select value={alumniFilter} onChange={(event) => setAlumniFilter(event.target.value)}><option value="All">All profiles</option><option value="listed">Listed publicly</option><option value="private">Not listed publicly</option></select></label>
            <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest graduates</option><option value="oldest">Oldest graduates</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label>
          </div>
          {!loading && !error && graduates.length > 0 && (
            <div className="graduate-results">
              <span aria-live="polite">Showing {visibleGraduates.length} of {graduates.length} graduates</span>
              {hasFilters && <button type="button" onClick={resetFilters}>Clear filters</button>}
            </div>
          )}

          {loading && <div className="graduate-state" role="status"><span className="graduate-loading-indicator" aria-hidden="true" /><p>Loading graduated students…</p></div>}
          {error && <div className="graduate-state" role="alert"><h3>We couldn’t load the directory</h3><p>Please try again to see this cohort’s graduates.</p><button type="button" className="admin-view-btn" onClick={loadGraduates}>Try again</button></div>}
          {!loading && !error && graduates.length === 0 && <div className="graduate-state"><h3>No graduates in this cohort yet</h3><p>Students appear here after their certificate profiles are approved.</p></div>}
          {!loading && !error && graduates.length > 0 && visibleGraduates.length === 0 && <div className="graduate-state"><h3>No matching graduates</h3><p>Try another name or adjust your filters.</p><button type="button" className="admin-view-btn" onClick={resetFilters}>Clear filters</button></div>}
          {!loading && !error && visibleGraduates.length > 0 && (
            <div className="admin-table-wrap graduate-table" tabIndex={0} role="region" aria-label="Graduate directory table">
              <table>
                <thead><tr><th scope="col">Graduate</th><th scope="col">Contact</th><th scope="col">Course / track</th><th scope="col">Method</th><th scope="col">Completion</th><th scope="col">Certificate ID</th><th scope="col">Alumni</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {visibleGraduates.map((graduate) => (
                    <tr key={graduate.id}>
                      <td data-label="Graduate"><div className="graduate-person">{graduate.profile.photoUrl ? <img src={graduate.profile.photoUrl} alt={`${getName(graduate)} professional profile`} loading="lazy" /> : <span className="graduate-avatar" aria-hidden="true">{getName(graduate).charAt(0)}</span>}<strong>{getName(graduate)}</strong></div></td>
                      <td data-label="Contact"><span className="graduate-contact">{textValue(getEmail(graduate))}<small>{textValue(getPhone(graduate))}</small></span></td>
                      <td data-label="Course / track">{textValue(getCourse(graduate))}</td>
                      <td data-label="Method">{textValue(getMethod(graduate))}</td>
                      <td data-label="Completion">{formatDate(graduate.profile.completionDate)}</td>
                      <td data-label="Certificate ID"><code>{textValue(graduate.profile.certificateId)}</code></td>
                      <td data-label="Alumni"><span className={`graduate-status ${isListed(graduate) ? "listed" : "private"}`}>{isListed(graduate) ? "Listed publicly" : "Private profile"}</span></td>
                      <td data-label="Actions"><div className="graduate-actions"><button type="button" className="admin-view-btn" onClick={() => openDetails(graduate)}>View student</button>{graduate.profile.certificateId && <a href={certificateLink(graduate)} target="_blank" rel="noreferrer noopener">View certificate <span aria-hidden="true">↗</span></a>}<button type="button" className="admin-delete" onClick={() => showRevoke(graduate)}>Revoke certificate</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <div className="admin-modal-overlay">
            <div className="admin-modal graduate-modal" role="dialog" aria-modal="true" aria-labelledby="graduate-details-title">
              <button type="button" className="admin-modal-close" aria-label="Close graduate details" onClick={() => setSelected(null)}>×</button>
              <span className="graduate-modal-eyebrow">Graduate profile</span>
              <h2 id="graduate-details-title">{getName(selected)}</h2>
              <p className="admin-modal-email">{textValue(getEmail(selected))}</p>
              <div className="admin-details-grid">
                <div><strong>Phone / WhatsApp</strong><span>{textValue(getPhone(selected))}</span></div>
                <div><strong>Course / track</strong><span>{textValue(getCourse(selected))}</span></div>
                <div><strong>Learning method</strong><span>{textValue(getMethod(selected))}</span></div>
                <div><strong>Certificate status</strong><span>{textValue(selected.profile.status)}</span></div>
                <div><strong>Completion date</strong><span>{formatDate(selected.profile.completionDate)}</span></div>
                <div><strong>Certificate ID</strong><span>{textValue(selected.profile.certificateId)}</span></div>
                <div><strong>Alumni visibility</strong><span>{isListed(selected) ? "Listed publicly" : "Not listed publicly"}</span></div>
                <div><strong>Submitted date</strong><span>{formatDate(selected.profile.submittedAt || selected.application.createdAt)}</span></div>
                <div><strong>Attendance</strong><span>{attendanceText(selected.application)}</span></div>
                <div><strong>Progress</strong><span>{detailsLoading ? "Loading…" : progressText(progress)}</span></div>
              </div>
              {isFinalAssessmentStudent(selected.application) && <AssessmentReviewSummary key={selected.id} student={{ ...selected.application, id: selected.id, cohortId: selected.cohortId }} />}
              <div className="admin-certificate-actions">{selected.profile.certificateId && <a className="admin-certificate-link" href={certificateLink(selected)} target="_blank" rel="noreferrer noopener">View certificate <span aria-hidden="true">↗</span></a>}<button type="button" className="secondary" onClick={() => showRevoke(selected)}>Revoke certificate</button></div>
            </div>
          </div>
        )}

        {revocationTarget && (
          <div className="admin-modal-overlay">
            <div className="admin-delete-modal admin-certificate-dialog" role="dialog" aria-modal="true" aria-labelledby="graduate-revocation-title">
              <span className="graduate-modal-eyebrow">Certificate management</span>
              <h2 id="graduate-revocation-title">Revoke certificate</h2>
              <p className="graduate-revocation-note">This will revoke the approved certificate for <strong>{getName(revocationTarget)}</strong>.</p>
              <form onSubmit={revokeCertificate} className="admin-change-form">
                <label>Reason for revocation<textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this certificate is being revoked." /></label>
                <div className="admin-delete-actions"><button type="button" className="admin-cancel-delete" disabled={saving} onClick={() => setRevocationTarget(null)}>Cancel</button><button type="submit" className="admin-confirm-delete" disabled={saving || !reason.trim()}>{saving ? "Revoking certificate…" : "Revoke certificate"}</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminWorkspace>
  );
};

export default GraduatedStudents;
