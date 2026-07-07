import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { db } from "../src/firebase";
import { getSafeYouTubeEmbedUrl } from "../lms/youtube";
import {
  getStudentProgramDay,
  isItemUnlocked,
  sortLmsItems,
} from "../lms/unlocking";
import {
  calculateProgressPercentage,
  getProgressId,
  saveStudentProgress,
} from "../lms/progress";
import "./LmsDashboard.css";

const STORAGE_KEY = "ovtech_lms_student";
const PRE_RECORDED_ACCESS_TEXT = "pre-recorded videos";
const LIVE_CLASS_ACCESS_TEXT = "live";

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const hasValue = (value) => String(value || "").trim().length > 0;

const slugifyTrack = (track) =>
  String(track || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const STUDENT_EMAIL_FIELDS = ["email", "emailAddress", "studentEmail"];
const STUDENT_PHONE_FIELDS = [
  "whatsapp",
  "whatsApp",
  "whatsappNumber",
  "phone",
  "phoneNumber",
  "mobile",
  "mobileNumber",
];
const ENROLLMENT_PACKAGE_FIELDS = [
  "learningMethod",
  "package",
  "packageName",
  "mode",
  "enrollmentMode",
  "selectedPackage",
  "selectedMode",
  "plan",
];

const getStudentName = (student) =>
  student?.fullName || student?.name || student?.studentName || "Student";
const getStudentCourse = (student) =>
  student?.track ||
  student?.course ||
  student?.courseName ||
  student?.program ||
  "";

const getStudentTracks = (student) =>
  [
    getStudentCourse(student),
    ...(Array.isArray(student?.tracks) ? student.tracks : []),
    ...(Array.isArray(student?.courses) ? student.courses : []),
    ...(Array.isArray(student?.enrolledCourses) ? student.enrolledCourses : []),
  ].filter(Boolean);

const formatAttendanceDate = (dateKey) => {
  if (!dateKey) return "Date pending";
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const getEnrollmentPackage = (student) =>
  ENROLLMENT_PACKAGE_FIELDS.map((field) => student?.[field])
    .filter(Boolean)
    .join(" ");

const isPaidOrEnrolled = (student) => {
  const statusText = normalize(
    [student?.status, student?.paymentStatus, student?.enrollmentStatus]
      .filter(Boolean)
      .join(" "),
  );
  return (
    statusText.includes("enrolled") ||
    statusText.includes("paid") ||
    statusText.includes("approved") ||
    statusText.includes("successful")
  );
};

const isSelfPacedStudent = (student) =>
  student &&
  isPaidOrEnrolled(student) &&
  normalize(getEnrollmentPackage(student)).includes(PRE_RECORDED_ACCESS_TEXT);

const isLiveClassStudent = (student) =>
  student &&
  isPaidOrEnrolled(student) &&
  normalize(getEnrollmentPackage(student)).includes(LIVE_CLASS_ACCESS_TEXT);

const hasUnselectedLearningMethod = (student) =>
  student &&
  isPaidOrEnrolled(student) &&
  !hasValue(getEnrollmentPackage(student));

const isInstructorLedStudent = (student) =>
  isLiveClassStudent(student) || hasUnselectedLearningMethod(student);

const isEligibleStudent = (student) => isPaidOrEnrolled(student);

const fieldMatches = (student, fields, target, normalizer = normalize) =>
  fields.some(
    (field) =>
      hasValue(student?.[field]) && normalizer(student[field]) === target,
  );

const findEligibleStudent = (docs, login) => {
  const email = normalize(login.email);
  const phone = normalizePhone(login.whatsapp);

  return docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .find((item) => {
      const emailMatches =
        email && fieldMatches(item, STUDENT_EMAIL_FIELDS, email, normalize);
      const phoneMatches =
        phone &&
        fieldMatches(item, STUDENT_PHONE_FIELDS, phone, normalizePhone);
      return (emailMatches || phoneMatches) && isEligibleStudent(item);
    });
};

const uniqueDocs = (snapshots) => {
  const docsById = new Map();
  snapshots.forEach((snapshot) =>
    snapshot.docs.forEach((item) => docsById.set(item.id, item)),
  );
  return [...docsById.values()];
};

const buildLoginQueries = (login) => {
  const email = login.email.trim();
  const normalizedEmail = normalize(email);
  const rawPhone = login.whatsapp.trim();
  const digitsPhone = normalizePhone(rawPhone);
  const queries = [];

  if (email) {
    STUDENT_EMAIL_FIELDS.forEach((field) => {
      queries.push(
        query(
          collection(db, "scholarshipApplications"),
          where(field, "==", email),
          limit(1),
        ),
      );
      if (normalizedEmail !== email)
        queries.push(
          query(
            collection(db, "scholarshipApplications"),
            where(field, "==", normalizedEmail),
            limit(1),
          ),
        );
    });
  }

  if (rawPhone) {
    STUDENT_PHONE_FIELDS.forEach((field) => {
      queries.push(
        query(
          collection(db, "scholarshipApplications"),
          where(field, "==", rawPhone),
          limit(1),
        ),
      );
      if (digitsPhone !== rawPhone)
        queries.push(
          query(
            collection(db, "scholarshipApplications"),
            where(field, "==", digitsPhone),
            limit(1),
          ),
        );
    });
  }

  return queries;
};

const buildAttendanceSummary = (student, attendanceRecords = []) => {
  const attendance = student?.attendance || {};
  const tracks = [
    ...new Set([...getStudentTracks(student), ...Object.keys(attendance)]),
  ];
  const recordCountsByTrack = attendanceRecords.reduce((counts, record) => {
    const track = record.track;
    if (!track) return counts;
    counts[track] = (counts[track] || 0) + 1;
    return counts;
  }, {});
  const markedSessions = student?.attendanceMarkedSessions || [];

  return tracks.map((track) => {
    const stats = attendance[track] || {};
    const recordAttendedDays = recordCountsByTrack[track] || 0;
    const storedAttendedDays = Number(stats.attendedDays || 0);
    const storedLectureDays = Number(stats.lectureDays || 0);
    const trackSlug = slugifyTrack(track);
    const hasMarkedTrackAttendance =
      recordAttendedDays > 0 ||
      markedSessions.some((sessionId) =>
        String(sessionId || "").startsWith(`${trackSlug}-`),
      );
    const attendedDays = hasMarkedTrackAttendance
      ? Math.min(
          storedAttendedDays || recordAttendedDays,
          recordAttendedDays || storedAttendedDays,
        )
      : 0;
    const lectureDays = hasMarkedTrackAttendance
      ? Math.max(storedLectureDays, attendedDays)
      : 0;

    return {
      track,
      attendedDays,
      lectureDays,
      percentage: lectureDays
        ? Math.round((attendedDays / lectureDays) * 100)
        : 0,
    };
  });
};

const groupItemsByCourseAndSection = (items) =>
  items.reduce((courses, item) => {
    const courseName = item.course || "General Course";
    const sectionName =
      item.section || item.module || `Day ${item.unlockDay || 1}`;
    if (!courses[courseName]) courses[courseName] = {};
    if (!courses[courseName][sectionName])
      courses[courseName][sectionName] = [];
    courses[courseName][sectionName].push(item);
    return courses;
  }, {});

const getLessonId = (lesson) => lesson.lessonId || lesson.id;

const getResourceAction = (resource) => {
  if (resource.downloadUrl)
    return { label: "Download", href: resource.downloadUrl };
  return { label: "Resource coming soon", href: "" };
};

const LmsDashboard = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [login, setLogin] = useState({ email: "", whatsapp: "" });
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [completedLessonIds, setCompletedLessonIds] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setStudent(JSON.parse(saved));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!student?.id) return;

    const refreshStudent = async () => {
      try {
        const studentSnap = await getDoc(
          doc(db, "scholarshipApplications", student.id),
        );
        if (!studentSnap.exists()) return;
        const latestStudent = { id: studentSnap.id, ...studentSnap.data() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latestStudent));
        setStudent(latestStudent);
      } catch (error) {
        console.error("Unable to refresh student profile:", error);
      }
    };

    refreshStudent();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id || !isInstructorLedStudent(student)) {
      setAttendanceRecords([]);
      return;
    }

    const fetchAttendanceRecords = async () => {
      try {
        const sessionSnapshot = await getDocs(
          collection(db, "attendanceSessions"),
        );
        const allRecords = [];

        for (const sessionDoc of sessionSnapshot.docs) {
          const recordsSnapshot = await getDocs(
            collection(db, "attendanceSessions", sessionDoc.id, "records"),
          );

          recordsSnapshot.docs.forEach((recordDoc) => {
            const record = recordDoc.data();

            if (record.studentId === student.id) {
              allRecords.push({
                id: recordDoc.id,
                ...record,
              });
            }
          });
        }

        setAttendanceRecords(
          allRecords.sort((a, b) =>
            String(b.dateKey || "").localeCompare(String(a.dateKey || "")),
          ),
        );
      } catch (error) {
        console.error("Unable to load attendance records:", error);
        setAttendanceRecords([]);
      }
    };

    fetchAttendanceRecords();
  }, [student]);

  useEffect(() => {
    if (!student) return;
    if (isLiveClassStudent(student) && !isSelfPacedStudent(student)) {
      setLessons([]);
      setResources([]);
      setCompletedLessonIds([]);
      setSelectedLessonId("");
      setDataError("");
      setLoading(false);
      return;
    }

    const fetchLmsData = async () => {
      setLoading(true);
      setDataError("");
      const lessonQuery = query(
        collection(db, "curriculum"),
        where("isPublished", "==", true),
        orderBy("globalOrder", "asc"),
      );

      const resourceQuery = query(
        collection(db, "lmsResources"),
        where("isPublished", "==", true),
      );
      const progressId = getProgressId(student);
      const [
        lessonSnapshot,
        resourceSnapshot,
        progressSnapshot,
        legacyProgressSnapshot,
      ] = await Promise.all([
        getDocs(lessonQuery),
        getDocs(resourceQuery),
        getDoc(doc(db, "progress", progressId)),
        getDoc(doc(db, "studentProgress", progressId)),
      ]);

      const lessonData = lessonSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        type: "video",
      }));
      const resourceData = resourceSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        type: "resource",
      }));
      const progress = progressSnapshot.exists()
        ? progressSnapshot.data()
        : legacyProgressSnapshot.exists()
          ? legacyProgressSnapshot.data()
          : {};
      const firstUnlockedLesson = lessonData.find((item) =>
        isItemUnlocked(item, student),
      );

      setLessons(lessonData);
      setResources(resourceData);
      setCompletedLessonIds(progress.completedLessonIds || []);
      setSelectedLessonId(
        progress.lastWatchedLessonId ||
          (firstUnlockedLesson ? getLessonId(firstUnlockedLesson) : ""),
      );
      setLoading(false);
    };

    fetchLmsData().catch((error) => {
      console.error(error);
      setDataError(
        "Unable to load LMS curriculum right now. Please refresh or contact support.",
      );
      setLoading(false);
    });
  }, [student]);

  const items = useMemo(
    () => sortLmsItems([...resources, ...lessons]),
    [lessons, resources],
  );
  const groupedItems = useMemo(
    () => groupItemsByCourseAndSection(items),
    [items],
  );
  const selectedLesson = lessons.find(
    (lesson) => getLessonId(lesson) === selectedLessonId,
  );
  const programDay = getStudentProgramDay(student);
  const progressPercentage = calculateProgressPercentage(
    completedLessonIds,
    lessons,
  );
  const nextLesson = lessons.find(
    (lesson) =>
      isItemUnlocked(lesson, student) &&
      !completedLessonIds.includes(getLessonId(lesson)),
  );
  const courseName = getStudentCourse(student) || "Your Course";
  const isLiveOnlyStudent =
    isInstructorLedStudent(student) && !isSelfPacedStudent(student);
  const attendanceSummary = buildAttendanceSummary(student, attendanceRecords);
  const primaryAttendance = attendanceSummary[0] || {
    track: courseName,
    attendedDays: 0,
    lectureDays: 0,
    percentage: 0,
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      if (!login.email.trim() && !normalizePhone(login.whatsapp)) {
        setAuthError(
          "Enter your enrollment email or WhatsApp/phone number to continue.",
        );
        return;
      }

      const snapshots = await Promise.all(
        buildLoginQueries(login).map((loginQuery) => getDocs(loginQuery)),
      );
      const match = findEligibleStudent(uniqueDocs(snapshots), login);

      if (!match) {
        setAuthError(
          "No enrolled student was found with that email or WhatsApp/phone number.",
        );
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
      setStudent(match);
      navigate("/lms", { replace: true });
    } catch (error) {
      console.error(error);
      setAuthError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (lesson) => {
    const lessonId = getLessonId(lesson);
    const updatedCompleted = [...new Set([...completedLessonIds, lessonId])];
    setCompletedLessonIds(updatedCompleted);
    await saveStudentProgress({
      db,
      student,
      completedLessonIds: updatedCompleted,
      lastWatchedLessonId: lessonId,
      lessons,
    });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStudent(null);
    navigate("/lms", { replace: true });
  };

  if (!student) {
    return (
      <main className="lms-page">
        <Navbar />
        <section className="lms-login-shell">
          <div className="lms-login-visual" aria-hidden="true">
            <div className="lms-orb lms-orb-one" />
            <div className="lms-orb lms-orb-two" />
            <div className="lms-preview-card lms-preview-main">
              <span>Learning path</span>
              <strong>Professional tech skills</strong>
              <p>
                Access lessons, resources, attendance updates, and program
                guidance in one secure portal.
              </p>
            </div>
            <div className="lms-preview-card lms-preview-small">
              <strong>92%</strong>
              <span>Career-ready curriculum</span>
            </div>
          </div>
          <div className="lms-login-card">
            <span>Student Portal</span>
            <h1>Welcome back to OVTech Academy</h1>
            <p>
              Sign in with the email address or WhatsApp/phone number used for
              enrollment to continue your learning journey.
            </p>
            <form onSubmit={handleLogin}>
              <label>
                Email address
                <input
                  type="email"
                  value={login.email}
                  onChange={(e) =>
                    setLogin((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </label>
              <label>
                WhatsApp/phone number
                <input
                  type="tel"
                  value={login.whatsapp}
                  onChange={(e) =>
                    setLogin((prev) => ({ ...prev, whatsapp: e.target.value }))
                  }
                />
              </label>
              {authError && <p className="lms-error">{authError}</p>}
              <button type="submit" disabled={loading}>
                {loading ? "Checking..." : "Enter LMS"}
              </button>
            </form>
            <div className="lms-login-support">
              <strong>Need help?</strong>
              <span>
                Contact support if your enrollment details have changed.
              </span>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="lms-page">
      <Navbar />
      <section className="lms-hero">
        <div>
          <span>Welcome back, {getStudentName(student)}</span>
          <h1>{courseName}</h1>
          <p>
            Package: {getEnrollmentPackage(student) || "OVTech Program"}
            {!isLiveOnlyStudent && ` • Day ${programDay}`}
          </p>
        </div>
        <button onClick={logout}>Logout</button>
      </section>
      {isLiveOnlyStudent ? (
        <section className="lms-progress-card lms-attendance-card">
          <div className="lms-attendance-header">
            <div>
              <span>Live class attendance</span>
              <strong>{primaryAttendance.percentage}% attendance</strong>
              <p>
                {primaryAttendance.attendedDays} of{" "}
                {primaryAttendance.lectureDays} lecture
                {primaryAttendance.lectureDays === 1 ? "" : "s"} attended for{" "}
                {primaryAttendance.track}.
              </p>
            </div>
            <div className="lms-attendance-score">
              <strong>{primaryAttendance.attendedDays}</strong>
              <span>Days Present</span>
            </div>
          </div>
          <div className="lms-progress">
            <span style={{ width: `${primaryAttendance.percentage}%` }} />
          </div>
          <div className="lms-attendance-grid">
            {attendanceSummary.map((item) => (
              <article key={item.track}>
                <strong>{item.track}</strong>
                <p>
                  {item.attendedDays} / {item.lectureDays} lectures attended
                </p>
                <small>{item.percentage}% attendance rate</small>
              </article>
            ))}
          </div>
          <div className="lms-attendance-history">
            <h2>Attendance history</h2>
            {attendanceRecords.length ? (
              attendanceRecords.slice(0, 8).map((record) => (
                <div key={`${record.sessionId}-${record.id}`}>
                  <span>{formatAttendanceDate(record.dateKey)}</span>
                  <strong>{record.track || primaryAttendance.track}</strong>
                  <em>Present</em>
                </div>
              ))
            ) : (
              <p>
                Your marked class days will appear here after attendance is
                submitted.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="lms-progress-card">
          <div>
            <strong>{progressPercentage}% complete</strong>
            <p>Next lesson: {nextLesson?.title || "You are caught up."}</p>
          </div>
          <div className="lms-progress">
            <span style={{ width: `${progressPercentage}%` }} />
          </div>
        </section>
      )}
      {dataError && <section className="lms-alert">{dataError}</section>}
      {!isLiveOnlyStudent && (
        <section className="lms-layout">
          <aside className="lms-list">
            <h2>Courses & sections</h2>
            {Object.entries(groupedItems).map(([course, sections]) => (
              <div className="lms-course-group" key={course}>
                <h3>{course}</h3>
                {Object.entries(sections).map(([section, sectionItems]) => (
                  <div
                    className="lms-section-group"
                    key={`${course}-${section}`}
                  >
                    <h4>{section}</h4>
                    {sectionItems.map((item) => {
                      const unlocked = isItemUnlocked(item, student);
                      const lessonId = getLessonId(item);
                      const complete =
                        item.type === "video" &&
                        completedLessonIds.includes(lessonId);
                      return (
                        <button
                          key={item.id || lessonId || item.resourceId}
                          className={
                            selectedLessonId === lessonId ? "active" : ""
                          }
                          disabled={!unlocked}
                          onClick={() =>
                            item.type === "video" &&
                            unlocked &&
                            setSelectedLessonId(lessonId)
                          }
                        >
                          <span>
                            {item.type === "resource"
                              ? unlocked
                                ? "📎 Resource"
                                : "🔒 Locked resource"
                              : complete
                                ? "✅ Completed"
                                : unlocked
                                  ? "▶ Lesson"
                                  : "🔒 Locked lesson"}
                          </span>
                          <strong>{item.title || item.fileName}</strong>
                          <small>
                            {item.fileType || "Video"} • Day{" "}
                            {item.unlockDay || 1}
                          </small>
                          {item.type === "resource" &&
                            unlocked &&
                            (() => {
                              const action = getResourceAction(item);
                              return action.href ? (
                                <a
                                  href={action.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {action.label}
                                </a>
                              ) : (
                                <em>{action.label}</em>
                              );
                            })()}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </aside>
          <section className="lms-player-card">
            {selectedLesson ? (
              <>
                <h2>{selectedLesson.title}</h2>
                {getSafeYouTubeEmbedUrl(selectedLesson.youtubeUrl) ? (
                  <iframe
                    src={getSafeYouTubeEmbedUrl(selectedLesson.youtubeUrl)}
                    title={selectedLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <p className="lms-error">
                    This lesson needs a valid YouTube URL.
                  </p>
                )}
                <button
                  onClick={() => handleComplete(selectedLesson)}
                  disabled={completedLessonIds.includes(
                    getLessonId(selectedLesson),
                  )}
                >
                  {completedLessonIds.includes(getLessonId(selectedLesson))
                    ? "Completed"
                    : "Mark lesson as completed"}
                </button>
              </>
            ) : (
              <p>Select an unlocked lesson to start watching.</p>
            )}
          </section>
        </section>
      )}
      <Footer />
    </main>
  );
};

export default LmsDashboard;
