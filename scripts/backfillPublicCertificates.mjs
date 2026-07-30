import { getFirestore, requireConfirmation } from "./firebaseAdmin.mjs";

requireConfirmation("backfillPublicCertificates.mjs");
const certificateId = "OVT-SD-2026-000001";
const db = await getFirestore();
const profiles = await db.collection("certificateProfile")
  .where("certificateId", "==", certificateId)
  .get();

if (profiles.empty) {
  throw new Error(`Approved certificateProfile not found for ${certificateId}.`);
}
if (profiles.size !== 1) {
  throw new Error(`Expected one certificateProfile for ${certificateId}, found ${profiles.size}.`);
}

const snapshot = profiles.docs[0];
const profile = snapshot.data();
if (String(profile.status || "").trim().toLowerCase() !== "approved") {
  throw new Error(`certificateProfile/${snapshot.id} is not approved (status: ${profile.status ?? "missing"}).`);
}

const studentName = String(profile.displayName || "").trim();
const courseOrTrack = String(profile.course || profile.track || "").trim();
const completionDate = profile.completionDate || profile.approvedAt;
const issuedAt = profile.approvedAt || profile.completionDate;
if (!studentName || !courseOrTrack || !completionDate || !issuedAt) {
  throw new Error(
    `certificateProfile/${snapshot.id} is missing required public data. ` +
    `Available fields: ${Object.keys(profile).sort().join(", ")}`,
  );
}

const record = {
  certificateId,
  studentName,
  courseOrTrack,
  completionDate,
  issuedAt,
  status: "approved",
  issuerName: "OVTech Academy",
  issuerBusinessName: "ONE VOICE TECH SOLUTIONS",
  registrationNumber: "9664153",
  verificationPath: `/verify/${certificateId}`,
};

await db.collection("publicCertificates").doc(certificateId).set(record, { merge: true });
console.log(`Source: certificateProfile/${snapshot.id}`);
console.log(`Created: publicCertificates/${certificateId}`);
console.log("Mapping: displayName -> studentName; course || track -> courseOrTrack; completionDate || approvedAt -> completionDate; approvedAt || completionDate -> issuedAt");
