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

const logPublicCertificateDiagnostics = ({ normalizedId, documentPath, exists, certificate, normalizedStatus }) => {
  if (!import.meta.env.DEV) return;
  console.info("[public certificate verification]", {
    requestedCertificateId: normalizedId,
    firestoreDocumentPath: documentPath,
    documentExists: exists,
    rawStatusValue: certificate?.status ?? certificate?.certificateStatus,
    normalizedStatusValue: normalizedStatus,
    studentName: certificate?.studentName,
    courseOrTrack: certificate?.courseOrTrack,
  });
};

export const getPublicCertificate = async (certificateId) => {
  const normalizedId = normalizeCertificateId(certificateId);
  if (!isCertificateIdValid(normalizedId)) return { kind: "not-found" };

  const certificateRef = doc(db, PUBLIC_CERTIFICATE_COLLECTION, normalizedId);
  const snapshot = await getDoc(certificateRef);
  if (!snapshot.exists()) {
    logPublicCertificateDiagnostics({ normalizedId, documentPath: certificateRef.path, exists: false });
    return { kind: "not-found" };
  }

  const certificate = snapshot.data();
  const normalizedStatus = getNormalizedPublicStatus(certificate);
  logPublicCertificateDiagnostics({
    normalizedId,
    documentPath: certificateRef.path,
    exists: true,
    certificate,
    normalizedStatus,
  });

  if (normalizeCertificateId(certificate.certificateId) !== normalizedId) return { kind: "not-valid" };
  if (!isValidPublicStatus(certificate)) return { kind: "not-valid" };

  const studentName = String(certificate.studentName || certificate.displayName || "").trim();
  const courseOrTrack = String(certificate.courseOrTrack || "").trim();
  if (!studentName || !courseOrTrack) return { kind: "incomplete" };

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
