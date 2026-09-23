import { generateAttendance } from "../attendance/generate";
import { isLiveAttendanceStudent } from "../attendance/model";
import AdminWorkspace from "../components/AdminWorkspace";
import useAdminCohort from "../hooks/useAdminCohort";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
} from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { clearStoredAdminRole } from "../auth/adminRoles";
import { CANONICAL_PROGRAMMES, normalizeProgrammeName } from "../data/programmes";
import "./Admin.css";

const LEARNING_METHOD_FILTERS = [
  { value: "All", label: "All Learning Methods" },
  { value: "self-paced", label: "Self-Paced Pre-recorded Videos" },
  { value: "live", label: "Live Classes" },
];
const normalizeLearningMethod = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("self") || text.includes("pre-recorded") || text.includes("prerecorded") || text.includes("recorded")) return "self-paced";
  if (text.includes("live")) return "live";
  return "";
};
const getReferralCode = (application) => application.referralCode?.trim() || "DIRECT";
const getDateApplied = (application) => application.createdAt?.seconds
  ? new Date(application.createdAt.seconds * 1000).toLocaleDateString()
  : "N/A";

const AdminAssistant = () => {
  const [allRecords, setAllRecords] = useState([]);
  const cohort = useAdminCohort(allRecords);
  const applications = useMemo(() => cohort.scopedRecords.filter((item) => ["Pending", "Approved"].includes(item.status)), [cohort.scopedRecords]);
  const enrolledStudents = useMemo(() => cohort.scopedRecords.filter((item) => item.status === "Enrolled"), [cohort.scopedRecords]);
  const totalApplications = cohort.scopedRecords.length;
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
        setAllRecords(allApplications);
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
  const courseOptions = CANONICAL_PROGRAMMES;
  const referralCodes = useMemo(() => [...new Set(applications.map(getReferralCode))].sort(), [applications]);
  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    return applications.filter((application) => {
      const referralCode = getReferralCode(application);
      const matchesSearch = [application.fullName, application.email, application.whatsapp, referralCode]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "All" || application.status === statusFilter;
      const matchesTrack = trackFilter === "All" || normalizeProgrammeName(application.track) === trackFilter;
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
  const attendanceTracks = CANONICAL_PROGRAMMES;
  const liveStudentCount = (track) => enrolledStudents.filter((student) => isLiveAttendanceStudent(student, track)).length;

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
      const generated = await generateAttendance(confirmTrack, cohort.selected, enrolledStudents);
      setGeneratedSession(generated); setConfirmTrack(null);
      showToast(generated.reused ? "Today’s link is ready. No extra lecture day was added." : "Attendance link generated for " + cohort.selected.label + ".");
    } catch (error) { showToast(error.message || "Attendance could not be generated."); }
    finally { setGeneratingAttendance(false); }
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

  return <AdminWorkspace assistant cohort={{...cohort, setSelectedId: (id) => { resetFilters(); setSelectedApplication(null); setAttendanceModalOpen(false); setConfirmTrack(null); setGeneratedSession(null); cohort.setSelectedId(id); }}} title="Application overview" description="Review your cohort and support live-class attendance." onLogout={handleLogout}><main className="admin-page">
    {toast && <div className="admin-toast">{toast}</div>}

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
      {loading ? <p className="admin-loading">Loading applications...</p> : <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>WhatsApp</th><th>Course</th><th>Learning Method</th><th>Referral Code</th><th>Location</th><th>Age Range</th><th>Date Applied</th><th>Status</th><th>Details</th></tr></thead><tbody>{items.map((application) => <tr key={application.id}><td><strong>{application.fullName || "—"}</strong><small>{application.email || "—"}</small></td><td>{application.whatsapp || "—"}</td><td>{normalizeProgrammeName(application.track) || "—"}</td><td>{application.learningMethod || "—"}</td><td>{getReferralCode(application)}</td><td>{application.location || "—"}</td><td>{application.ageRange || "—"}</td><td>{getDateApplied(application)}</td><td><span className="admin-status">{application.status}</span></td><td><button type="button" onClick={() => setSelectedApplication(application)} className="admin-view-btn">View</button></td></tr>)}</tbody></table>{items.length === 0 && <p className="admin-empty">No {title.toLowerCase()} match your filters.</p>}</div>}
    </section>)}
    {selectedApplication && <div className="admin-modal-overlay"><div className="admin-modal"><button type="button" className="admin-modal-close" onClick={() => setSelectedApplication(null)}>×</button><h2>{selectedApplication.fullName || "Application details"}</h2><p className="admin-modal-email">{selectedApplication.email || "—"}</p><div className="admin-details-grid"><div><strong>WhatsApp</strong><span>{selectedApplication.whatsapp || "—"}</span></div><div><strong>Location</strong><span>{selectedApplication.location || "—"}</span></div><div><strong>Age Range</strong><span>{selectedApplication.ageRange || "—"}</span></div><div><strong>Preferred Track</strong><span>{normalizeProgrammeName(selectedApplication.track) || "—"}</span></div><div><strong>Learning Method</strong><span>{selectedApplication.learningMethod || "—"}</span></div><div><strong>Referral Source</strong><span>{selectedApplication.referral || "—"}</span></div><div><strong>Referral Code</strong><span>{getReferralCode(selectedApplication)}</span></div><div><strong>Date Applied</strong><span>{getDateApplied(selectedApplication)}</span></div><div><strong>Status</strong><span>{selectedApplication.status || "—"}</span></div></div><div className="admin-reason-box"><strong>Reason for Applying</strong><p>{selectedApplication.reason || "—"}</p></div></div></div>}
    {attendanceModalOpen && <div className="admin-modal-overlay"><div className="admin-modal admin-attendance-modal"><button className="admin-modal-close" onClick={() => setAttendanceModalOpen(false)}>×</button><h2>Generate Attendance Link</h2><p>{cohort.selected.label} cohort · Live classes only</p><p className="admin-modal-email">Choose the course holding today. Only enrolled live-class students in the selected cohort are included.</p><div className="admin-attendance-course-grid">{attendanceTracks.map((track) => <button type="button" key={track} disabled={!liveStudentCount(track)} onClick={() => setConfirmTrack(track)}><strong>{track}</strong><span>{liveStudentCount(track)} live-class students</span></button>)}</div>{attendanceTracks.length === 0 && <p className="admin-empty">No courses are available for attendance yet.</p>}{generatedSession?.cohortId === cohort.selectedId && <div className="admin-generated-link"><span>{generatedSession.track} • {generatedSession.dateKey}</span><input readOnly value={generatedSession.link} onFocus={(event) => event.target.select()} /><button type="button" onClick={() => copyAttendanceLink(generatedSession.link)}>Copy Link</button>{generatedSession.reused && <p>Today’s existing link was reused.</p>}</div>}</div></div>}
    {confirmTrack && <div className="admin-modal-overlay"><div className="admin-delete-modal"><h2>Confirm Lecture Held?</h2><p>Did <strong>{confirmTrack}</strong> hold today? This creates today’s unique attendance link.</p><div className="admin-delete-actions"><button onClick={() => setConfirmTrack(null)} className="admin-cancel-delete">No, Cancel</button><button onClick={generateAttendanceSession} className="admin-confirm-attendance" disabled={generatingAttendance}>{generatingAttendance ? "Generating..." : "Yes, Generate Link"}</button></div></div></div>}
  </main></AdminWorkspace>;
};

export default AdminAssistant;
