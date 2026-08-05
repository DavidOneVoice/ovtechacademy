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
  const normalizedCertificateId = normalizeCertificateId(certificateId);
  if (!isCertificateIdValid(normalizedCertificateId)) return { kind: "not-found" };

  const certificateRef = doc(db, PUBLIC_CERTIFICATE_COLLECTION, normalizedCertificateId);
  const snapshot = await getDoc(certificateRef);
  console.group("Certificate Verification Debug");
  console.log("Requested ID:", normalizedCertificateId);
  console.log("Document exists:", snapshot.exists());
  console.log("Raw Firestore data:", snapshot.data());
  console.groupEnd();
  if (!snapshot.exists()) {
    logPublicCertificateDiagnostics({ normalizedId: normalizedCertificateId, documentPath: certificateRef.path, exists: false });
    return { kind: "not-found" };
  }

  const certificate = snapshot.data();
  const normalizedStatus = getNormalizedPublicStatus(certificate);
  logPublicCertificateDiagnostics({
    normalizedId: normalizedCertificateId,
    documentPath: certificateRef.path,
    exists: true,
    certificate,
    normalizedStatus,
  });

  if (normalizeCertificateId(certificate.certificateId) !== normalizedCertificateId) return { kind: "not-valid" };
  if (!isValidPublicStatus(certificate)) return { kind: "not-valid" };

  const studentName = String(certificate.studentName || certificate.displayName || "").trim();
  const courseOrTrack = String(certificate.courseOrTrack || "").trim();
  if (!studentName || !courseOrTrack) {
    console.group("Certificate Incomplete Diagnosis");
    console.log("certificate:", certificate);

    console.log("studentName:", certificate.studentName);
    console.log("displayName:", certificate.displayName);
    console.log("courseOrTrack:", certificate.courseOrTrack);
    console.log("certificateId:", certificate.certificateId);
    console.log("status:", certificate.status);
    console.log("completionDate:", certificate.completionDate);
    console.log("issuedAt:", certificate.issuedAt);
    console.log("verificationPath:", certificate.verificationPath);

    const missing = [];

    if (!(certificate.studentName || certificate.displayName))
      missing.push("studentName/displayName");

    if (!certificate.courseOrTrack)
      missing.push("courseOrTrack");

    if (!certificate.certificateId)
      missing.push("certificateId");

    if (!certificate.status)
      missing.push("status");

    if (!certificate.completionDate)
      missing.push("completionDate");

    console.log("Missing required fields:", missing);

    console.groupEnd();

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
