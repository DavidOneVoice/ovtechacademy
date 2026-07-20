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
import courses from "../data/courses";
import "./Admin.css";

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const LEARNING_METHOD_FILTERS = [
  { value: "All", label: "All Learning Methods" },
  { value: "self-paced", label: "Self-Paced Pre-recorded Videos" },
  { value: "live", label: "Live Classes" },
];
const slugifyTrack = (track) => String(track || "course").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const normalizeLearningMethod = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("self") || text.includes("pre-recorded") || text.includes("prerecorded") || text.includes("recorded")) return "self-paced";
  if (text.includes("live")) return "live";
  return "";
};
const getReferralCode = (application) => application.referralCode?.trim() || "DIRECT";
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
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [trackFilter, setTrackFilter] = useState("All");
  const [learningMethodFilter, setLearningMethodFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [referralFilter, setReferralFilter] = useState("All");

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
  const courseOptions = useMemo(() => [...new Set([
    ...courses.map((course) => course.title),
    ...applications.map((application) => application.track),
  ].filter(Boolean))].sort(), [applications]);
  const referralCodes = useMemo(() => [...new Set(applications.map(getReferralCode))].sort(), [applications]);
  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    return applications.filter((application) => {
      const referralCode = getReferralCode(application);
      const matchesSearch = [application.fullName, application.email, application.whatsapp, referralCode]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "All" || application.status === statusFilter;
      const matchesTrack = trackFilter === "All" || application.track === trackFilter;
      const matchesLearningMethod = learningMethodFilter === "All" || normalizeLearningMethod(application.learningMethod) === learningMethodFilter;
      const matchesReferral = referralFilter === "All" || referralCode === referralFilter;
      const applicationDate = application.createdAt?.seconds
        ? new Date(application.createdAt.seconds * 1000) : null;
      const matchesMonth = monthFilter === "All" || !applicationDate || applicationDate.getMonth() + 1 === Number(monthFilter);
      const rangeStart = startDate ? new Date(startDate) : null;
      const rangeEnd = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
      const matchesDateRange = !applicationDate || (
        (!rangeStart || applicationDate >= rangeStart) && (!rangeEnd || applicationDate <= rangeEnd)
      );

      return matchesSearch && matchesStatus && matchesTrack && matchesLearningMethod && matchesReferral && matchesMonth && matchesDateRange;
    });
  }, [applications, endDate, learningMethodFilter, monthFilter, referralFilter, searchTerm, startDate, statusFilter, trackFilter]);
  const filteredPendingApplications = filteredApplications.filter((item) => item.status === "Pending");
  const filteredApprovedApplications = filteredApplications.filter((item) => item.status === "Approved");
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

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setTrackFilter("All");
    setLearningMethodFilter("All");
    setMonthFilter("All");
    setStartDate("");
    setEndDate("");
    setReferralFilter("All");
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
    <section className="admin-filter-panel" aria-label="Application filters">
      <div className="admin-section-heading"><h2>Find Applications</h2><p>Search and narrow the pending and approved applications shown below.</p></div>
      <div className="admin-filters">
        <input type="search" aria-label="Search applications" placeholder="Search name, email, phone or referral code..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All Statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option></select>
        <select aria-label="Filter by course" value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}><option value="All">All Courses</option>{courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}</select>
        <select aria-label="Filter by learning method" value={learningMethodFilter} onChange={(event) => setLearningMethodFilter(event.target.value)}>{LEARNING_METHOD_FILTERS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select>
        <select aria-label="Filter by month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="All">All Months</option>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
        <input type="date" aria-label="Applied on or after" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <input type="date" aria-label="Applied on or before" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <select aria-label="Filter by referral code" value={referralFilter} onChange={(event) => setReferralFilter(event.target.value)}><option value="All">All Referral Codes</option>{referralCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select>
      </div>
      <div className="admin-filter-actions"><button type="button" onClick={resetFilters} className="admin-reset-btn">Reset Filters</button></div>
    </section>
    {[["Pending Applications", filteredPendingApplications], ["Approved Applications", filteredApprovedApplications]].map(([title, items]) => <section className="admin-table-card admin-assistant-list" key={title}>
      <h2>{title} ({items.length})</h2>
      {loading ? <p className="admin-loading">Loading applications...</p> : <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>WhatsApp</th><th>Course</th><th>Learning Method</th><th>Referral Code</th><th>Location</th><th>Age Range</th><th>Date Applied</th><th>Status</th><th>Details</th></tr></thead><tbody>{items.map((application) => <tr key={application.id}><td><strong>{application.fullName || "—"}</strong><small>{application.email || "—"}</small></td><td>{application.whatsapp || "—"}</td><td>{application.track || "—"}</td><td>{application.learningMethod || "—"}</td><td>{getReferralCode(application)}</td><td>{application.location || "—"}</td><td>{application.ageRange || "—"}</td><td>{getDateApplied(application)}</td><td><span className="admin-status">{application.status}</span></td><td><button type="button" onClick={() => setSelectedApplication(application)} className="admin-view-btn">View</button></td></tr>)}</tbody></table>{items.length === 0 && <p className="admin-empty">No {title.toLowerCase()} match your filters.</p>}</div>}
    </section>)}
    {selectedApplication && <div className="admin-modal-overlay"><div className="admin-modal"><button type="button" className="admin-modal-close" onClick={() => setSelectedApplication(null)}>×</button><h2>{selectedApplication.fullName || "Application details"}</h2><p className="admin-modal-email">{selectedApplication.email || "—"}</p><div className="admin-details-grid"><div><strong>WhatsApp</strong><span>{selectedApplication.whatsapp || "—"}</span></div><div><strong>Location</strong><span>{selectedApplication.location || "—"}</span></div><div><strong>Age Range</strong><span>{selectedApplication.ageRange || "—"}</span></div><div><strong>Preferred Track</strong><span>{selectedApplication.track || "—"}</span></div><div><strong>Learning Method</strong><span>{selectedApplication.learningMethod || "—"}</span></div><div><strong>Referral Source</strong><span>{selectedApplication.referral || "—"}</span></div><div><strong>Referral Code</strong><span>{getReferralCode(selectedApplication)}</span></div><div><strong>Date Applied</strong><span>{getDateApplied(selectedApplication)}</span></div><div><strong>Status</strong><span>{selectedApplication.status || "—"}</span></div></div><div className="admin-reason-box"><strong>Reason for Applying</strong><p>{selectedApplication.reason || "—"}</p></div></div></div>}
    {attendanceModalOpen && <div className="admin-modal-overlay"><div className="admin-modal admin-attendance-modal"><button className="admin-modal-close" onClick={() => setAttendanceModalOpen(false)}>×</button><h2>Generate Attendance Link</h2><p className="admin-modal-email">Choose the course holding today.</p><div className="admin-attendance-course-grid">{attendanceTracks.map((track) => <button type="button" key={track} onClick={() => setConfirmTrack(track)}><strong>{track}</strong></button>)}</div>{attendanceTracks.length === 0 && <p className="admin-empty">No courses are available for attendance yet.</p>}{generatedSession && <div className="admin-generated-link"><span>{generatedSession.track} • {generatedSession.dateKey}</span><input readOnly value={generatedSession.link} onFocus={(event) => event.target.select()} /><button type="button" onClick={() => copyAttendanceLink(generatedSession.link)}>Copy Link</button>{generatedSession.reused && <p>Today’s existing link was reused.</p>}</div>}</div></div>}
    {confirmTrack && <div className="admin-modal-overlay"><div className="admin-delete-modal"><h2>Confirm Lecture Held?</h2><p>Did <strong>{confirmTrack}</strong> hold today? This creates today’s unique attendance link.</p><div className="admin-delete-actions"><button onClick={() => setConfirmTrack(null)} className="admin-cancel-delete">No, Cancel</button><button onClick={generateAttendanceSession} className="admin-confirm-attendance" disabled={generatingAttendance}>{generatingAttendance ? "Generating..." : "Yes, Generate Link"}</button></div></div></div>}
  </main>;
};

export default AdminAssistant;
