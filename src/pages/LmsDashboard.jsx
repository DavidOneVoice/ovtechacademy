import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { db } from "../src/firebase";
import { getSafeYouTubeEmbedUrl } from "../lms/youtube";
import { getStudentProgramDay, isItemUnlocked, sortLmsItems } from "../lms/unlocking";
import { calculateProgressPercentage, saveStudentProgress } from "../lms/progress";
import "./LmsDashboard.css";

const STORAGE_KEY = "ovtech_lms_student";
const SELF_PACED_METHOD = "Self-Paced Pre-recorded Videos";

const normalize = (value) => String(value || "").trim().toLowerCase();

const isSelfPacedStudent = (student) =>
  student &&
  (student.status === "Enrolled" || student.paymentStatus === "Paid") &&
  normalize(student.learningMethod).includes(normalize(SELF_PACED_METHOD));

const LmsDashboard = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [login, setLogin] = useState({ email: "", whatsapp: "" });
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [completedLessonIds, setCompletedLessonIds] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setStudent(JSON.parse(saved));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!student) return;

    const fetchLmsData = async () => {
      setLoading(true);
      const course = student.track || student.course || "";
      const lessonQuery = query(collection(db, "curriculum"), where("course", "==", course), where("isPublished", "==", true), orderBy("globalOrder", "asc"));
      const resourceQuery = query(collection(db, "lmsResources"), where("course", "==", course), where("isPublished", "==", true), orderBy("unlockDay", "asc"));
      const [lessonSnapshot, resourceSnapshot, progressSnapshot] = await Promise.all([
        getDocs(lessonQuery),
        getDocs(resourceQuery),
        getDoc(doc(db, "studentProgress", student.id)),
      ]);

      const lessonData = lessonSnapshot.docs.map((item) => ({ id: item.id, ...item.data(), type: "video" }));
      const resourceData = resourceSnapshot.docs.map((item) => ({ id: item.id, ...item.data(), type: "resource" }));
      const progress = progressSnapshot.exists() ? progressSnapshot.data() : {};

      setLessons(lessonData);
      setResources(resourceData);
      setCompletedLessonIds(progress.completedLessonIds || []);
      setSelectedLessonId(progress.lastWatchedLessonId || lessonData.find((item) => isItemUnlocked(item, student))?.lessonId || "");
      setLoading(false);
    };

    fetchLmsData().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, [student]);

  const items = useMemo(() => sortLmsItems([...resources, ...lessons]), [lessons, resources]);
  const selectedLesson = lessons.find((lesson) => lesson.lessonId === selectedLessonId);
  const programDay = getStudentProgramDay(student);
  const progressPercentage = calculateProgressPercentage(completedLessonIds, lessons);
  const nextLesson = lessons.find((lesson) => isItemUnlocked(lesson, student) && !completedLessonIds.includes(lesson.lessonId));

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const q = query(collection(db, "scholarshipApplications"), where("email", "==", login.email.trim()), limit(10));
      const snapshot = await getDocs(q);
      const match = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .find((item) => normalize(item.whatsapp) === normalize(login.whatsapp) && isSelfPacedStudent(item));

      if (!match) {
        setAuthError("No enrolled self-paced LMS student was found with that email and WhatsApp number.");
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
      setStudent(match);
    } catch (error) {
      console.error(error);
      setAuthError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (lesson) => {
    const updatedCompleted = [...new Set([...completedLessonIds, lesson.lessonId])];
    setCompletedLessonIds(updatedCompleted);
    await saveStudentProgress({ db, student, completedLessonIds: updatedCompleted, lastWatchedLessonId: lesson.lessonId, lessons });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStudent(null);
    navigate("/lms");
  };

  if (!student) {
    return (
      <main className="lms-page">
        <Navbar />
        <section className="lms-login-card">
          <span>OVTech LMS</span>
          <h1>Continue your self-paced learning</h1>
          <p>Log in with the email and WhatsApp number already submitted during enrollment. No new signup is needed.</p>
          <form onSubmit={handleLogin}>
            <label>Email address<input type="email" required value={login.email} onChange={(e) => setLogin((prev) => ({ ...prev, email: e.target.value }))} /></label>
            <label>WhatsApp number<input type="tel" required value={login.whatsapp} onChange={(e) => setLogin((prev) => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 15) }))} /></label>
            {authError && <p className="lms-error">{authError}</p>}
            <button type="submit" disabled={loading}>{loading ? "Checking..." : "Enter LMS"}</button>
          </form>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="lms-page">
      <Navbar />
      <section className="lms-hero">
        <div><span>Welcome back, {student.fullName || "Student"}</span><h1>{student.track || "Your Course"}</h1><p>Package: {student.learningMethod} • Day {programDay}</p></div>
        <button onClick={logout}>Logout</button>
      </section>
      <section className="lms-progress-card"><div><strong>{progressPercentage}% complete</strong><p>Next lesson: {nextLesson?.title || "You are caught up."}</p></div><div className="lms-progress"><span style={{ width: `${progressPercentage}%` }} /></div></section>
      <section className="lms-layout">
        <aside className="lms-list">
          <h2>Lessons & resources</h2>
          {items.map((item) => {
            const unlocked = isItemUnlocked(item, student);
            const complete = item.type === "video" && completedLessonIds.includes(item.lessonId);
            return <button key={item.id || item.lessonId || item.resourceId} className={selectedLessonId === item.lessonId ? "active" : ""} disabled={!unlocked} onClick={() => item.type === "video" && setSelectedLessonId(item.lessonId)}>
              <span>{item.type === "resource" ? "📎 Resource" : complete ? "✅ Completed" : unlocked ? "▶ Lesson" : "🔒 Locked"}</span>
              <strong>{item.title}</strong>
              <small>{item.section || item.module || "General"} • Day {item.unlockDay || 1}</small>
              {item.type === "resource" && unlocked && <a href={item.downloadUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Download {item.fileType || "file"}</a>}
            </button>;
          })}
        </aside>
        <section className="lms-player-card">
          {selectedLesson ? <>
            <h2>{selectedLesson.title}</h2>
            {getSafeYouTubeEmbedUrl(selectedLesson.youtubeUrl) ? <iframe src={getSafeYouTubeEmbedUrl(selectedLesson.youtubeUrl)} title={selectedLesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <p className="lms-error">This lesson needs a valid YouTube URL.</p>}
            <button onClick={() => handleComplete(selectedLesson)} disabled={completedLessonIds.includes(selectedLesson.lessonId)}>{completedLessonIds.includes(selectedLesson.lessonId) ? "Completed" : "Mark lesson as completed"}</button>
          </> : <p>Select an unlocked lesson to start watching.</p>}
        </section>
      </section>
      <Footer />
    </main>
  );
};

export default LmsDashboard;
