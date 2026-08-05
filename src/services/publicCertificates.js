import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../src/firebase";

export const PUBLIC_CERTIFICATE_COLLECTION = "publicCertificates";
export const CERTIFICATE_ID_PATTERN = /^OVT-[A-Z0-9]+-[0-9]{4}-[0-9]{6}$/;

export const normalizeCertificateId = (certificateId) => decodeURIComponent(certificateId)
  .trim()
  .toUpperCase();
export const isCertificateIdValid = (value) => CERTIFICATE_ID_PATTERN.test(normalizeCertificateId(value));
export const getNormalizedPublicStatus = (certificate) => String(
  certificate?.status ??
  certificate?.certificateStatus ??
  ""
)
  .trim()
  .toLowerCase();

export const isValidPublicStatus = (certificate) => {
  const normalizedStatus = getNormalizedPublicStatus(certificate);
  return normalizedStatus === "approved" || normalizedStatus === "valid" || normalizedStatus === "active";
};

export const getPublicCertificate = async (certificateId) => {
  const normalizedCertificateId = normalizeCertificateId(certificateId);
  if (!isCertificateIdValid(normalizedCertificateId)) return { kind: "not-found" };

  const certificateRef = doc(db, PUBLIC_CERTIFICATE_COLLECTION, normalizedCertificateId);
  const snapshot = await getDoc(certificateRef);
  if (!snapshot.exists()) {
    return { kind: "not-found" };
  }

  const certificate = snapshot.data();
  if (normalizeCertificateId(certificate.certificateId) !== normalizedCertificateId) return { kind: "not-valid" };
  if (!isValidPublicStatus(certificate)) return { kind: "not-valid" };

  const studentName = String(certificate.studentName || certificate.displayName || "").trim();
  const courseOrTrack = String(certificate.courseOrTrack || "").trim();
  if (!studentName || !courseOrTrack) {
    return { kind: "incomplete" };
  }

  return { kind: "verified", certificate: { ...certificate, studentName, courseOrTrack } };
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
