import { getFirestore, requireConfirmation } from "./firebaseAdmin.mjs";

requireConfirmation("backfillPublicAlumni.mjs");
const db = await getFirestore();
const profiles = await db.collection("certificateProfile")
  .where("status", "==", "Approved")
  .get();
const consentedProfiles = profiles.docs.filter((snapshot) => snapshot.data().showInAlumniDirectory === true);
const socialFields = ["linkedin", "facebook", "instagram", "twitter", "tiktok"];
let written = 0;

for (let offset = 0; offset < consentedProfiles.length; offset += 500) {
  const batch = db.batch();
  for (const snapshot of consentedProfiles.slice(offset, offset + 500)) {
    const profile = snapshot.data();
    const certificateId = String(profile.certificateId || "").trim();
    const studentName = String(profile.displayName || "").trim();
    const courseOrTrack = String(profile.course || profile.track || "").trim();
    if (!certificateId || !studentName || !courseOrTrack || !profile.completionDate) {
      console.warn(`Skipped ${snapshot.ref.path}: incomplete approved public data.`);
      continue;
    }
    const record = {
      certificateId, studentName, courseOrTrack,
      completionDate: profile.completionDate,
      photoUrl: String(profile.photoUrl || "").trim(),
      verificationPath: `/verify/${certificateId}`,
      profileCreatedAt: profile.approvedAt || profile.completionDate,
      status: "active",
    };
    const professionalEmail = String(profile.professionalEmail || profile.email || "").trim();
    const phone = String(profile.phone || profile.whatsapp || "").trim();
    if (professionalEmail) record.professionalEmail = professionalEmail;
    if (phone) record.phone = phone;
    socialFields.forEach((field) => { if (String(profile[field] || "").trim()) record[field] = String(profile[field]).trim(); });
    batch.set(db.collection("publicAlumni").doc(certificateId), record);
    written += 1;
  }
  await batch.commit();
}
console.log(`Backfill complete: scanned ${profiles.size} approved profiles, found ${consentedProfiles.length} with explicit consent, and wrote ${written} public alumni records.`);
