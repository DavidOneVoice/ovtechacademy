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
  return { kind: "verified", certificate };
};

export const createPublicCertificateRecord = ({ certificateId, profile, courseOrTrack }) => {
  const record = {
    certificateId,
    studentName: String(profile.displayName || "").trim(),
    courseOrTrack: String(courseOrTrack || "").trim(),
    completionDate: serverTimestamp(),
    issuedAt: serverTimestamp(),
    status: "Approved",
    issuerName: "OVTech Academy",
    issuerBusinessName: "ONE VOICE TECH SOLUTIONS",
    registrationNumber: "9664153",
    verificationPath: `/verify/${certificateId}`,
  };

  // Optional profile data is public only after explicit, field-specific consent.
  if (profile.publicPhotoConsent === true && profile.photoUrl) record.photoUrl = profile.photoUrl;
  if (profile.publicSocialLinksConsent === true) {
    const socialLinks = ["linkedin", "facebook", "instagram", "twitter", "tiktok"]
      .reduce((links, key) => profile[key] ? { ...links, [key]: profile[key] } : links, {});
    if (Object.keys(socialLinks).length) record.socialLinks = socialLinks;
  }
  return record;
};
