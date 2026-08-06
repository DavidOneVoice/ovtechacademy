import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../src/firebase";
import { revokeCertificate } from "../services/certificateAdministration";
import "./Admin.css";

const dateOf = (value) => value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null);
const displayDate = (value) => dateOf(value)?.toLocaleDateString() || "—";
const method = (student) => String(student.learningMethod || "Unknown").trim();
const track = (student) => String(student.track || student.course || student.courseName || "Unknown").trim();

export default function GraduatedStudents() {
  const [graduates, setGraduates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { (async () => {
    try {
      const snapshot = await getDocs(collection(db, "scholarshipApplications"));
      const students = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => String(item.status).toLowerCase() === "graduated");
      const records = await Promise.all(students.map(async (student) => {
        const profile = await getDoc(doc(db, "certificateProfile", student.id));
        return { ...student, certificateProfile: profile.exists() ? profile.data() : null };
      }));
      setGraduates(records);
    } finally { setLoading(false); }
  })(); }, []);

  const tracks = useMemo(() => [...new Set(graduates.map(track))].sort(), [graduates]);
  const methods = useMemo(() => [...new Set(graduates.map(method))].sort(), [graduates]);
  const filtered = useMemo(() => graduates.filter((student) => {
    const profile = student.certificateProfile || {};
    const needle = search.trim().toLowerCase();
    return (!needle || [student.fullName, student.email, student.certificateId, profile.certificateId].some((v) => String(v || "").toLowerCase().includes(needle)))
      && (trackFilter === "All" || track(student) === trackFilter)
      && (methodFilter === "All" || method(student) === methodFilter)
      && (visibility === "All" || (visibility === "listed") === (profile.showInAlumniDirectory === true));
  }).sort((a, b) => {
    if (sort.startsWith("name")) return String(a.fullName || "").localeCompare(String(b.fullName || "")) * (sort === "name-desc" ? -1 : 1);
    const delta = (dateOf(a.graduatedAt)?.getTime() || 0) - (dateOf(b.graduatedAt)?.getTime() || 0);
    return sort === "oldest" ? delta : -delta;
  }), [graduates, methodFilter, search, sort, trackFilter, visibility]);

  const now = new Date();
  const listed = graduates.filter((g) => g.certificateProfile?.showInAlumniDirectory === true).length;
  const month = graduates.filter((g) => { const d = dateOf(g.graduatedAt); return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  const revoke = async (event) => {
    event.preventDefault(); if (!reason.trim()) return;
    setSaving(true);
    try {
      await revokeCertificate({ studentId: revokeTarget.id, reason });
      setGraduates((items) => items.filter((item) => item.id !== revokeTarget.id));
      setRevokeTarget(null); setReason(""); setSelected(null); setToast("Certificate revoked successfully.");
    } catch (error) { console.error(error); setToast("Unable to revoke certificate. Please try again."); }
    finally { setSaving(false); }
  };

  return <main className="admin-page">
    {toast && <div className="admin-toast">{toast}</div>}
    <section className="admin-header"><div><span>Students</span><h1>Graduated Students</h1><p>Students whose certificates have been approved successfully.</p></div><div className="admin-header-actions"><a className="admin-home-btn" href="/enrolled-students">Enrolled Students</a><a className="admin-home-btn" href="/admin">Admin Dashboard</a></div></section>
    <section className="graduate-summary">
      {[['Total Graduates', graduates.length], ['Graduated This Month', month], ['Listed in Alumni Directory', listed], ['Not Listed Publicly', graduates.length - listed]].map(([label, value]) => <div className="admin-table-card" key={label}><span>{label}</span><h2>{value}</h2></div>)}
    </section>
    <section className="admin-table-card">
      <div className="admin-filters"><input placeholder="Search name, email or certificate ID" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}><option>All</option>{tracks.map((v) => <option key={v}>{v}</option>)}</select><select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}><option>All</option>{methods.map((v) => <option key={v}>{v}</option>)}</select><select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="All">All visibility</option><option value="listed">Listed publicly</option><option value="private">Not listed</option></select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest graduates</option><option value="oldest">Oldest graduates</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></div>
      {loading ? <p>Loading graduated students...</p> : <div className="admin-table-wrap"><table><thead><tr><th>Graduate</th><th>Contact</th><th>Course / Method</th><th>Completion</th><th>Certificate</th><th>Alumni</th><th>Actions</th></tr></thead><tbody>{filtered.map((student) => { const p = student.certificateProfile || {}; const id = p.certificateId || student.certificateId; return <tr key={student.id}><td data-label="Graduate"><div className="graduate-person">{p.photoUrl && <img src={p.photoUrl} alt="" />}<strong>{student.fullName || p.displayName}</strong></div></td><td data-label="Contact">{student.email}<br />{student.whatsapp || student.phone || p.phone || "—"}</td><td data-label="Course / Method">{track(student)}<br />{method(student)}</td><td data-label="Completion">{displayDate(p.completionDate || student.graduatedAt)}</td><td data-label="Certificate">{id || "—"}</td><td data-label="Alumni">{p.showInAlumniDirectory === true ? "Listed" : "Not listed"}</td><td data-label="Actions"><div className="admin-actions"><button onClick={() => setSelected(student)}>View Student</button>{id && <><a href={`/verify/${id}`} target="_blank" rel="noreferrer">View Certificate</a><a href={`/verify/${id}`} target="_blank" rel="noreferrer">Open Verification Page</a></>}<button className="admin-delete" onClick={() => setRevokeTarget(student)}>Revoke Certificate</button></div></td></tr>; })}</tbody></table>{!filtered.length && <p className="admin-empty">No graduates match your filters.</p>}</div>}
    </section>
    {selected && <div className="admin-modal-overlay"><div className="admin-modal"><button className="admin-modal-close" onClick={() => setSelected(null)}>×</button><h2>{selected.fullName}</h2><div className="admin-details-grid"><div><strong>Graduation status</strong><span>{selected.status}</span></div><div><strong>Completion date</strong><span>{displayDate(selected.certificateProfile?.completionDate || selected.graduatedAt)}</span></div><div><strong>Certificate ID</strong><span>{selected.certificateProfile?.certificateId || selected.certificateId}</span></div><div><strong>Certificate status</strong><span>{selected.certificateStatus}</span></div><div><strong>Alumni directory</strong><span>{selected.certificateProfile?.showInAlumniDirectory ? "Listed" : "Not listed"}</span></div></div><div className="admin-certificate-actions"><a href={`/verify/${selected.certificateProfile?.certificateId || selected.certificateId}`} target="_blank" rel="noreferrer">View Certificate</a><button className="admin-delete" onClick={() => setRevokeTarget(selected)}>Revoke Certificate</button></div></div></div>}
    {revokeTarget && <div className="admin-modal-overlay"><div className="admin-delete-modal admin-certificate-dialog"><h2>Revoke Certificate</h2><p>This will invalidate the student’s certificate, remove the student from the public alumni directory, return the student to the Enrolled Students list, and remove certificate access from the student dashboard.</p><form className="admin-change-form" onSubmit={revoke}><label>Reason for revocation<textarea required placeholder="Explain why this certificate is being revoked." value={reason} onChange={(e) => setReason(e.target.value)} /></label><div className="admin-delete-actions"><button type="button" disabled={saving} onClick={() => setRevokeTarget(null)}>Cancel</button><button className="admin-confirm-delete" disabled={saving || !reason.trim()}>{saving ? "Revoking certificate..." : "Confirm Revocation"}</button></div></form></div></div>}
  </main>;
}
