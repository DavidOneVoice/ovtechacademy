import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  FieldPath,
} from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { clearStoredAdminRole } from "../auth/adminRoles";
import "./Admin.css";

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const slugifyTrack = (track) => String(track || "course").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const getStudentTracks = (student) => [
  student.track,
  ...(Array.isArray(student.tracks) ? student.tracks : []),
  ...(Array.isArray(student.courses) ? student.courses : []),
  ...(Array.isArray(student.enrolledCourses) ? student.enrolledCourses : []),
].filter(Boolean);
const getDateApplied = (application) => application.createdAt?.seconds
  ? new Date(application.createdAt.seconds * 1000).toLocaleDateString()
  : "N/A";

const AdminAssistant = () => {
  const [applications, setApplications] = useState([]);
  const [totalApplications, setTotalApplications] = useState(0);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [confirmTrack, setConfirmTrack] = useState(null);
  const [generatedSession, setGeneratedSession] = useState(null);
  const [generatingAttendance, setGeneratingAttendance] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, "scholarshipApplications")));
        const allApplications = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        setTotalApplications(allApplications.length);
        setApplications(allApplications.filter((item) => ["Pending", "Approved"].includes(item.status)));
        setEnrolledStudents(allApplications.filter((item) => item.status === "Enrolled"));
      } catch {
        setToast("Unable to load applications. Please try again.");
        setTimeout(() => setToast(""), 2600);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const pendingApplications = applications.filter((item) => item.status === "Pending");
  const approvedApplications = applications.filter((item) => item.status === "Approved");
  const attendanceTracks = useMemo(() => [...new Set(
    enrolledStudents.flatMap(getStudentTracks),
  )].sort(), [enrolledStudents]);

  const copyAttendanceLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Attendance link copied successfully.");
    } catch {
      showToast("Copy failed. Please select and copy the link manually.");
    }
  };

  const generateAttendanceSession = async () => {
    if (!confirmTrack) return;
    setGeneratingAttendance(true);
    try {
      const dateKey = getTodayKey();
      const sessionId = `${slugifyTrack(confirmTrack)}-${dateKey}`;
      const sessionRef = doc(db, "attendanceSessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) {
        await setDoc(sessionRef, { track: confirmTrack, trackSlug: slugifyTrack(confirmTrack), dateKey, createdAt: serverTimestamp(), lectureCount: 1 });
        await Promise.all(enrolledStudents
          .filter((student) => getStudentTracks(student).includes(confirmTrack))
          .map((student) => updateDoc(doc(db, "scholarshipApplications", student.id), new FieldPath("attendance", confirmTrack, "lectureDays"), increment(1))));
      }
      const link = `${window.location.origin}/attendance/${sessionId}`;
      setGeneratedSession({ track: confirmTrack, dateKey, link, reused: sessionSnap.exists() });
      setConfirmTrack(null);
      showToast(sessionSnap.exists() ? "Today’s attendance link is ready." : "Attendance link generated.");
    } catch {
      showToast("Attendance link could not be generated. Please try again.");
    } finally {
      setGeneratingAttendance(false);
    }
  };

  const handleLogout = async () => {
    clearStoredAdminRole();
    if (auth) await signOut(auth);
    window.location.href = "/admin-login";
  };

  return <main className="admin-page">
    {toast && <div className="admin-toast">{toast}</div>}
    <section className="admin-header">
      <div><span>OVTech Admin Assistant</span><h1>Application Overview</h1><p>Review pending and approved course applications, or generate an attendance link.</p></div>
      <div className="admin-header-actions"><a href="/" className="admin-home-btn">Back to Website</a><button onClick={handleLogout} className="admin-logout-btn">Logout</button></div>
    </section>
    <section className="admin-stats admin-assistant-stats">
      <div><h3>{totalApplications}</h3><p>Registered Applications</p></div>
      <div><h3>{pendingApplications.length}</h3><p>Pending Approval</p></div>
      <div><h3>{approvedApplications.length}</h3><p>Approved Applications</p></div>
    </section>
    <section className="admin-table-card admin-assistant-attendance">
      <div><h2>Attendance</h2><p>Generate a course-specific attendance link for today’s class.</p></div>
      <button type="button" className="admin-attendance-main-btn" onClick={() => setAttendanceModalOpen(true)}>Generate Attendance Link</button>
    </section>
    {[["Pending Applications", pendingApplications], ["Approved Applications", approvedApplications]].map(([title, items]) => <section className="admin-table-card admin-assistant-list" key={title}>
      <h2>{title} ({items.length})</h2>
      {loading ? <p className="admin-loading">Loading applications...</p> : <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Course</th><th>Date Applied</th><th>Status</th></tr></thead><tbody>{items.map((application) => <tr key={application.id}><td>{application.fullName || "—"}</td><td>{application.email || "—"}</td><td>{application.track || "—"}</td><td>{getDateApplied(application)}</td><td><span className="admin-status">{application.status}</span></td></tr>)}</tbody></table>{items.length === 0 && <p className="admin-empty">No {title.toLowerCase()}.</p>}</div>}
    </section>)}
    {attendanceModalOpen && <div className="admin-modal-overlay"><div className="admin-modal admin-attendance-modal"><button className="admin-modal-close" onClick={() => setAttendanceModalOpen(false)}>×</button><h2>Generate Attendance Link</h2><p className="admin-modal-email">Choose the course holding today.</p><div className="admin-attendance-course-grid">{attendanceTracks.map((track) => <button type="button" key={track} onClick={() => setConfirmTrack(track)}><strong>{track}</strong></button>)}</div>{attendanceTracks.length === 0 && <p className="admin-empty">No courses are available for attendance yet.</p>}{generatedSession && <div className="admin-generated-link"><span>{generatedSession.track} • {generatedSession.dateKey}</span><input readOnly value={generatedSession.link} onFocus={(event) => event.target.select()} /><button type="button" onClick={() => copyAttendanceLink(generatedSession.link)}>Copy Link</button>{generatedSession.reused && <p>Today’s existing link was reused.</p>}</div>}</div></div>}
    {confirmTrack && <div className="admin-modal-overlay"><div className="admin-delete-modal"><h2>Confirm Lecture Held?</h2><p>Did <strong>{confirmTrack}</strong> hold today? This creates today’s unique attendance link.</p><div className="admin-delete-actions"><button onClick={() => setConfirmTrack(null)} className="admin-cancel-delete">No, Cancel</button><button onClick={generateAttendanceSession} className="admin-confirm-attendance" disabled={generatingAttendance}>{generatingAttendance ? "Generating..." : "Yes, Generate Link"}</button></div></div></div>}
  </main>;
};

export default AdminAssistant;
