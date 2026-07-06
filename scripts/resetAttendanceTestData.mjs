import {
  getFirestore,
  initializeFirebaseAdmin,
  requireConfirmation,
} from "./firebaseAdmin.mjs";

const BATCH_LIMIT = 450;
const SESSION_PAGE_SIZE = 200;
const APPLICATION_PAGE_SIZE = 300;

const ATTENDANCE_FIELDS_TO_DELETE = [
  "attendanceMarkedSessions",
  "lastAttendanceMarkedAt",
  "attendancePercentage",
  "attendanceCount",
  "totalAttendance",
];

const TRACK_ATTENDANCE_FIELDS_TO_DELETE = [
  "attendanceMarkedSessions",
  "lastAttendanceMarkedAt",
  "attendancePercentage",
  "attendanceCount",
  "totalAttendance",
];

const createBatchQueue = (db) => {
  let batch = db.batch();
  let pendingBatchOperations = 0;
  let committedOperations = 0;

  const commit = async (force = false) => {
    if (
      pendingBatchOperations === 0 ||
      (!force && pendingBatchOperations < BATCH_LIMIT)
    ) {
      return;
    }

    await batch.commit();
    committedOperations += pendingBatchOperations;
    batch = db.batch();
    pendingBatchOperations = 0;
  };

  const queueDelete = async (documentRef) => {
    batch.delete(documentRef);
    pendingBatchOperations += 1;
    await commit();
  };

  const queueUpdate = async (documentRef, data) => {
    batch.update(documentRef, data);
    pendingBatchOperations += 1;
    await commit();
  };

  const flush = () => commit(true);
  const getCommittedOperations = () => committedOperations;

  return { queueDelete, queueUpdate, flush, getCommittedOperations };
};

const resetTrackAttendance = (attendance = {}) => {
  if (
    !attendance ||
    typeof attendance !== "object" ||
    Array.isArray(attendance)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attendance).map(([track, stats]) => {
      const resetStats =
        stats && typeof stats === "object" && !Array.isArray(stats)
          ? { ...stats }
          : {};

      for (const field of TRACK_ATTENDANCE_FIELDS_TO_DELETE) {
        delete resetStats[field];
      }

      return [
        track,
        {
          ...resetStats,
          attendedDays: 0,
          lectureDays: 0,
        },
      ];
    }),
  );
};

export const resetAttendanceTestData = async () => {
  const admin = await initializeFirebaseAdmin();
  const db = await getFirestore();
  const FieldValue = admin.firestore.FieldValue;
  const FieldPath = admin.firestore.FieldPath;
  const queue = createBatchQueue(db);

  const summary = {
    attendanceSessionsDeleted: 0,
    attendanceRecordsDeleted: 0,
    studentDocumentsReset: 0,
    committedOperations: 0,
  };

  const deleteRecordsForSession = async (sessionRef) => {
    while (true) {
      const recordsSnapshot = await sessionRef
        .collection("records")
        .orderBy(FieldPath.documentId())
        .limit(SESSION_PAGE_SIZE)
        .get();

      if (recordsSnapshot.empty) return;

      for (const recordDoc of recordsSnapshot.docs) {
        await queue.queueDelete(recordDoc.ref);
        summary.attendanceRecordsDeleted += 1;
      }
    }
  };

  const deleteAttendanceSessions = async () => {
    while (true) {
      const sessionsSnapshot = await db
        .collection("attendanceSessions")
        .orderBy(FieldPath.documentId())
        .limit(SESSION_PAGE_SIZE)
        .get();

      if (sessionsSnapshot.empty) return;

      for (const sessionDoc of sessionsSnapshot.docs) {
        await deleteRecordsForSession(sessionDoc.ref);
        await queue.queueDelete(sessionDoc.ref);
        summary.attendanceSessionsDeleted += 1;
      }
    }
  };

  const resetScholarshipApplications = async () => {
    let lastApplication = null;

    while (true) {
      let query = db
        .collection("scholarshipApplications")
        .orderBy(FieldPath.documentId())
        .limit(APPLICATION_PAGE_SIZE);

      if (lastApplication) {
        query = query.startAfter(lastApplication);
      }

      const applicationsSnapshot = await query.get();
      if (applicationsSnapshot.empty) return;

      for (const applicationDoc of applicationsSnapshot.docs) {
        const application = applicationDoc.data();
        const update = {};

        if (
          application.attendance &&
          typeof application.attendance === "object"
        ) {
          update.attendance = resetTrackAttendance(application.attendance);
        }

        for (const field of ATTENDANCE_FIELDS_TO_DELETE) {
          if (Object.hasOwn(application, field)) {
            update[field] = FieldValue.delete();
          }
        }

        if (Object.keys(update).length === 0) continue;

        await queue.queueUpdate(applicationDoc.ref, update);
        summary.studentDocumentsReset += 1;
      }

      lastApplication = applicationsSnapshot.docs.at(-1);
    }
  };

  await deleteAttendanceSessions();
  await resetScholarshipApplications();
  await queue.flush();
  summary.committedOperations = queue.getCommittedOperations();

  return summary;
};

export const printAttendanceResetSummary = (summary) => {
  console.log(
    `Attendance sessions deleted: ${summary.attendanceSessionsDeleted}`,
  );
  console.log(
    `Attendance records deleted: ${summary.attendanceRecordsDeleted}`,
  );
  console.log(`Student documents reset: ${summary.studentDocumentsReset}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  requireConfirmation("resetAttendanceTestData.mjs");
  const summary = await resetAttendanceTestData();
  printAttendanceResetSummary(summary);
}
