import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export const getProgressId = (student) => student?.id || student?.studentId || student?.enrollmentId;

export const calculateProgressPercentage = (completedLessonIds = [], lessons = []) => {
  const publishedVideoIds = lessons
    .filter((item) => item.type === "video" && item.isPublished !== false)
    .map((item) => item.lessonId);

  if (!publishedVideoIds.length) return 0;

  const completed = new Set(completedLessonIds);
  const completedCount = publishedVideoIds.filter((lessonId) => completed.has(lessonId)).length;
  return Math.round((completedCount / publishedVideoIds.length) * 100);
};

export const buildProgressPayload = ({ student, completedLessonIds, lastWatchedLessonId, lessons }) => ({
  studentId: getProgressId(student),
  applicationId: student?.id || student?.applicationId || "",
  enrollmentId: student?.enrollmentId || student?.id || "",
  completedLessonIds,
  lastWatchedLessonId: lastWatchedLessonId || "",
  progressPercentage: calculateProgressPercentage(completedLessonIds, lessons),
  updatedAt: serverTimestamp(),
});

export const saveStudentProgress = async ({ db, student, completedLessonIds, lastWatchedLessonId, lessons }) => {
  const progressId = getProgressId(student);
  const payload = buildProgressPayload({ student, completedLessonIds, lastWatchedLessonId, lessons });
  await setDoc(doc(db, "progress", progressId), payload, { merge: true });
  return payload;
};
