import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const SERVICE_ACCOUNT_PATH = path.join(projectRoot, "serviceAccountKey.json");
const BATCH_LIMIT = 450;

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

const commitInBatches = async (operations) => {
  let batch = db.batch();
  let count = 0;
  let committed = 0;

  for (const operation of operations) {
    operation(batch);
    count += 1;

    if (count === BATCH_LIMIT) {
      await batch.commit();
      committed += count;
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    committed += count;
  }

  return committed;
};

const studentsSnapshot = await db.collection("scholarshipApplications").get();
const sessionsSnapshot = await db.collection("attendanceSessions").get();
const recordsSnapshot = await db.collectionGroup("records").get();

const operations = [];

studentsSnapshot.docs.forEach((studentDoc) => {
  const student = studentDoc.data();
  const attendance = student.attendance || {};
  const resetAttendance = Object.fromEntries(
    Object.keys(attendance).map((track) => [track, { lectureDays: 0, attendedDays: 0 }]),
  );

  if (
    Object.keys(attendance).length > 0 ||
    student.attendanceMarkedSessions?.length ||
    student.lastAttendanceMarkedAt
  ) {
    operations.push((batch) => batch.update(studentDoc.ref, {
      attendance: resetAttendance,
      attendanceMarkedSessions: [],
      lastAttendanceMarkedAt: admin.firestore.FieldValue.delete(),
    }));
  }
});

recordsSnapshot.docs.forEach((recordDoc) => {
  operations.push((batch) => batch.delete(recordDoc.ref));
});

sessionsSnapshot.docs.forEach((sessionDoc) => {
  operations.push((batch) => batch.delete(sessionDoc.ref));
});

const committed = await commitInBatches(operations);

const verificationStudents = await db.collection("scholarshipApplications").get();
const nonZeroAttendance = verificationStudents.docs.flatMap((studentDoc) => {
  const attendance = studentDoc.data().attendance || {};
  return Object.entries(attendance)
    .filter(([, stats]) => Number(stats.lectureDays || 0) !== 0 || Number(stats.attendedDays || 0) !== 0)
    .map(([track]) => ({ studentId: studentDoc.id, track }));
});
const remainingSessions = await db.collection("attendanceSessions").get();
const remainingRecords = await db.collectionGroup("records").get();

console.log(JSON.stringify({
  updatedStudents: operations.length - recordsSnapshot.size - sessionsSnapshot.size,
  deletedAttendanceRecords: recordsSnapshot.size,
  deletedAttendanceSessions: sessionsSnapshot.size,
  committedOperations: committed,
  nonZeroAttendance: nonZeroAttendance.length,
  remainingAttendanceSessions: remainingSessions.size,
  remainingAttendanceRecords: remainingRecords.size,
}, null, 2));

if (nonZeroAttendance.length || remainingSessions.size || remainingRecords.size) {
  process.exit(2);
}
