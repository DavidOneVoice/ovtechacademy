import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { db } from "../src/firebase";
import "./AttendancePage.css";

const todayKey = () => new Date().toISOString().slice(0, 10);

const buildTrackValues = (student) => [
  student.track,
  ...(Array.isArray(student.tracks) ? student.tracks : []),
  ...(Array.isArray(student.courses) ? student.courses : []),
  ...(Array.isArray(student.enrolledCourses) ? student.enrolledCourses : []),
].filter(Boolean);

const AttendancePage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const sessionRef = doc(db, "attendanceSessions", sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
          setMessage("This attendance link is invalid or has been removed.");
          return;
        }

        const activeSession = { id: sessionSnap.id, ...sessionSnap.data() };
        setSession(activeSession);

        if (activeSession.dateKey !== todayKey()) {
          setMessage("This attendance link has expired. Please use today’s link from your instructor.");
          return;
        }

        const studentQuery = query(
          collection(db, "scholarshipApplications"),
          where("status", "==", "Enrolled"),
        );
        const snapshot = await getDocs(studentQuery);
        const matchingStudents = snapshot.docs
          .map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() }))
          .filter((student) => buildTrackValues(student).includes(activeSession.track))
          .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));

        setStudents(matchingStudents);
      } catch {
        setMessage("Attendance could not be loaded. Please refresh or contact your instructor.");
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, [sessionId]);

  const alreadyMarked = useMemo(
    () => selectedStudent?.attendanceMarkedSessions?.includes(sessionId),
    [selectedStudent, sessionId],
  );

  const handleStudentChange = (studentId) => {
    setSelectedStudentId(studentId);
    setSelectedStudent(students.find((student) => student.id === studentId) || null);
  };

  const submitAttendance = async () => {
    if (!selectedStudent || !session) return;

    setSubmitting(true);
    try {
      const attendanceRef = doc(db, "attendanceSessions", session.id, "records", selectedStudent.id);
      const studentRef = doc(db, "scholarshipApplications", selectedStudent.id);

      await runTransaction(db, async (transaction) => {
        const existingRecord = await transaction.get(attendanceRef);
        if (existingRecord.exists()) {
          throw new Error("already-marked");
        }

        transaction.set(attendanceRef, {
          studentId: selectedStudent.id,
          studentName: selectedStudent.fullName || "",
          email: selectedStudent.email || "",
          track: session.track,
          sessionId: session.id,
          dateKey: session.dateKey,
          markedAt: serverTimestamp(),
        });

        transaction.update(studentRef, {
          [`attendance.${session.track}.attendedDays`]: increment(1),
          attendanceMarkedSessions: arrayUnion(session.id),
          lastAttendanceMarkedAt: serverTimestamp(),
        });
      });

      setConfirming(false);
      setMessage("Attendance submitted successfully. Redirecting you to the LMS login page...");
      setTimeout(() => navigate("/lms", { replace: true }), 2200);
    } catch (error) {
      setConfirming(false);
      if (error.message === "already-marked") {
        setMessage("Attendance has already been taken for this student today.");
      } else {
        setMessage("Attendance could not be submitted. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="attendance-page">
        <section className="attendance-card">
          <span className="attendance-kicker">OVTech Academy Attendance</span>
          <h1>{session?.track || "Class"} Attendance</h1>
          <p className="attendance-copy">
            Select your name from this class list, confirm your details, and mark attendance once.
          </p>

          {loading && <p className="attendance-alert">Loading attendance register...</p>}
          {message && <p className="attendance-alert">{message}</p>}

          {!loading && session && session.dateKey === todayKey() && (
            <div className="attendance-form-panel">
              <label>
                <span>Choose your name</span>
                <select value={selectedStudentId} onChange={(event) => handleStudentChange(event.target.value)}>
                  <option value="">Select your name</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.fullName}</option>
                  ))}
                </select>
              </label>

              {selectedStudent && (
                <div className="attendance-profile">
                  <div><strong>Name</strong><span>{selectedStudent.fullName || "—"}</span></div>
                  <div><strong>Email</strong><span>{selectedStudent.email || "—"}</span></div>
                  <div><strong>WhatsApp</strong><span>{selectedStudent.whatsapp || "—"}</span></div>
                  <div><strong>Course</strong><span>{session.track}</span></div>
                  <div><strong>Days Attended</strong><span>{selectedStudent.attendance?.[session.track]?.attendedDays || 0}</span></div>
                  <div><strong>Lectures Held</strong><span>{selectedStudent.attendance?.[session.track]?.lectureDays || session.lectureCount || 1}</span></div>
                </div>
              )}

              <button
                type="button"
                className="attendance-submit"
                disabled={!selectedStudent || alreadyMarked || submitting}
                onClick={() => setConfirming(true)}
              >
                {alreadyMarked ? "Attendance Already Taken" : submitting ? "Submitting..." : "Mark Attendance"}
              </button>
            </div>
          )}

          <Link className="attendance-login-link" to="/lms">Go to LMS Login</Link>
        </section>
      </main>
      <Footer />

      {confirming && (
        <div className="attendance-modal-overlay">
          <div className="attendance-confirm-modal">
            <h2>Submit Attendance?</h2>
            <p>Are you sure you want to mark attendance for {selectedStudent?.fullName} in {session?.track} today?</p>
            <div>
              <button type="button" onClick={() => setConfirming(false)}>No, Cancel</button>
              <button type="button" onClick={submitAttendance} disabled={submitting}>Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendancePage;
