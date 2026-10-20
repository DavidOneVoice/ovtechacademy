import PortalLogin from "../components/PortalLogin";
import PortalProfile from "../components/PortalProfile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Certificate from "../components/certificate/Certificate";
import { db } from "../src/firebase";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import { createPublicAlumniRecord, publicAlumniRef } from "../services/publicAlumni";
import { getSafeYouTubeEmbedUrl } from "../lms/youtube";
import { getResourceAction } from "../lms/resourceLinks";
import {
  filterItemsForCurriculumGroup,
  getResourceDebugRows,
  getStudentResourceQuery,
  isCurriculumLesson,
  LMS_CURRICULUM_COLLECTION,
  LMS_RESOURCE_COLLECTION,
  snapshotItems,
} from "../lms/content";
import { resolveStudentCurriculumGroup } from "../lms/tracks";
import { normalizeProgrammeName } from "../data/programmes";
import { cohortLabel, recordCohortId } from "../data/cohort";
import {
  buildAttendanceSummary,
  deduplicateAttendanceRecords,
  groupCurriculumItems,
} from "../lms/programmeViews";
import {
  filterLiveSessionsForStudent,
  getEnrollmentPackage,
  getStudentLiveSessionQuery,
  isInstructorLedStudent,
  isLiveClassStudent,
  isSelfPacedStudent,
} from "../lms/liveSessions";
import {
  STUDENT_EMAIL_FIELDS,
  STUDENT_PHONE_FIELDS,
} from "../lms/enrollment";
import { portalRequest, requirePortalStudent } from "../lms/portalClient";
import { portalIdentifierForStudent } from "../lms/portalProfile";
import { createPortalSessionScope, recheckPortalSession } from "../lms/portalSession";
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

const LEGACY_STORAGE_KEY = "ovtech_lms_student";
const CERTIFICATE_PROFILE_COLLECTION = "certificateProfile";
const emptyCertificateForm = () => ({
  displayName: "", professionalEmail: "", phone: "", linkedin: "", facebook: "",
  instagram: "", twitter: "", tiktok: "", photoUrl: "", showInAlumniDirectory: true,
});

const hasValue = (value) => String(value || "").trim().length > 0;

const getStudentName = (student) =>
  student?.fullName || student?.name || student?.studentName || "Student";
const getStudentCourse = (student) =>
  normalizeProgrammeName(
    student?.track ||
      student?.course ||
      student?.courseName ||
      student?.program ||
      "",
  );

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

const groupItemsByCourseAndSection = groupCurriculumItems;

const getLessonId = (lesson) => lesson.lessonId || lesson.id;


const formatSessionDate = (dateKey) => {
  if (!dateKey) return "Date pending";
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

const LmsDashboard = () => {
  const navigate = useNavigate();
  const playerRef = useRef(null);
  const portalScope = useRef(null);
  if (portalScope.current === null) portalScope.current = createPortalSessionScope();
  const [student, setStudent] = useState(null);
  const [pinRequired, setPinRequired] = useState(false);
  const [authHint, setAuthHint] = useState({ identifier: "", message: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [lmsSettings, setLmsSettings] = useState({});
  const [completedLessonIds, setCompletedLessonIds] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [activePanel, setActivePanel] = useState("overview");
  const [isAttendanceHistoryOpen, setIsAttendanceHistoryOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState("");
  const [certificateProfile, setCertificateProfile] = useState(null);
  const [certificateForm, setCertificateForm] = useState(emptyCertificateForm);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateUploading, setCertificateUploading] = useState(false);
  const [certificateError, setCertificateError] = useState("");
  const [certificateSaveMessage, setCertificateSaveMessage] = useState("");
  const [editingCertificate, setEditingCertificate] = useState(false);
  const [alumniVisibilitySaving, setAlumniVisibilitySaving] = useState(false);
  const [alumniVisibilityMessage, setAlumniVisibilityMessage] = useState("");
  // A restored enrollment may change cohort/course while an earlier request
  // is finishing. Re-check the rendered list immediately against this student.
  const visibleLiveSessions = useMemo(() =>
    filterLiveSessionsForStudent(liveSessions, student), [liveSessions, student]);

  const resetStudentData = useCallback(() => {
    setCertificateProfile(null); setCertificateForm(emptyCertificateForm());
    setCertificateLoading(false); setCertificateUploading(false); setCertificateError("");
    setCertificateSaveMessage(""); setEditingCertificate(false);
    setAlumniVisibilitySaving(false); setAlumniVisibilityMessage("");
    setLessons([]); setResources([]); setLmsSettings({}); setCompletedLessonIds([]);
    setAttendanceRecords([]); setLiveSessions([]); setIsAttendanceHistoryOpen(false);
    setSelectedLessonId(""); setDataError(""); setAuthBusy(false);
  }, []);

  const clearPortal = useCallback((hint = { identifier: "", message: "" }) => {
    portalScope.current.invalidate();
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Storage may be disabled. */ }
    resetStudentData();
    setStudent(null); setPinRequired(false); setAuthHint(hint); setAuthError("");
    setLoading(false); setActivePanel("overview");
    navigate("/lms", { replace: true });
  }, [navigate, resetStudentData]);

  useEffect(() => () => portalScope.current.invalidate(), []);

  useEffect(() => {
    const controller = new AbortController();
    const restoreSession = async () => {
      try {
        // A saved browser object is never authentication. Only the server can
        // restore its cookie session and re-check the current PIN version.
        try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Storage may be disabled. */ }
        const session = requirePortalStudent(await portalRequest("restore", {}, controller.signal));
        if (controller.signal.aborted) return;
        portalScope.current.invalidate();
        resetStudentData();
        setStudent(session.student); setPinRequired(session.pinRequired);
      } catch (error) {
        if (!controller.signal.aborted && error.status !== 401) {
          setAuthError(error.message || "We could not refresh your portal session. Please sign in again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    restoreSession();
    return () => controller.abort();
  }, [resetStudentData]);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    let controller;
    let checking = false;
    const currentSession = portalScope.current.capture();
    const isCurrent = () => !cancelled && currentSession();
    const recheck = async () => {
      if (checking || document.visibilityState === "hidden" || !isCurrent()) return;
      checking = true;
      controller = new AbortController();
      const outcome = await recheckPortalSession({ student, pinRequired, signal: controller.signal, isCurrent });
      if (!isCurrent()) return;
      checking = false;
      if (outcome.stage === "expired") {
        clearPortal({ identifier: portalIdentifierForStudent(student), message: outcome.message });
      } else if (outcome.stage === "error") {
        setAuthError(outcome.message);
      } else if (outcome.stage !== "stale") {
        setAuthError("");
        if (outcome.stage === "updated") {
          setStudent(outcome.session.student); setPinRequired(outcome.session.pinRequired);
        }
      }
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      cancelled = true; controller?.abort();
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [student, pinRequired, clearPortal]);

  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    const currentSession = portalScope.current.capture();
    const isCurrent = () => !cancelled && currentSession();

    const loadCertificateProfile = async () => {
      const profileRef = doc(
        db,
        CERTIFICATE_PROFILE_COLLECTION,
        student.id,
      );
      // Keep the original enrollment document ID returned by the portal server.
      try {
        const profileSnapshot = await getDoc(profileRef);
        if (!isCurrent()) return;
        if (profileSnapshot.exists()) {
          setCertificateProfile({
            id: profileSnapshot.id,
            ...profileSnapshot.data(),
          });
        } else {
          setCertificateForm((current) => ({
            ...current,
            professionalEmail: current.professionalEmail || STUDENT_EMAIL_FIELDS.map((key) => student[key]).find(hasValue) || "",
            phone: current.phone || STUDENT_PHONE_FIELDS.map((key) => student[key]).find(hasValue) || "",
            showInAlumniDirectory: true,
          }));
        }
      } catch (error) {
        if (isCurrent()) console.error("Unable to load certificate profile:", error);
      }
    };

    loadCertificateProfile();
    return () => { cancelled = true; };
  }, [student]);

  useEffect(() => {
    if (!student?.id || !isInstructorLedStudent(student)) {
      setAttendanceRecords([]);
      return;
    }
    let cancelled = false;
    const currentSession = portalScope.current.capture();
    const isCurrent = () => !cancelled && currentSession();

    const fetchAttendanceRecords = async () => {
      try {
        const sessionSnapshot = await getDocs(
          collection(db, "attendanceSessions"),
        );
        if (!isCurrent()) return;
        const allRecords = [];

        for (const sessionDoc of sessionSnapshot.docs) {
          const parentSession = sessionDoc.data();
          const recordsSnapshot = await getDocs(
            collection(db, "attendanceSessions", sessionDoc.id, "records"),
          );
          if (!isCurrent()) return;

          recordsSnapshot.docs.forEach((recordDoc) => {
            const record = recordDoc.data();

            if (record.studentId === student.id) {
              allRecords.push({
                id: recordDoc.id,
                ...record,
                // Record IDs repeat across sessions; the parent remains the
                // authoritative identity for history and deduplication.
                parentSessionId: sessionDoc.id,
                sessionId: sessionDoc.id,
                track: record.track || parentSession.track,
                dateKey: record.dateKey || parentSession.dateKey,
                cohortId: recordCohortId(parentSession),
              });
            }
          });
        }

        setAttendanceRecords(
          deduplicateAttendanceRecords(student, allRecords).sort((a, b) =>
            String(b.dateKey || "").localeCompare(String(a.dateKey || "")),
          ),
        );
      } catch (error) {
        if (!isCurrent()) return;
        console.error("Unable to load attendance records:", error);
        setAttendanceRecords([]);
      }
    };

    fetchAttendanceRecords();
    return () => { cancelled = true; };
  }, [student]);


  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    const currentSession = portalScope.current.capture();
    const isCurrent = () => !cancelled && currentSession();

    const fetchLiveSessions = async () => {
      try {
        const constraints = getStudentLiveSessionQuery(student);
        if (!constraints) {
          if (isCurrent()) setLiveSessions([]);
          return;
        }
        const liveSnapshot = await getDocs(
          query(collection(db, "liveSessions"),
            ...constraints.map(({ field, value }) => where(field, "==", value))),
        );
        if (!isCurrent()) return;
        setLiveSessions(
          filterLiveSessionsForStudent(liveSnapshot.docs
            .map((item) => ({ id: item.id, ...item.data() })), student),
        );
      } catch (error) {
        if (!isCurrent()) return;
        console.error("Unable to load live sessions:", error);
        setLiveSessions([]);
      }
    };

    fetchLiveSessions();
    return () => { cancelled = true; };
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
    let cancelled = false;
    const currentSession = portalScope.current.capture();
    const isCurrent = () => !cancelled && currentSession();

    const fetchLmsData = async () => {
      setLoading(true);
      setDataError("");
      const curriculumGroup = resolveStudentCurriculumGroup(student);
      const lessonQuery = query(
        collection(db, LMS_CURRICULUM_COLLECTION),
        where("isPublished", "==", true),
        orderBy("globalOrder", "asc"),
      );

      const resourceQuery = getStudentResourceQuery(db);
      const progressId = getProgressId(student);
      const [
        lessonSnapshot,
        resourceSnapshot,
        progressSnapshot,
        legacyProgressSnapshot,
        programmeSettingsSnapshot,
        legacySettingsSnapshot,
      ] = await Promise.all([
        getDocs(lessonQuery),
        getDocs(resourceQuery),
        getDoc(doc(db, "progress", progressId)),
        getDoc(doc(db, "studentProgress", progressId)),
        getDoc(doc(db, "lmsSettings", "selfPacedStartDates")),
        getDoc(doc(db, "lmsSettings", "selfPaced")),
      ]);
      if (!isCurrent()) return;

      let canonicalResourceSnapshot = resourceSnapshot;
      if (import.meta.env.DEV) {
        try {
          const serverResourceSnapshot = await getDocsFromServer(resourceQuery);
          const normalIds = new Set(resourceSnapshot.docs.map(({ id }) => id));
          const serverIds = new Set(serverResourceSnapshot.docs.map(({ id }) => id));
          console.info("Student resource cache/server diagnostic", {
            normalQueryResourceCount: normalIds.size,
            serverQueryResourceCount: serverIds.size,
            normalButAbsentFromServer: [...normalIds].filter((id) => !serverIds.has(id)),
          });
          canonicalResourceSnapshot = serverResourceSnapshot;
        } catch (error) {
          console.warn("Student resource server diagnostic unavailable:", error);
        }
      }
      if (!isCurrent()) return;

      const lessonData = curriculumGroup
        ? filterItemsForCurriculumGroup(
            snapshotItems(lessonSnapshot, LMS_CURRICULUM_COLLECTION)
              .filter(isCurriculumLesson)
              .map((item) => ({ ...item, type: "video" })),
            curriculumGroup,
          )
        : [];
      const resourceData = curriculumGroup
        ? filterItemsForCurriculumGroup(
            snapshotItems(canonicalResourceSnapshot, LMS_RESOURCE_COLLECTION)
              .map((item) => ({ ...item, type: "resource" })),
            curriculumGroup,
          )
        : [];
      if (import.meta.env.DEV) {
        console.info("STUDENT RESOURCE IDS", resourceData.map(({ id }) => id));
        console.table(getResourceDebugRows(resourceData));
      }
      const progress = progressSnapshot.exists()
        ? progressSnapshot.data()
        : legacyProgressSnapshot.exists()
          ? legacyProgressSnapshot.data()
          : {};
      const settings = {
        ...(legacySettingsSnapshot.exists()
          ? legacySettingsSnapshot.data()
          : {}),
        startDates: programmeSettingsSnapshot.exists()
          ? programmeSettingsSnapshot.data()
          : {},
      };
      const sortedLessons = sortLmsItems(lessonData);
      const firstUnlockedLesson = sortedLessons.find((item) =>
        isItemUnlocked(item, student, new Date(), settings, curriculumGroup),
      );

      setLmsSettings(settings);
      setLessons(lessonData);
      setResources(resourceData);
      setCompletedLessonIds(progress.completedLessonIds || []);
      const savedLesson = lessonData.find(
        (lesson) => getLessonId(lesson) === progress.lastWatchedLessonId,
      );
      const savedLessonIsUnlocked = savedLesson
        ? isItemUnlocked(
            savedLesson,
            student,
            new Date(),
            settings,
            curriculumGroup,
          )
        : false;

      setSelectedLessonId(
        savedLessonIsUnlocked
          ? progress.lastWatchedLessonId
          : firstUnlockedLesson
            ? getLessonId(firstUnlockedLesson)
            : "",
      );
      setLoading(false);
    };

    fetchLmsData().catch((error) => {
      if (!isCurrent()) return;
      console.error(error);
      setDataError(
        "Unable to load LMS curriculum right now. Please refresh or contact support.",
      );
      setLoading(false);
    });
    return () => { cancelled = true; };
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
  const curriculumGroup = resolveStudentCurriculumGroup(student);
  const programDay = getStudentProgramDay(
    student,
    new Date(),
    lmsSettings,
    curriculumGroup,
  );
  const progressPercentage = calculateProgressPercentage(
    completedLessonIds,
    lessons,
  );
  const nextLesson = lessons.find(
    (lesson) =>
      isItemUnlocked(
        lesson,
        student,
        new Date(),
        lmsSettings,
        curriculumGroup,
      ) &&
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

  const signedIn = (session) => {
    portalScope.current.invalidate();
    resetStudentData();
    setAuthError(""); setAuthHint({ identifier: "", message: "" });
    setStudent(session.student); setPinRequired(session.pinRequired);
    setActivePanel("overview"); setLoading(false);
    navigate("/lms", { replace: true });
  };

  const handleComplete = async (lesson) => {
    if (!student?.id) return;
    const isCurrent = portalScope.current.capture();
    const lessonId = getLessonId(lesson);
    const updatedCompleted = [...new Set([...completedLessonIds, lessonId])];
    setCompletedLessonIds(updatedCompleted);
    try {
      await saveStudentProgress({
        db, student, completedLessonIds: updatedCompleted,
        lastWatchedLessonId: lessonId, lessons,
      });
    } catch {
      if (isCurrent()) setDataError("We could not save your lesson progress. Please try again.");
    }
  };

  const logout = async () => {
    const isCurrent = portalScope.current.capture();
    setAuthBusy(true); setAuthError("");
    try { await portalRequest("logout"); if (isCurrent()) clearPortal(); }
    catch (error) { if (isCurrent()) setAuthError(error.message || "We could not sign you out. Please try again."); }
    finally { if (isCurrent()) setAuthBusy(false); }
  };

  const pinSaved = () => clearPortal({
    identifier: portalIdentifierForStudent(student),
    message: "Your PIN is saved. Continue with your registered email or phone, then enter your new PIN to sign in.",
  });

  const handleCertificateField = (event) => {
    const { checked, name, type, value } = event.target;
    setCertificateForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCertificatePhoto = async (event) => {
    if (!student?.id) return;
    const isCurrent = portalScope.current.capture();
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setCertificateError("Please choose a JPG, JPEG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }

    setCertificateUploading(true);
    setCertificateError("");
    try {
      const photoUrl = await uploadImageToCloudinary(file);
      if (isCurrent()) setCertificateForm((current) => ({ ...current, photoUrl }));
    } catch (error) {
      if (isCurrent()) setCertificateError(error.message || "Unable to upload this photo.");
    } finally {
      if (isCurrent()) setCertificateUploading(false);
    }
  };

  const handleCertificateSubmit = async (event) => {
    event.preventDefault();
    if (!student?.id || !certificateForm.displayName.trim() || !certificateForm.photoUrl) return;
    const isCurrent = portalScope.current.capture();

    setCertificateLoading(true);
    setCertificateError("");
    setCertificateSaveMessage("Saving alumni profile...");
    const isResubmission = certificateProfile?.status === "Changes Requested";
    const profile = {
      studentId: student.id,
      course: student.course || student.courseName || student.program || courseName,
      track: student.track || courseName,
      photoUrl: certificateForm.photoUrl,
      displayName: certificateForm.displayName.trim(),
      professionalEmail: certificateForm.professionalEmail.trim(),
      phone: certificateForm.phone.trim(),
      linkedin: certificateForm.linkedin.trim(),
      facebook: certificateForm.facebook.trim(),
      instagram: certificateForm.instagram.trim(),
      twitter: certificateForm.twitter.trim(),
      tiktok: certificateForm.tiktok.trim(),
      showInAlumniDirectory: certificateForm.showInAlumniDirectory === true,
      status: "Pending",
      updatedAt: serverTimestamp(),
      adminMessage: null,
    };

    try {
      const profileRef = doc(
        db,
        CERTIFICATE_PROFILE_COLLECTION,
        student.id,
      );
      if (isResubmission) {
        await setDoc(profileRef, profile, { merge: true });
        if (!isCurrent()) return;
        setCertificateProfile((current) => ({ ...current, ...profile }));
      } else {
        const newProfile = { ...profile, submittedAt: serverTimestamp() };
        await setDoc(profileRef, newProfile);
        if (!isCurrent()) return;
        setCertificateProfile(newProfile);
      }
      setEditingCertificate(false);
      setCertificateSaveMessage("Your certificate application and alumni profile preferences were saved.");
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Unable to submit certificate application:", error);
      setCertificateError("Unable to submit your application. Please try again.");
      setCertificateSaveMessage("");
    } finally {
      if (isCurrent()) setCertificateLoading(false);
    }
  };

  const editCertificateProfile = () => {
    setCertificateForm({
      displayName: certificateProfile.displayName || "",
      professionalEmail: certificateProfile.professionalEmail || certificateProfile.email || "",
      phone: certificateProfile.phone || certificateProfile.whatsapp || "",
      linkedin: certificateProfile.linkedin || "", facebook: certificateProfile.facebook || "",
      instagram: certificateProfile.instagram || "", twitter: certificateProfile.twitter || "",
      tiktok: certificateProfile.tiktok || "", photoUrl: certificateProfile.photoUrl || "",
      showInAlumniDirectory: certificateProfile.showInAlumniDirectory !== false,
    });
    setCertificateError("");
    setEditingCertificate(true);
  };

  const updateAlumniVisibility = async (event) => {
    const consent = event.target.checked;
    if (!student?.id || certificateProfile?.status !== "Approved" || !certificateProfile.certificateId) return;
    const isCurrent = portalScope.current.capture();
    const previousConsent = certificateProfile.showInAlumniDirectory === true;
    setAlumniVisibilitySaving(true);
    setCertificateProfile((current) => ({ ...current, showInAlumniDirectory: consent }));
    setAlumniVisibilityMessage("Saving alumni profile...");
    const profileRef = doc(db, CERTIFICATE_PROFILE_COLLECTION, student.id);
    const alumniRef = publicAlumniRef(certificateProfile.certificateId);
    try {
      const batch = writeBatch(db);
      batch.update(profileRef, { showInAlumniDirectory: consent, updatedAt: serverTimestamp() });
      if (consent) batch.set(alumniRef, createPublicAlumniRecord({ profile: certificateProfile, certificateId: certificateProfile.certificateId }));
      else batch.delete(alumniRef);
      await batch.commit();
      if (!isCurrent()) return;
      setAlumniVisibilityMessage("Your alumni directory visibility has been updated.");
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Unable to update alumni directory visibility:", error);
      setCertificateProfile((current) => ({ ...current, showInAlumniDirectory: previousConsent }));
      setAlumniVisibilityMessage("We could not update your alumni directory visibility. Please try again.");
    } finally { if (isCurrent()) setAlumniVisibilitySaving(false); }
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
          <PortalLogin key={loading ? "restoring" : "ready"} restoring={loading}
            initialIdentifier={authHint.identifier} initialMessage={authHint.message}
            initialError={authError} onSignedIn={signedIn} />
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="lms-page">
      <Navbar />
      <section className="lms-portal-shell">
        <aside className="lms-sidebar">
          <div className="lms-sidebar-profile"><span>Student Dashboard</span><strong>{getStudentName(student)}</strong><small>{courseName}</small></div>
          <button className={activePanel === "overview" ? "active" : ""} onClick={() => setActivePanel("overview")}>Overview</button>
          <button className={activePanel === "live" ? "active" : ""} onClick={() => setActivePanel("live")}>See live sessions</button>
          {!isLiveOnlyStudent && <button className={activePanel === "lessons" ? "active" : ""} onClick={() => setActivePanel("lessons")}>Curriculum</button>}
          <button onClick={() => setIsAttendanceHistoryOpen(true)}>Attendance history</button>
          <button className={activePanel === "certificate" ? "active" : ""} onClick={() => setActivePanel("certificate")}>Certificate</button>
          <button className={activePanel === "profile" ? "active" : ""} onClick={() => setActivePanel("profile")}>My profile</button>
          <button className="lms-sidebar-logout" disabled={authBusy} onClick={logout}>{authBusy ? "Signing out…" : "Logout"}</button>
        </aside>
        <div className="lms-main-panel">
      <section className="lms-hero">
        <div>
          <span>Welcome back, {getStudentName(student)}</span>
          <h1>{courseName}</h1>
          <p>
            Package: {getEnrollmentPackage(student) || "OVTech Program"}
            {!isLiveOnlyStudent && ` • Day ${programDay}`}
          </p>
        </div>
        <button disabled={authBusy} onClick={logout}>{authBusy ? "Signing out…" : "Logout"}</button>
      </section>
      {authError && <p className="lms-error" role="alert">{authError}</p>}
      {activePanel === "profile" && <PortalProfile key={student.id} student={student} pinRequired={pinRequired}
        onUpdated={(session) => { setStudent(session.student); setPinRequired(session.pinRequired); }} onPinSaved={pinSaved} />}
      {activePanel === "overview" && <section className="portal-profile-reminder"><div><strong>{pinRequired ? "Keep your enrollment details correct" : "Create your student PIN"}</strong><p>{pinRequired ? "Update your name, email or WhatsApp number and manage your student PIN in My profile." : "Check your name, email and WhatsApp number, then create a PIN for signing in to your student portal."}</p></div><button type="button" onClick={() => setActivePanel("profile")}>{pinRequired ? "Open my profile" : "Check profile & create PIN"}</button></section>}
      {activePanel === "certificate" && (
        <section className="certificate-page">
          {certificateProfile?.status === "Approved" && !editingCertificate ? (<>
            <Certificate
              profile={certificateProfile}
              studentName={getStudentName(student)}
              courseName={courseName}
              durationWeeks={student?.durationWeeks}
            />
            <section className="alumni-visibility" aria-labelledby="alumni-visibility-title">
              <div><span>Public graduate profile</span><h2 id="alumni-visibility-title">Alumni Directory Visibility</h2><strong>{certificateProfile.showInAlumniDirectory === true ? "Listed publicly" : "Not listed publicly"}</strong></div>
              <label><input type="checkbox" checked={certificateProfile.showInAlumniDirectory === true} onChange={updateAlumniVisibility} disabled={alumniVisibilitySaving} /> Show my profile in the OVTech Academy Alumni Directory.</label>
              <p>Your name, professional photo, course, completion date and selected professional links may be displayed publicly. You can withdraw this permission later.</p>
              {alumniVisibilityMessage && <p className={alumniVisibilitySaving ? "alumni-saving" : ""} role="status">{alumniVisibilitySaving && <span className="alumni-spinner" aria-hidden="true" />}{alumniVisibilityMessage}</p>}
            </section>
          </>
          ) : certificateProfile?.status === "Revoked" && !editingCertificate ? (
            <div className="certificate-status-card certificate-revoked-card">
              <span>Certificate Status</span>
              <h2>Certificate Revoked</h2>
              <p className="certificate-status-lead">This certificate is no longer active.</p>
              <div className="certificate-admin-message"><span>Reason:</span><p>{certificateProfile.revocationReason}</p></div>
              <p>Please contact OVTech Academy if you believe this was done in error or once the outstanding requirement has been resolved.</p>
            </div>
          ) : certificateProfile && !editingCertificate ? (
            <div className="certificate-status-card">
              <div className="certificate-status-icon" aria-hidden="true">✓</div>
              <span>Certificate Status</span>
              {certificateProfile.status === "Changes Requested" ? <>
                <h2>Changes Required</h2>
                <p className="certificate-status-lead">Your administrator needs you to update your certificate profile.</p>
                <div className="certificate-admin-message"><span>Message from admin</span><p>{certificateProfile.adminMessage}</p></div>
                <button className="certificate-update-button" type="button" onClick={editCertificateProfile}>Update Certificate Profile</button>
              </> : <>
                <h2>Pending Review</h2>
                <p className="certificate-status-lead">Your certificate application has been received.</p>
                <p>Your instructor/admin will review your course completion, attendance and project status before approving your certificate.</p>
                <strong>Please check back later.</strong>
              </>}
            </div>
          ) : (
            <>
              <header className="certificate-heading">
                <span>Student credentials</span>
                <h1>Certificate Application</h1>
                <p>Complete your certificate profile. Your information will be reviewed before a certificate can be issued.</p>
              </header>
              <form className="certificate-form" onSubmit={handleCertificateSubmit}>
                <div className="certificate-photo-field">
                  <div className="certificate-photo-preview">
                    {certificateForm.photoUrl ? <img src={certificateForm.photoUrl} alt="Your professional profile" /> : <span aria-hidden="true">+</span>}
                  </div>
                  <div>
                    <label htmlFor="certificate-photo">Professional Photo <em>Required</em></label>
                    <p>Upload a clear, professional headshot in JPG, JPEG, PNG, or WEBP format.</p>
                    <label className="certificate-upload-button" htmlFor="certificate-photo">{certificateUploading ? "Uploading..." : certificateForm.photoUrl ? "Change photo" : "Upload photo"}</label>
                    <input id="certificate-photo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleCertificatePhoto} disabled={certificateUploading} />
                  </div>
                </div>
                <div className="certificate-field certificate-field-wide">
                  <label htmlFor="certificate-name">Full Name <em>Required</em></label>
                  <input id="certificate-name" name="displayName" value={certificateForm.displayName} onChange={handleCertificateField} placeholder="Enter your full name exactly as you want it to appear on your certificate." required />
                </div>
                <div className="certificate-field certificate-field-wide">
                  <p><strong>Only the contact details you provide here may appear on your public alumni profile.</strong></p>
                  <label htmlFor="certificate-email">Professional Email</label>
                  <input id="certificate-email" name="professionalEmail" type="email" value={certificateForm.professionalEmail} onChange={handleCertificateField} placeholder="Enter the email you would like displayed publicly." />
                  <small>We recommend using a professional email address if you intend to share your certificate with employers.</small>
                </div>
                <div className="certificate-field certificate-field-wide">
                  <label htmlFor="certificate-phone">Professional Phone</label>
                  <input id="certificate-phone" name="phone" type="tel" value={certificateForm.phone} onChange={handleCertificateField} placeholder="Enter the phone number you would like displayed publicly." />
                </div>
                {["LinkedIn", "Facebook", "Instagram", "X (Twitter)", "TikTok"].map((label) => {
                  const name = label === "X (Twitter)" ? "twitter" : label.toLowerCase();
                  return <div className="certificate-field" key={name}><label htmlFor={`certificate-${name}`}>{label}</label><input id={`certificate-${name}`} name={name} type="url" value={certificateForm[name]} onChange={handleCertificateField} placeholder={`https://${name === "twitter" ? "x.com" : `${name}.com`}/yourprofile`} /></div>;
                })}
                <div className="certificate-consent certificate-field-wide">
                  <label><input type="checkbox" name="showInAlumniDirectory" checked={certificateForm.showInAlumniDirectory} onChange={handleCertificateField} disabled={certificateLoading} /> Display my graduate profile in the OVTech Academy Alumni Directory.</label>
                  <p>Your name, professional photo, course, completion date and selected professional links may be displayed publicly. You can withdraw this permission later.</p>
                </div>
                {certificateError && <p className="certificate-error certificate-field-wide" role="alert">{certificateError}</p>}
                {certificateSaveMessage && <p className="certificate-field-wide" role="status">{certificateSaveMessage}</p>}
                <div className="certificate-actions certificate-field-wide">
                  <button type="submit" disabled={!certificateForm.displayName.trim() || !certificateForm.photoUrl || certificateUploading || certificateLoading}>{certificateLoading ? "Saving alumni profile..." : editingCertificate ? "Resubmit for review" : "Submit application"}</button>
                  <small>Only your photo and full name are required.</small>
                </div>
              </form>
            </>
          )}
        </section>
      )}
      {activePanel === "live" && (
        <section className="lms-live-sessions">
          <div className="lms-section-title"><span>Watch live sessions · {cohortLabel(recordCohortId(student))}</span><h2>Published sessions for you</h2></div>
          {visibleLiveSessions.length ? visibleLiveSessions.map((session) => (
            <article className="lms-live-card" key={session.id}>
              <div><span>{formatSessionDate(session.sessionDate)}</span><h3>{session.title}</h3></div>
              {getSafeYouTubeEmbedUrl(session.youtubeUrl) ? <iframe src={getSafeYouTubeEmbedUrl(session.youtubeUrl)} title={session.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <a href={session.youtubeUrl} target="_blank" rel="noreferrer">Open live session</a>}
              {session.attachmentUrl && <a className="lms-download-link" href={session.attachmentUrl} download={session.attachmentName || undefined} target="_blank" rel="noreferrer">Download attached file{session.attachmentName ? `: ${session.attachmentName}` : ""}</a>}
            </article>
          )) : <p className="lms-empty-state">No live sessions have been published for your course in the {cohortLabel(recordCohortId(student))} cohort yet.</p>}
        </section>
      )}
      {activePanel === "overview" && (isLiveOnlyStudent ? (
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
          <button
            type="button"
            className="lms-attendance-history-card"
            onClick={() => setIsAttendanceHistoryOpen(true)}
          >
            <span>Attendance history</span>
            <strong>View all marked class days</strong>
            <p>
              {attendanceRecords.length
                ? `${attendanceRecords.length} attendance ${
                    attendanceRecords.length === 1 ? "record" : "records"
                  } available`
                : "Your marked class days will appear here after attendance is submitted."}
            </p>
          </button>
        </section>
      ) : (
        <section className="lms-progress-card">
          <div>
            <strong>{progressPercentage}% complete</strong>
            <p>
              Next lesson:{" "}
              {lessons.length
                ? nextLesson?.title || "You are caught up."
                : "No lessons available yet."}
            </p>
          </div>
          <div className="lms-progress">
            <span style={{ width: `${progressPercentage}%` }} />
          </div>
        </section>
      ))}
      {isAttendanceHistoryOpen && (
        <div
          className="lms-attendance-modal-overlay"
          role="presentation"
          onClick={() => setIsAttendanceHistoryOpen(false)}
        >
          <section
            className="lms-attendance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lms-attendance-modal-header">
              <div>
                <span>Attendance history</span>
                <h2 id="attendance-history-title">All marked class days</h2>
              </div>
              <button
                type="button"
                aria-label="Close attendance history"
                onClick={() => setIsAttendanceHistoryOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="lms-attendance-history-list">
              {attendanceRecords.length ? (
                attendanceRecords.map((record) => (
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
        </div>
      )}
      {dataError && <section className="lms-alert">{dataError}</section>}
      {activePanel === "lessons" && !isLiveOnlyStudent && (
        <section className="lms-layout">
          <aside className="lms-list">
            <h2>Courses & sections</h2>
            {items.length ? (
              Object.entries(groupedItems).map(([course, sections]) => (
                <div className="lms-course-group" key={course}>
                <h3>{course}</h3>
                {Object.entries(sections).map(([section, sectionItems]) => (
                  <div
                    className="lms-section-group"
                    key={`${course}-${section}`}
                  >
                    <h4>{section}</h4>
                    {sectionItems.map((item) => {
                      const unlocked = isItemUnlocked(
                        item,
                        student,
                        new Date(),
                        lmsSettings,
                        curriculumGroup,
                      );
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
                          onClick={() => {
                            if (item.type === "video" && unlocked) {
                              setSelectedLessonId(lessonId);
                              window.setTimeout(() => {
                                playerRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }, 0);
                            }
                          }}
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
                                  download={action.href.startsWith("/lms-resources/") ? "" : undefined}
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
              ))
            ) : (
              <p className="lms-empty-state">
                No curriculum has been published for your track yet. Please
                check back later.
              </p>
            )}
          </aside>
          <section className="lms-player-card" ref={playerRef}>
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
              <p>
                {lessons.length
                  ? "Select an unlocked lesson to start watching."
                  : "No lessons available yet."}
              </p>
            )}
          </section>
        </section>
      )}
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default LmsDashboard;
