import { digest } from './attendance-security.mjs';
import { normalizeProgrammeName } from '../src/data/programmes.js';
import { recordCohortId } from '../src/data/cohort.js';

export const pinCredentialVersion = (credential) => credential?.version || null;
export const pinRecoveryEmail = (student, credential) => {
  const email = String(credential ? credential.recoveryEmail || '' : student?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('The verified PIN recovery address is unavailable.');
  return email;
};

// An emailed code proves the address and enrollment as they existed when it
// was requested. It must not survive a contact/enrollment change or another
// PIN reset. The digest stays in the private challenge collection.
export function pinEnrollmentProof(student, secret) {
  return digest(JSON.stringify({
    id: student?.id,
    email: String(student?.email || '').trim().toLowerCase(),
    track: normalizeProgrammeName(student?.track),
    tracks: student?.tracks || [], courses: student?.courses || [],
    enrolledCourses: student?.enrolledCourses || [],
    course: student?.course || '', courseName: student?.courseName || '', program: student?.program || '',
    cohortId: recordCohortId(student),
    status: student?.status, learningMethod: student?.learningMethod || '',
    enrollmentPackage: student?.enrollmentPackage || '',
    applicationType: student?.applicationType || '', paymentVerified: student?.paymentVerified === true,
    registrationStatus: student?.registrationStatus || '', createdAt: student?.createdAt || null,
  }), secret);
}
