import { useEffect, useState } from "react";
import "./Admin.css";
import { db } from "../src/firebase";
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

const Admin = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [trackFilter, setTrackFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [referralFilter, setReferralFilter] = useState("All");

  const filteredApplications = applications.filter((app) => {
    const matchesReferral =
      referralFilter === "All" || app.referralCode === referralFilter;
    const matchesSearch =
      app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.whatsapp?.includes(searchTerm);

    const matchesStatus = statusFilter === "All" || app.status === statusFilter;

    const matchesTrack = trackFilter === "All" || app.track === trackFilter;

    let matchesMonth = true;

    if (monthFilter !== "All" && app.createdAt?.seconds) {
      const appMonth = new Date(app.createdAt.seconds * 1000).getMonth() + 1;

      matchesMonth = appMonth === Number(monthFilter);
    }
    let matchesDateRange = true;

    if (app.createdAt?.seconds) {
      const appDate = new Date(app.createdAt.seconds * 1000);

      if (startDate) {
        const start = new Date(startDate);
        matchesDateRange = matchesDateRange && appDate >= start;
      }

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
      matchesMonth &&
      matchesDateRange &&
      matchesReferral
    );
  });

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);

        const q = query(
          collection(db, "scholarshipApplications"),
          orderBy("createdAt", "desc"),
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setApplications(data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  const total = applications.length;
  const pending = applications.filter((app) => app.status === "Pending").length;
  const approved = applications.filter(
    (app) => app.status === "Approved",
  ).length;
  const rejected = applications.filter(
    (app) => app.status === "Rejected",
  ).length;

  const updateStatus = async (id, status, app) => {
    await updateDoc(doc(db, "scholarshipApplications", id), {
      status,
    });

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

          subjectTitle:
            "Congratulations! Your OVTech Scholarship Has Been Approved",

          mainMessage: `We are pleased to inform you that your OVTech Scholarship application has been approved. You have been selected to receive a ${
            app.scholarshipPercent || pricing.NG.scholarshipPercent
          } scholarship for your chosen learning path.`,

          extraMessage: `To secure your slot, kindly complete your registration payment of ${
            app.scholarshipFee || pricing.NG.scholarship
          } using the link below. Once payment is completed, our team will contact you with onboarding details.`,

          ctaText: "Registration Payment Link",
          ctaLink:
            app.scholarshipPaymentLink || pricing.NG.scholarshipPaymentLink,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("ovtechAdmin");
    window.location.href = "/admin-login";
  };

  const exportToCSV = () => {
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
    ];

    const rows = filteredApplications.map((app) => [
      app.fullName,
      app.email,
      app.whatsapp,
      app.location,
      app.ageRange,
      app.track,
      app.learningMethod,
      app.referral,
      app.referralCode,
      app.reason,
      app.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((item) => `"${String(item || "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "ovtech-scholarship-applications.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setTrackFilter("All");
    setMonthFilter("All");
    setStartDate("");
    setEndDate("");
    setReferralFilter("All");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteDoc(doc(db, "scholarshipApplications", deleteTarget.id));

    setApplications((prev) => prev.filter((app) => app.id !== deleteTarget.id));

    setDeleteTarget(null);
  };

  const enrollStudent = async (app) => {
    await updateDoc(doc(db, "scholarshipApplications", app.id), {
      status: "Enrolled",
      paymentStatus: "Paid",
      enrolledAt: new Date(),
    });

    setApplications((prev) =>
      prev.map((item) =>
        item.id === app.id
          ? {
              ...item,
              status: "Enrolled",
              paymentStatus: "Paid",
              enrolledAt: new Date(),
            }
          : item,
      ),
    );

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

    setSelectedApplication(null);
  };

  return (
    <main className="admin-page">
      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>Scholarship Applications</h1>
          <p>
            Review and manage scholarship applications submitted by learners.
          </p>
        </div>

        <div style={{ gap: "1rem", display: "flex", alignItems: "center" }}>
          <a href="/" className="admin-home-btn">
            Back to Website
          </a>
          <a href="/enrolled-students" className="admin-home-btn">
            Enrolled Students
          </a>
          <button onClick={handleLogout} className="admin-logout-btn">
            Logout
          </button>
        </div>
      </section>

      <section className="admin-stats">
        <div>
          <h3>{total}</h3>
          <p>Total Applications</p>
        </div>

        <div>
          <h3>{pending}</h3>
          <p>Pending</p>
        </div>

        <div>
          <h3>{approved}</h3>
          <p>Approved</p>
        </div>

        <div>
          <h3>{rejected}</h3>
          <p>Rejected</p>
        </div>
        <div className="admin-referral-summary">
          <h3>Referral Performance</h3>

          {[
            ...new Set(
              applications.map((app) => app.referralCode).filter(Boolean),
            ),
          ].map((code) => (
            <div key={code} className="ref-row">
              <span>{code}</span>

              <strong>
                {applications.filter((a) => a.referralCode === code).length}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search name, email or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>

        <select
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
        >
          <option>All</option>
          <option>Data Analytics</option>
          <option>Software Development (Frontend)</option>
          <option>Web Development</option>
        </select>

        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="All">All Months</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <select
          value={referralFilter}
          onChange={(e) => setReferralFilter(e.target.value)}
        >
          <option value="All">All Referral Codes</option>

          {[
            ...new Set(
              applications
                .map((app) => app.referralCode)
                .filter(Boolean)
                .sort(),
            ),
          ].map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <button onClick={resetFilters} className="admin-reset-btn">
        Reset Filters
      </button>
      <button onClick={exportToCSV} className="admin-export-btn">
        Export Filtered Applications
      </button>

      <section className="admin-table-card">
        <h2>Recent Applications</h2>
        {loading && <p className="admin-loading">Loading applications...</p>}
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>WhatsApp</th>
                <th>Track</th>
                <th>Method</th>
                <th>Location</th>
                <th>Referral Code</th>
                <th>Status</th>
                <th>Actions</th>
                <th>View</th>
                <th>Date Applied</th>
              </tr>
            </thead>

            <tbody>
              {filteredApplications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <strong>{app.fullName}</strong>
                    <small>{app.email}</small>
                  </td>
                  <td>{app.whatsapp}</td>
                  <td>{app.track}</td>
                  <td>{app.learningMethod || "—"}</td>
                  <td>{app.referralCode || "—"}</td>
                  <td>{app.location}</td>
                  <td>
                    <span className="admin-status">{app.status}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        onClick={() => updateStatus(app.id, "Approved", app)}
                        className="admin-approve"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => setDeleteTarget(app)}
                        className="admin-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedApplication(app)}
                      className="admin-view-btn"
                    >
                      View
                    </button>
                  </td>
                  <td>
                    {app.createdAt?.seconds
                      ? new Date(
                          app.createdAt.seconds * 1000,
                        ).toLocaleDateString()
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filteredApplications.length === 0 && (
            <p className="admin-empty">No applications match your filters.</p>
          )}
        </div>
      </section>
      {selectedApplication && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <button
              className="admin-modal-close"
              onClick={() => setSelectedApplication(null)}
            >
              ×
            </button>

            <h2>{selectedApplication.fullName}</h2>
            <p className="admin-modal-email">{selectedApplication.email}</p>

            <div className="admin-details-grid">
              <div>
                <strong>WhatsApp</strong>
                <span>{selectedApplication.whatsapp}</span>
              </div>

              <div>
                <strong>Location</strong>
                <span>{selectedApplication.location}</span>
              </div>

              <div>
                <strong>Age Range</strong>
                <span>{selectedApplication.ageRange}</span>
              </div>

              <div>
                <strong>Preferred Track</strong>
                <span>{selectedApplication.track}</span>
              </div>

              <div>
                <strong>Learning Method</strong>
                <span>{selectedApplication.learningMethod}</span>
              </div>

              <div>
                <strong>Referral Source</strong>
                <span>{selectedApplication.referral || "—"}</span>
              </div>

              <div>
                <strong>Referral Code</strong>
                <span>{selectedApplication.referralCode || "—"}</span>
              </div>
            </div>

            <div className="admin-reason-box">
              <strong>Reason for Applying</strong>
              <p>{selectedApplication.reason}</p>
            </div>
            <div className="admin-modal-actions">
              <button
                onClick={() => enrollStudent(selectedApplication)}
                className="admin-enroll-btn"
              >
                Enroll Student
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="admin-modal-overlay">
          <div className="admin-delete-modal">
            <h2>Delete Application?</h2>

            <p>
              Are you sure you want to permanently delete the application
              submitted by
              <strong> {deleteTarget.fullName}</strong>?
            </p>

            <p>This action cannot be undone.</p>

            <div className="admin-delete-actions">
              <button
                onClick={() => setDeleteTarget(null)}
                className="admin-cancel-delete"
              >
                Cancel
              </button>

              <button onClick={confirmDelete} className="admin-confirm-delete">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Admin;
