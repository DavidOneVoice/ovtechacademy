import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../src/firebase";

export const PUBLIC_CERTIFICATE_COLLECTION = "publicCertificates";
export const CERTIFICATE_ID_PATTERN = /^OVT-[A-Z0-9]+-[0-9]{4}-[0-9]{6}$/;

export const normalizeCertificateId = (value) => String(value || "").trim().toUpperCase();
export const isCertificateIdValid = (value) => CERTIFICATE_ID_PATTERN.test(normalizeCertificateId(value));
export const isValidPublicStatus = (status) => ["approved", "valid"].includes(String(status || "").trim().toLowerCase());

export const getPublicCertificate = async (certificateId) => {
  const normalizedId = normalizeCertificateId(certificateId);
  if (!isCertificateIdValid(normalizedId)) return { kind: "not-found" };

  const snapshot = await getDoc(doc(db, PUBLIC_CERTIFICATE_COLLECTION, normalizedId));
  if (!snapshot.exists()) return { kind: "not-found" };

  const certificate = snapshot.data();
  if (normalizeCertificateId(certificate.certificateId) !== normalizedId) return { kind: "not-valid" };
  if (!isValidPublicStatus(certificate.status)) return { kind: "not-valid" };
  const studentName = String(
    certificate.studentName || certificate.displayName || certificate.certificateProfile?.displayName || "",
  ).trim();
  // A certificate is never presented as verified without identifying its holder.
  if (!studentName) return { kind: "not-valid" };
  return { kind: "verified", certificate: { ...certificate, studentName } };
};

export const createPublicCertificateRecord = ({
  certificateId,
  profile,
  courseOrTrack,
  completionDate = serverTimestamp(),
  issuedAt = serverTimestamp(),
}) => ({
  certificateId,
  studentName: String(profile.displayName || "").trim(),
  courseOrTrack: String(courseOrTrack || "").trim(),
  completionDate,
  issuedAt,
  status: "approved",
  issuerName: "OVTech Academy",
  issuerBusinessName: "ONE VOICE TECH SOLUTIONS",
  registrationNumber: "9664153",
  verificationPath: `/verify/${certificateId}`,
});
