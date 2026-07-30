import { getFirestore, requireConfirmation } from "./firebaseAdmin.mjs";

requireConfirmation("backfillPublicCertificates.mjs");
const db = await getFirestore();
const profiles = await db.collection("certificateProfile").get();
let written = 0; let skipped = 0;
const writer = db.bulkWriter();
for (const snapshot of profiles.docs) {
  const profile = snapshot.data();
  if (String(profile.status || "").trim().toLowerCase() !== "approved" || !profile.certificateId) { skipped += 1; continue; }
  const certificateId = String(profile.certificateId).trim().toUpperCase();
  const courseOrTrack = String(profile.course || profile.track || "").trim();
  const studentName = String(profile.displayName || "").trim();
  if (!/^OVT-[A-Z0-9]+-[0-9]{4}-[0-9]{6}$/.test(certificateId) || !courseOrTrack || !studentName || !(profile.completionDate || profile.approvedAt)) { skipped += 1; continue; }
  const record = { certificateId, studentName, courseOrTrack, completionDate: profile.completionDate || profile.approvedAt, issuedAt: profile.approvedAt || profile.completionDate, status: "Approved", issuerName: "OVTech Academy", issuerBusinessName: "ONE VOICE TECH SOLUTIONS", registrationNumber: "9664153", verificationPath: `/verify/${certificateId}` };
  if (profile.publicPhotoConsent === true && profile.photoUrl) record.photoUrl = profile.photoUrl;
  if (profile.publicSocialLinksConsent === true) { const links = {}; for (const key of ["linkedin", "facebook", "instagram", "twitter", "tiktok"]) if (profile[key]) links[key] = profile[key]; if (Object.keys(links).length) record.socialLinks = links; }
  writer.set(db.collection("publicCertificates").doc(certificateId), record, { merge: true }); written += 1;
}
await writer.close();
console.log(`Backfill complete: ${written} public certificate(s) upserted; ${skipped} profile(s) skipped.`);
