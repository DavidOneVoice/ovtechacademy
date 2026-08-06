import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../src/firebase";
import { getStoredAdminRole } from "../auth/adminRoles";
import { createPublicCertificateRecord } from "./publicCertificates";
import { createPublicAlumniRecord } from "./publicAlumni";

const COURSE_CODES = {
  "data analytics": "DA", "software development": "SD", "web development": "WD",
  cybersecurity: "CS", "virtual assistant": "VA", "artificial intelligence": "AI",
  "product design": "PD", "ui/ux design": "UX", "digital marketing": "DM",
  "project management": "PM", "cloud computing": "CC", "data science": "DS",
};

const courseCode = (course) => COURSE_CODES[String(course || "").trim().toLowerCase()] ||
  String(course || "GEN").split(/\s+/).map((word) => word[0]).join("").replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 4) || "GEN";

/** Atomically issues a certificate, publishes it, and graduates its student. */
export const approveAndGraduate = async ({ student, profile }) => {
  const course = profile.course || profile.track || student.track;
  const code = courseCode(course);
  const year = new Date().getFullYear();
  const profileRef = doc(db, "certificateProfile", student.id);
  const studentRef = doc(db, "scholarshipApplications", student.id);
  const counterRef = doc(db, "certificateCounters", `${code}-${year}`);

  return runTransaction(db, async (transaction) => {
    const [profileSnap, counterSnap] = await Promise.all([
      transaction.get(profileRef), transaction.get(counterRef),
    ]);
    if (!profileSnap.exists() || profileSnap.data().status !== "Pending") throw new Error("This application is no longer pending.");
    const current = profileSnap.data();
    const next = Number(counterSnap.data()?.value || 0) + 1;
    const certificateId = `OVT-${code}-${year}-${String(next).padStart(6, "0")}`;
    const issuedAt = serverTimestamp();
    const approved = { ...current, status: "Approved", certificateId, approvedAt: issuedAt, completionDate: issuedAt, approvedBy: getStoredAdminRole() || "admin", updatedAt: serverTimestamp() };

    transaction.set(counterRef, { value: next, courseCode: code, year, updatedAt: serverTimestamp() }, { merge: true });
    transaction.update(profileRef, {
      status: "Approved", certificateId, approvedAt: issuedAt, completionDate: issuedAt,
      approvedBy: approved.approvedBy, updatedAt: serverTimestamp(),
    });
    transaction.update(studentRef, { status: "Graduated", graduatedAt: serverTimestamp(), certificateStatus: "Approved", certificateId, updatedAt: serverTimestamp() });
    transaction.set(doc(db, "publicCertificates", certificateId), createPublicCertificateRecord({ certificateId, profile: approved, courseOrTrack: course, completionDate: issuedAt, issuedAt }));
    if (current.showInAlumniDirectory === true) transaction.set(doc(db, "publicAlumni", certificateId), createPublicAlumniRecord({ profile: approved, certificateId }));
    return certificateId;
  });
};

/** Atomically invalidates every public and private pointer to an issued certificate. */
export const revokeCertificate = async ({ studentId, reason }) => {
  const message = String(reason || "").trim();
  if (!message) throw new Error("A revocation reason is required.");
  const profileRef = doc(db, "certificateProfile", studentId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(profileRef);
    if (!snap.exists() || snap.data().status !== "Approved" || !snap.data().certificateId) throw new Error("This certificate is no longer approved.");
    const oldId = snap.data().certificateId;
    transaction.update(profileRef, {
      status: "Pending", revokedAt: serverTimestamp(), revokedBy: getStoredAdminRole() || "admin",
      revocationReason: message, previousCertificateId: oldId, approvedAt: null, approvedBy: null,
      completionDate: null, certificateId: null, adminMessage: message, updatedAt: serverTimestamp(),
    });
    transaction.delete(doc(db, "publicCertificates", oldId));
    transaction.delete(doc(db, "publicAlumni", oldId));
    transaction.update(doc(db, "scholarshipApplications", studentId), {
      status: "Enrolled", graduatedAt: null, certificateStatus: "Revoked", certificateId: null, updatedAt: serverTimestamp(),
    });
    return oldId;
  });
};
