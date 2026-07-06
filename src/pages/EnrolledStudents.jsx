import { useEffect, useState } from "react";
import { db } from "../src/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
} from "firebase/firestore";

import "./Admin.css";

const getReferralCode = (student) => student.referralCode?.trim() || "DIRECT";

const getDateValue = (timestamp) =>
  timestamp?.seconds ? new Date(timestamp.seconds * 1000).toLocaleDateString() : "N/A";

const EDITABLE_FIELDS = [
  { key: "fullName", label: "Full Name", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "whatsapp", label: "WhatsApp", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "ageRange", label: "Age Range", type: "text" },
  { key: "track", label: "Preferred Track", type: "text" },
  { key: "learningMethod", label: "Learning Method", type: "text" },
  { key: "referral", label: "Referral Source", type: "text" },
  { key: "referralCode", label: "Referral Code", type: "text" },
  { key: "reason", label: "Reason for Applying", type: "textarea" },
];

const EnrolledStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, "scholarshipApplications"));
        const snapshot = await getDocs(q);
        const enrolled = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((student) => student.status === "Enrolled");

        setStudents(enrolled);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setEditForm(
      EDITABLE_FIELDS.reduce(
        (form, field) => ({ ...form, [field.key]: student[field.key] || "" }),
        {},
      ),
    );
  };

  const handleEditChange = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveStudentDetails = async (event) => {
    event.preventDefault();
    if (!editingStudent) return;

    setSaving(true);

    try {
      await updateDoc(doc(db, "scholarshipApplications", editingStudent.id), editForm);
      const updatedStudent = { ...editingStudent, ...editForm };

      setStudents((prev) =>
        prev.map((student) => (student.id === editingStudent.id ? updatedStudent : student)),
      );
      setSelectedStudent((prev) =>
        prev?.id === editingStudent.id ? { ...prev, ...editForm } : prev,
      );
      setEditingStudent(null);
      showToast("Student details updated successfully.");
    } catch {
      showToast("Student details could not be updated. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteDoc(doc(db, "scholarshipApplications", deleteTarget.id));
      setStudents((prev) => prev.filter((student) => student.id !== deleteTarget.id));
      setSelectedStudent((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setEditingStudent((prev) => (prev?.id === deleteTarget.id ? null : prev));
      showToast(`${deleteTarget.fullName} has been deleted completely.`);
    } catch {
      showToast("Student could not be deleted. Please try again.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <main className="admin-page">
      {toast && <div className="admin-toast">{toast}</div>}

      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>Enrolled Students</h1>
          <p>
            Students who have completed registration and have been admitted.
          </p>
        </div>
      </section>

      <section className="admin-table-card">
        <h2>Total Enrolled: {students.length}</h2>
        {loading && <p className="admin-loading">Loading enrolled students...</p>}

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Track</th>
                <th>Method</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td data-label="Name">{student.fullName}</td>
                  <td data-label="Email">{student.email}</td>
                  <td data-label="WhatsApp">{student.whatsapp}</td>
                  <td data-label="Track">{student.track}</td>
                  <td data-label="Method">{student.learningMethod}</td>
                  <td data-label="Location">{student.location}</td>
                  <td data-label="Actions">
                    <div className="admin-actions">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="admin-view-btn"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(student)}
                        className="admin-edit-btn"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(student)}
                        className="admin-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && students.length === 0 && (
            <p className="admin-empty">No enrolled students yet.</p>
          )}
        </div>
      </section>

      {selectedStudent && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <button className="admin-modal-close" onClick={() => setSelectedStudent(null)}>×</button>
            <h2>{selectedStudent.fullName}</h2>
            <p className="admin-modal-email">{selectedStudent.email}</p>
            <div className="admin-details-grid">
              <div><strong>WhatsApp</strong><span>{selectedStudent.whatsapp || "—"}</span></div>
              <div><strong>Location</strong><span>{selectedStudent.location || "—"}</span></div>
              <div><strong>Age Range</strong><span>{selectedStudent.ageRange || "—"}</span></div>
              <div><strong>Preferred Track</strong><span>{selectedStudent.track || "—"}</span></div>
              <div><strong>Learning Method</strong><span>{selectedStudent.learningMethod || "—"}</span></div>
              <div><strong>Referral Source</strong><span>{selectedStudent.referral || "—"}</span></div>
              <div><strong>Referral Code</strong><span>{getReferralCode(selectedStudent)}</span></div>
              <div><strong>Status</strong><span>{selectedStudent.status || "—"}</span></div>
              <div><strong>Payment Status</strong><span>{selectedStudent.paymentStatus || "—"}</span></div>
              <div><strong>Date Applied</strong><span>{getDateValue(selectedStudent.createdAt)}</span></div>
              <div><strong>Date Enrolled</strong><span>{getDateValue(selectedStudent.enrolledAt)}</span></div>
            </div>
            <div className="admin-reason-box"><strong>Reason for Applying</strong><p>{selectedStudent.reason || "—"}</p></div>
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-edit-modal">
            <button className="admin-modal-close" onClick={() => setEditingStudent(null)}>×</button>
            <h2>Edit Student Details</h2>
            <p className="admin-modal-email">Changes update the student's main application record.</p>
            <form onSubmit={saveStudentDetails} className="admin-edit-form">
              {EDITABLE_FIELDS.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  {field.type === "textarea" ? (
                    <textarea
                      value={editForm[field.key] || ""}
                      onChange={(event) => handleEditChange(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={editForm[field.key] || ""}
                      onChange={(event) => handleEditChange(field.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
              <button type="submit" className="admin-enroll-btn" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-overlay">
          <div className="admin-delete-modal">
            <h2>Delete Enrolled Student?</h2>
            <p>Are you sure you want to permanently delete every record for<strong> {deleteTarget.fullName}</strong>?</p>
            <p>This action removes the student from the enrolled list and cannot be undone.</p>
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

export default EnrolledStudents;
