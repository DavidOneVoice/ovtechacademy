import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import { auth, db } from "../src/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import emailjs from "@emailjs/browser";
import { pricing } from "../data/pricing";
import courses from "../data/courses";

const DEFAULT_COMMISSION = 2500;
const LEARNING_METHOD_FILTERS = [
  { value: "All", label: "All Learning Methods" },
  { value: "self-paced", label: "Self-Paced Pre-recorded Videos" },
  { value: "live", label: "Live Classes" },
];

const normalizeLearningMethod = (value) => {
  const text = String(value || "").toLowerCase();
  if (
    text.includes("self") ||
    text.includes("pre-recorded") ||
    text.includes("prerecorded") ||
    text.includes("recorded")
  ) return "self-paced";
  if (text.includes("live")) return "live";
  return "";
};

const getReferralCode = (app) => app.referralCode?.trim() || "DIRECT";

const getDateApplied = (app) =>
  app.createdAt?.seconds
    ? new Date(app.createdAt.seconds * 1000).toLocaleDateString()
    : "N/A";

const formatCurrency = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

const isEnrolled = (app) =>
  app.status === "Enrolled" || app.paymentStatus === "Paid";

const csvEscape = (item) => `"${String(item || "").replace(/"/g, '""')}"`;

const downloadCSV = (filename, rows) => {
  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

const getApplicationCSVRows = (apps) => {
  const headers = [
    "Full Name",
    "Email",
    "WhatsApp",
    "Location",
    "Age Range",
    "Track",
    "Learning Method",
    "Referral Source",
    "Referral Code",
    "Reason",
    "Status",
    "Payment Status",
    "Date Applied",
  ];

  const rows = apps.map((app) => [
    app.fullName,
    app.email,
    app.whatsapp,
    app.location,
    app.ageRange,
    app.track,
    app.learningMethod,
    app.referral,
    getReferralCode(app),
    app.reason,
    app.status,
    app.paymentStatus,
    getDateApplied(app),
  ]);

  return [headers, ...rows];
};

const Admin = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [trackFilter, setTrackFilter] = useState("All");
  const [learningMethodFilter, setLearningMethodFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [referralFilter, setReferralFilter] = useState("All");
  const [commissionPerStudent, setCommissionPerStudent] = useState(DEFAULT_COMMISSION);
  const [toast, setToast] = useState("");
  const [enrollingId, setEnrollingId] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "scholarshipApplications"),
          orderBy("createdAt", "desc"),
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setApplications(data);
        setLoadError("");
      } catch {
        setLoadError("Unable to load applications. Please log out and sign in again with the Firebase admin account.");
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  const courseOptions = useMemo(() => [
    ...new Set([
      ...courses.map((course) => course.title),
      ...applications.map((app) => app.track),
    ].filter(Boolean)),
  ].sort(), [applications]);

  const referralCodes = useMemo(
    () => [...new Set(applications.map(getReferralCode))].sort(),
    [applications],
  );

  const referralSummaries = useMemo(() => {
    const summaryMap = applications.reduce((acc, app) => {
      const code = getReferralCode(app);
      if (!acc[code]) {
        acc[code] = {
          code,
          applications: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          enrolled: 0,
          students: [],
        };
      }

      acc[code].applications += 1;
      acc[code].students.push(app);

      if (app.status === "Pending") acc[code].pending += 1;
      if (app.status === "Approved") acc[code].approved += 1;
      if (app.status === "Rejected") acc[code].rejected += 1;
      if (isEnrolled(app)) acc[code].enrolled += 1;

      return acc;
    }, {});

    return Object.values(summaryMap)
      .map((summary) => ({
        ...summary,
        commission: summary.enrolled * Number(commissionPerStudent || 0),
        approvalRate: summary.applications
          ? Math.round((summary.approved / summary.applications) * 100)
          : 0,
        enrollmentRate: summary.applications
          ? Math.round((summary.enrolled / summary.applications) * 100)
          : 0,
      }))
      .sort((a, b) => b.applications - a.applications || a.code.localeCompare(b.code));
  }, [applications, commissionPerStudent]);

  const topReferrer = useMemo(
    () => [...referralSummaries].sort((a, b) => b.enrolled - a.enrolled)[0],
    [referralSummaries],
  );

  const totalCommission = referralSummaries.reduce(
    (sum, summary) => sum + summary.commission,
    0,
  );

  const selectedReferralSummary = referralSummaries.find(
    (summary) => summary.code === selectedReferral,
  );

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    return applications.filter((app) => {
      const code = getReferralCode(app);
      const matchesReferral = referralFilter === "All" || code === referralFilter;
      const matchesSearch =
        app.fullName?.toLowerCase().includes(normalizedSearch) ||
        app.email?.toLowerCase().includes(normalizedSearch) ||
        app.whatsapp?.includes(searchTerm) ||
        code.toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "All" || app.status === statusFilter;
      const matchesTrack = trackFilter === "All" || app.track === trackFilter;
      const matchesLearningMethod =
        learningMethodFilter === "All" ||
        normalizeLearningMethod(app.learningMethod) === learningMethodFilter;

      let matchesMonth = true;
      if (monthFilter !== "All" && app.createdAt?.seconds) {
        matchesMonth =
          new Date(app.createdAt.seconds * 1000).getMonth() + 1 === Number(monthFilter);
      }

      let matchesDateRange = true;
      if (app.createdAt?.seconds) {
        const appDate = new Date(app.createdAt.seconds * 1000);
        if (startDate) matchesDateRange = matchesDateRange && appDate >= new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && appDate <= end;
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesTrack &&
        matchesLearningMethod &&
        matchesMonth &&
        matchesDateRange &&
        matchesReferral
      );
    });
  }, [applications, endDate, learningMethodFilter, monthFilter, referralFilter, searchTerm, startDate, statusFilter, trackFilter]);

  const total = applications.length;
  const pending = applications.filter((app) => app.status === "Pending").length;
  const approved = applications.filter((app) => app.status === "Approved").length;
  const rejected = applications.filter((app) => app.status === "Rejected").length;

  const updateStatus = async (id, status, app) => {
    await updateDoc(doc(db, "scholarshipApplications", id), { status });
    setApplications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item)),
    );

    if (status === "Approved") {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          email: app.email,
          to_name: app.fullName,
          subjectTitle: "Congratulations! Your OVTech Scholarship Has Been Approved",
          mainMessage: `We are pleased to inform you that your OVTech Scholarship application has been approved. You have been selected to receive a ${app.scholarshipPercent || pricing.NG.scholarshipPercent} scholarship for your chosen learning path.`,
          extraMessage: `To secure your slot, kindly complete your registration payment of ${app.scholarshipFee || pricing.NG.scholarship} using the link below. Once payment is completed, our team will contact you with onboarding details.`,
          ctaText: "Registration Payment Link",
          ctaLink: app.scholarshipPaymentLink || pricing.NG.scholarshipPaymentLink,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("ovtechAdmin");
    await signOut(auth);
    window.location.href = "/admin-login";
  };

  const exportToCSV = () => {
    downloadCSV("ovtech-scholarship-applications.csv", getApplicationCSVRows(filteredApplications));
  };

  const exportReferralToCSV = (summary) => {
    downloadCSV(`${summary.code}.csv`, getApplicationCSVRows(summary.students));
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setTrackFilter("All");
    setMonthFilter("All");
    setLearningMethodFilter("All");
    setStartDate("");
    setEndDate("");
    setReferralFilter("All");
  };

  const copyReferralCode = async (code) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    setToast("Referral code copied.");
    setTimeout(() => setToast(""), 2200);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "scholarshipApplications", deleteTarget.id));
    setApplications((prev) => prev.filter((app) => app.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const enrollStudent = async (app) => {
    if (enrollingId) return;

    const enrolledAt = new Date();
    setEnrollingId(app.id);
    setToast("Enrolling student...");

    try {
      await updateDoc(doc(db, "scholarshipApplications", app.id), {
        status: "Enrolled",
        paymentStatus: "Paid",
        enrolledAt,
      });

      const enrolledApplication = {
        ...app,
        status: "Enrolled",
        paymentStatus: "Paid",
        enrolledAt,
      };

      setApplications((prev) =>
        prev.map((item) => (item.id === app.id ? { ...item, ...enrolledApplication } : item)),
      );
      setSelectedApplication(enrolledApplication);

      try {
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
          {
            email: app.email,
            to_name: app.fullName,
            subjectTitle: "Payment Confirmed: Welcome to OVTech Academy",
            mainMessage:
              "We are pleased to confirm that your registration payment has been received successfully and your enrollment has been completed.",
            extraMessage:
              "You have now been admitted into the OVTech training program. Our team will contact you shortly with onboarding details, class schedule, and the next steps for joining your learning group.",
            ctaText: "",
            ctaLink: "",
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
        );
      } catch {
      }

      setToast(`${app.fullName} has been enrolled successfully.`);
      setTimeout(() => setToast(""), 3000);
    } catch {
      setToast("Enrollment could not be completed. Please try again.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <main className="admin-page">
      {toast && <div className="admin-toast">{toast}</div>}

      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>Scholarship Applications</h1>
          <p>Review and manage scholarship applications submitted by learners.</p>
        </div>

        <div className="admin-header-actions">
          <a href="/" className="admin-home-btn">Back to Website</a>
          <a href="/enrolled-students" className="admin-home-btn">Enrolled Students</a>
          <a href="/admin/live-sessions" className="admin-home-btn">Publish Live Sessions</a>
          <button onClick={handleLogout} className="admin-logout-btn">Logout</button>
        </div>
      </section>

      <section className="admin-lms-shortcut admin-table-card">
        <div>
          <span>Student portal videos</span>
          <h2>Upload live-session replays and resources</h2>
          <p>Use the dedicated Live Sessions page to publish YouTube live sessions for all enrolled students, only live-class learners, only self-paced learners, or selected course tracks.</p>
        </div>
        <a href="/admin/live-sessions" className="admin-approve">Publish New Video</a>
      </section>

      <section className="admin-stats">
        <div><h3>{total}</h3><p>Total Applications</p></div>
        <div><h3>{pending}</h3><p>Pending</p></div>
        <div><h3>{approved}</h3><p>Approved</p></div>
        <div><h3>{rejected}</h3><p>Rejected</p></div>
      </section>

      <section className="admin-referral-controls">
        <div className="admin-commission-card">
          <label htmlFor="commissionPerStudent">Commission Per Enrolled Student</label>
          <input
            id="commissionPerStudent"
            type="number"
            min="0"
            value={commissionPerStudent}
            onChange={(e) => setCommissionPerStudent(e.target.value)}
          />
        </div>

        {topReferrer && (
          <div className="admin-top-referrer">
            <span>🏆 Top Referrer</span>
            <h3>{topReferrer.code}</h3>
            <p>{topReferrer.enrolled} Enrolled Students</p>
            <strong>Commission {formatCurrency(topReferrer.commission)}</strong>
          </div>
        )}
      </section>

      <section className="admin-referral-performance">
        <div className="admin-section-heading">
          <h2>Referral Performance</h2>
          <p>Track marketer applications, enrollments, and commissions.</p>
        </div>

        <div className="admin-referral-grid">
          {referralSummaries.map((summary) => (
            <article key={summary.code} className="admin-referral-card">
              <div className="admin-referral-card-head">
                <button
                  className="admin-referral-code-btn"
                  onClick={() => setReferralFilter(summary.code)}
                >
                  {summary.code}
                </button>
                <button
                  className="admin-copy-btn"
                  onClick={() => copyReferralCode(summary.code)}
                >
                  Copy
                </button>
              </div>

              <div className="admin-referral-metrics">
                <p>Applications: <strong>{summary.applications}</strong></p>
                <p>Pending: <strong>{summary.pending}</strong></p>
                <p>Approved: <strong>{summary.approved}</strong></p>
                <p>Rejected: <strong>{summary.rejected}</strong></p>
                <p>Enrolled: <strong>{summary.enrolled}</strong></p>
                <p>Commission: <strong>{formatCurrency(summary.commission)}</strong></p>
              </div>

              <button
                className="admin-view-details-btn"
                onClick={() => setSelectedReferral(summary.code)}
              >
                View Details
              </button>
            </article>
          ))}
        </div>

        {referralSummaries.length === 0 && (
          <p className="admin-empty">No referral performance data yet.</p>
        )}

        <div className="admin-total-commission">
          <span>Total Commission Owed</span>
          <strong>{formatCurrency(totalCommission)}</strong>
        </div>
      </section>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search name, email, phone or referral code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All</option><option>Pending</option><option>Approved</option><option>Rejected</option><option>Enrolled</option>
        </select>
        <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
          <option value="All">All Courses</option>
          {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
        </select>
        <select value={learningMethodFilter} onChange={(e) => setLearningMethodFilter(e.target.value)}>
          {LEARNING_METHOD_FILTERS.map((method) => (
            <option key={method.value} value={method.value}>{method.label}</option>
          ))}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="All">All Months</option>
          <option value="1">January</option><option value="2">February</option><option value="3">March</option><option value="4">April</option><option value="5">May</option><option value="6">June</option><option value="7">July</option><option value="8">August</option><option value="9">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select value={referralFilter} onChange={(e) => setReferralFilter(e.target.value)}>
          <option value="All">All Referral Codes</option>
          {referralCodes.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </div>

      <div className="admin-filter-actions">
        <button onClick={resetFilters} className="admin-reset-btn">Reset Filters</button>
        <button onClick={exportToCSV} className="admin-export-btn">Export Filtered Applications</button>
      </div>

      <section className="admin-table-card">
        <h2>Recent Applications</h2>
        {loading && <p className="admin-loading">Loading applications...</p>}
        {loadError && <p className="admin-empty">{loadError}</p>}
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>WhatsApp</th><th>Track</th><th>Learning Method</th><th>Referral Code</th><th>Location</th><th>Status</th><th>Actions</th><th>View</th><th>Date Applied</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => (
                <tr key={app.id}>
                  <td data-label="Name"><strong>{app.fullName}</strong><small>{app.email}</small></td>
                  <td data-label="WhatsApp">{app.whatsapp}</td>
                  <td data-label="Track">{app.track}</td>
                  <td data-label="Learning Method">{app.learningMethod || "—"}</td>
                  <td data-label="Referral Code">{getReferralCode(app)}</td>
                  <td data-label="Location">{app.location}</td>
                  <td data-label="Status"><span className="admin-status">{app.status}</span></td>
                  <td data-label="Actions">
                    <div className="admin-actions">
                      <button onClick={() => updateStatus(app.id, "Approved", app)} className="admin-approve">Approve</button>
                      <button onClick={() => updateStatus(app.id, "Rejected", app)} className="admin-reject">Reject</button>
                      <button onClick={() => setDeleteTarget(app)} className="admin-delete">Delete</button>
                    </div>
                  </td>
                  <td data-label="View"><button onClick={() => setSelectedApplication(app)} className="admin-view-btn">View</button></td>
                  <td data-label="Date Applied">{getDateApplied(app)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filteredApplications.length === 0 && <p className="admin-empty">No applications match your filters.</p>}
        </div>
      </section>

      {selectedReferralSummary && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-referral-modal">
            <button className="admin-modal-close" onClick={() => setSelectedReferral(null)}>×</button>
            <h2>{selectedReferralSummary.code}</h2>
            <p className="admin-modal-email">Referral analytics and student list</p>

            <div className="admin-referral-analytics">
              <div><span>Applications</span><strong>{selectedReferralSummary.applications}</strong></div>
              <div><span>Approved</span><strong>{selectedReferralSummary.approved}</strong></div>
              <div><span>Rejected</span><strong>{selectedReferralSummary.rejected}</strong></div>
              <div><span>Pending</span><strong>{selectedReferralSummary.pending}</strong></div>
              <div><span>Enrolled</span><strong>{selectedReferralSummary.enrolled}</strong></div>
              <div><span>Approval Rate</span><strong>{selectedReferralSummary.approvalRate}%</strong></div>
              <div><span>Enrollment Rate</span><strong>{selectedReferralSummary.enrollmentRate}%</strong></div>
              <div><span>Commission Earned</span><strong>{formatCurrency(selectedReferralSummary.commission)}</strong></div>
            </div>

            <button className="admin-export-btn" onClick={() => exportReferralToCSV(selectedReferralSummary)}>Export This Referral</button>

            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr><th>Student Name</th><th>Track</th><th>Learning Method</th><th>Date Applied</th><th>Status</th><th>Payment Status</th><th>Location</th><th>Email</th><th>WhatsApp</th><th>View</th></tr>
                </thead>
                <tbody>
                  {selectedReferralSummary.students.map((app) => (
                    <tr key={app.id}>
                      <td data-label="Student Name">{app.fullName}</td><td data-label="Track">{app.track}</td><td data-label="Learning Method">{app.learningMethod || "—"}</td><td data-label="Date Applied">{getDateApplied(app)}</td><td data-label="Status">{app.status}</td><td data-label="Payment Status">{app.paymentStatus || "—"}</td><td data-label="Location">{app.location}</td><td data-label="Email">{app.email}</td><td data-label="WhatsApp">{app.whatsapp}</td>
                      <td data-label="View"><button className="admin-view-btn" onClick={() => setSelectedApplication(app)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedApplication && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <button className="admin-modal-close" onClick={() => setSelectedApplication(null)}>×</button>
            <h2>{selectedApplication.fullName}</h2>
            <p className="admin-modal-email">{selectedApplication.email}</p>
            <div className="admin-details-grid">
              <div><strong>WhatsApp</strong><span>{selectedApplication.whatsapp}</span></div>
              <div><strong>Location</strong><span>{selectedApplication.location}</span></div>
              <div><strong>Age Range</strong><span>{selectedApplication.ageRange}</span></div>
              <div><strong>Preferred Track</strong><span>{selectedApplication.track}</span></div>
              <div><strong>Learning Method</strong><span>{selectedApplication.learningMethod}</span></div>
              <div><strong>Referral Source</strong><span>{selectedApplication.referral || "—"}</span></div>
              <div><strong>Referral Code</strong><span>{getReferralCode(selectedApplication)}</span></div>
            </div>
            <div className="admin-reason-box"><strong>Reason for Applying</strong><p>{selectedApplication.reason}</p></div>
            <div className="admin-modal-actions">
              {isEnrolled(selectedApplication) ? (
                <div className="admin-enrolled-card" role="status">
                  <strong>Student has been enrolled</strong>
                  <span>Status is now Enrolled and payment is marked as Paid.</span>
                </div>
              ) : (
                <button
                  onClick={() => enrollStudent(selectedApplication)}
                  className="admin-enroll-btn"
                  disabled={enrollingId === selectedApplication.id}
                >
                  {enrollingId === selectedApplication.id ? "Enrolling Student..." : "Enroll Student"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-overlay">
          <div className="admin-delete-modal">
            <h2>Delete Application?</h2>
            <p>Are you sure you want to permanently delete the application submitted by<strong> {deleteTarget.fullName}</strong>?</p>
            <p>This action cannot be undone.</p>
            <div className="admin-delete-actions">
              <button onClick={() => setDeleteTarget(null)} className="admin-cancel-delete">Cancel</button>
              <button onClick={confirmDelete} className="admin-confirm-delete">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Admin;
