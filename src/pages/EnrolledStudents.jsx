import { useEffect, useMemo, useState } from "react";
import { db } from "../src/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  FieldPath,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import courses from "../data/courses";
import "./Admin.css";

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

const getReferralCode = (student) => student.referralCode?.trim() || "DIRECT";

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const slugifyTrack = (track) =>
  String(track || "course")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getStudentTracks = (student) => [
  student.track,
  ...(Array.isArray(student.tracks) ? student.tracks : []),
  ...(Array.isArray(student.courses) ? student.courses : []),
  ...(Array.isArray(student.enrolledCourses) ? student.enrolledCourses : []),
].filter(Boolean);

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
  const [trackFilter, setTrackFilter] = useState("All");
  const [learningMethodFilter, setLearningMethodFilter] = useState("All");
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [confirmTrack, setConfirmTrack] = useState(null);
  const [generatedSession, setGeneratedSession] = useState(null);
  const [generatingAttendance, setGeneratingAttendance] = useState(false);

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

  const courseOptions = useMemo(() => [
    ...new Set([
      ...courses.map((course) => course.title),
      ...students.flatMap((student) => getStudentTracks(student)),
    ].filter(Boolean)),
  ].sort(), [students]);

  const attendanceCourses = useMemo(() => courseOptions.map((course) => ({
    title: course,
    studentCount: students.filter((student) => getStudentTracks(student).includes(course)).length,
  })).filter((course) => course.studentCount > 0), [courseOptions, students]);

  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesTrack = trackFilter === "All" || getStudentTracks(student).includes(trackFilter);
    const matchesLearningMethod =
      learningMethodFilter === "All" ||
      normalizeLearningMethod(student.learningMethod) === learningMethodFilter;
    return matchesTrack && matchesLearningMethod;
  }), [learningMethodFilter, students, trackFilter]);

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
        await setDoc(sessionRef, {
          track: confirmTrack,
          trackSlug: slugifyTrack(confirmTrack),
          dateKey,
          createdAt: serverTimestamp(),
          lectureCount: 1,
        });

        await Promise.all(
          students
            .filter((student) => getStudentTracks(student).includes(confirmTrack))
            .map((student) => updateDoc(
              doc(db, "scholarshipApplications", student.id),
              new FieldPath("attendance", confirmTrack, "lectureDays"),
              increment(1),
            )),
        );
      }

      const link = `${window.location.origin}/attendance/${sessionId}`;
      setGeneratedSession({ track: confirmTrack, dateKey, link, reused: sessionSnap.exists() });
      setConfirmTrack(null);
      showToast(sessionSnap.exists() ? "Today’s attendance link is ready." : "Lecture day confirmed and attendance link generated.");
    } catch (error) {
      console.error("Attendance link generation failed:", error);
      showToast("Attendance link could not be generated. Please try again.");
    } finally {
      setGeneratingAttendance(false);
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
        <div className="admin-table-heading">
          <div>
            <h2>Total Enrolled: {students.length}</h2>
            <p>Create course-specific attendance links only when that lecture holds.</p>
          </div>
          <button type="button" className="admin-attendance-main-btn" onClick={() => setAttendanceModalOpen(true)}>
            Generate Attendance Link
          </button>
        </div>
        <div className="admin-filters">
          <select value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}>
            <option value="All">All Courses</option>
            {courseOptions.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
          <select
            value={learningMethodFilter}
            onChange={(event) => setLearningMethodFilter(event.target.value)}
          >
            {LEARNING_METHOD_FILTERS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>
        </div>
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
              {filteredStudents.map((student) => (
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
          {!loading && filteredStudents.length === 0 && (
            <p className="admin-empty">No enrolled students match your filters.</p>
          )}
        </div>
      </section>

      {attendanceModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-attendance-modal">
            <button className="admin-modal-close" onClick={() => setAttendanceModalOpen(false)}>×</button>
            <h2>Generate Attendance Link</h2>
            <p className="admin-modal-email">Choose the exact course holding today. Each course gets its own daily link.</p>
            <div className="admin-attendance-course-grid">
              {attendanceCourses.map((course) => (
                <button type="button" key={course.title} onClick={() => setConfirmTrack(course.title)}>
                  <strong>{course.title}</strong>
                  <span>{course.studentCount} enrolled student{course.studentCount === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
            {generatedSession && (
              <div className="admin-generated-link">
                <span>{generatedSession.track} • {generatedSession.dateKey}</span>
                <input readOnly value={generatedSession.link} onFocus={(event) => event.target.select()} />
                <button type="button" onClick={() => copyAttendanceLink(generatedSession.link)}>Copy Link</button>
                {generatedSession.reused && <p>This lecture was already confirmed today, so the existing link was reused.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmTrack && (
        <div className="admin-modal-overlay">
          <div className="admin-delete-modal">
            <h2>Confirm Lecture Held?</h2>
            <p>Did <strong>{confirmTrack}</strong> hold today? Clicking yes records today as one lecture day for enrolled students and creates today’s unique attendance link.</p>
            <div className="admin-delete-actions">
              <button onClick={() => setConfirmTrack(null)} className="admin-cancel-delete">No, Cancel</button>
              <button onClick={generateAttendanceSession} className="admin-confirm-attendance" disabled={generatingAttendance}>
                {generatingAttendance ? "Generating..." : "Yes, Generate Link"}
              </button>
            </div>
          </div>
        </div>
      )}

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
