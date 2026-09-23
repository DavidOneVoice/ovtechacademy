import { doc, runTransaction, serverTimestamp, FieldPath, increment } from 'firebase/firestore';
import { db } from '../src/firebase';
import { attendanceDate, attendanceSessionId, eligibleForSession, trackSlug } from './model';
import { normalizeProgrammeName } from '../data/programmes';

export async function generateAttendance(track, cohort, students) {
  const dateKey = attendanceDate();
  const sessionId = attendanceSessionId(track, dateKey, cohort.id);
  const session = { track: normalizeProgrammeName(track), trackSlug: trackSlug(track), dateKey, cohortId: cohort.id, cohortLabel: cohort.label, lectureCount: 1, accessVersion: 2 };
  const eligible = students.filter((student) => eligibleForSession(student, session));
  if (!eligible.length) throw new Error('No enrolled live-class students in this course and cohort yet.');
  const reused = await runTransaction(db, async (tx) => {
    const ref = doc(db, 'attendanceSessions', sessionId);
    const existing = await tx.get(ref);
    // Re-read students inside the transaction so a changed cohort/method is not counted.
    const snapshots = await Promise.all(eligible.map((student) => tx.get(doc(db, 'scholarshipApplications', student.id))));
    if (existing.exists()) return true;
    tx.set(ref, { ...session, createdAt: serverTimestamp() });
    snapshots.filter((snapshot) => snapshot.exists() && eligibleForSession(snapshot.data(), session)).forEach((snapshot) => {
      const originalTrack = Object.keys(snapshot.data().attendance || {}).find((key) => normalizeProgrammeName(key) === session.track) || session.track;
      tx.update(snapshot.ref, new FieldPath('attendance', originalTrack, 'lectureDays'), increment(1));
    });
    return false;
  });
  return { track: session.track, cohortId: cohort.id, dateKey, link: `${window.location.origin}/attendance/${sessionId}`, reused };
}
