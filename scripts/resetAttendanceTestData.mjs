import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const SERVICE_ACCOUNT_PATH = path.join(projectRoot, "serviceAccountKey.json");
const BATCH_LIMIT = 450;
const SESSION_PAGE_SIZE = 200;
const APPLICATION_PAGE_SIZE = 300;

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("Add serviceAccountKey.json to the project root before running this reset.");
  process.exit(1);
}

const { default: admin } = await import("firebase-admin");
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ATTENDANCE_FIELDS_TO_DELETE = [
  "attendance",
  "attendanceMarkedSessions",
  "lastAttendanceMarkedAt",
  "lectureDays",
  "attendedDays",
  "attendanceCount",
  "totalAttendance",
  "attendancePercentage",
];

let batch = db.batch();
let pendingBatchOperations = 0;
let committedOperations = 0;
let deletedAttendanceSessions = 0;
let deletedAttendanceRecords = 0;
let resetStudentApplications = 0;

const commitBatchIfNeeded = async (force = false) => {
  if (pendingBatchOperations === 0 || (!force && pendingBatchOperations < BATCH_LIMIT)) {
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
  await commitBatchIfNeeded();
};

const queueUpdate = async (documentRef, data) => {
  batch.update(documentRef, data);
  pendingBatchOperations += 1;
  await commitBatchIfNeeded();
};

const deleteRecordsForSession = async (sessionRef) => {
  let lastRecord = null;

  while (true) {
    let query = sessionRef.collection("records").orderBy(admin.firestore.FieldPath.documentId()).limit(SESSION_PAGE_SIZE);

    if (lastRecord) {
      query = query.startAfter(lastRecord);
    }

    const recordsSnapshot = await query.get();

    if (recordsSnapshot.empty) {
      return;
    }

    for (const recordDoc of recordsSnapshot.docs) {
      await queueDelete(recordDoc.ref);
      deletedAttendanceRecords += 1;
    }

    lastRecord = recordsSnapshot.docs.at(-1);
  }
};

const deleteAttendanceSessions = async () => {
  let lastSession = null;

  while (true) {
    let query = db.collection("attendanceSessions")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(SESSION_PAGE_SIZE);

    if (lastSession) {
      query = query.startAfter(lastSession);
    }

    const sessionsSnapshot = await query.get();

    if (sessionsSnapshot.empty) {
      return;
    }

    for (const sessionDoc of sessionsSnapshot.docs) {
      await deleteRecordsForSession(sessionDoc.ref);
      await queueDelete(sessionDoc.ref);
      deletedAttendanceSessions += 1;
    }

    lastSession = sessionsSnapshot.docs.at(-1);
  }
};

const resetScholarshipApplications = async () => {
  let lastApplication = null;

  while (true) {
    let query = db.collection("scholarshipApplications")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(APPLICATION_PAGE_SIZE);

    if (lastApplication) {
      query = query.startAfter(lastApplication);
    }

    const applicationsSnapshot = await query.get();

    if (applicationsSnapshot.empty) {
      return;
    }

    for (const applicationDoc of applicationsSnapshot.docs) {
      const application = applicationDoc.data();
      const resetFields = ATTENDANCE_FIELDS_TO_DELETE.filter((field) => Object.hasOwn(application, field));

      if (resetFields.length === 0) {
        continue;
      }

      await queueUpdate(
        applicationDoc.ref,
        Object.fromEntries(resetFields.map((field) => [field, FieldValue.delete()])),
      );
      resetStudentApplications += 1;
    }

    lastApplication = applicationsSnapshot.docs.at(-1);
  }
};

await deleteAttendanceSessions();
await resetScholarshipApplications();
await commitBatchIfNeeded(true);

console.log(JSON.stringify({
  deletedAttendanceSessions,
  deletedAttendanceRecords,
  resetStudentApplications,
  committedOperations,
}, null, 2));
