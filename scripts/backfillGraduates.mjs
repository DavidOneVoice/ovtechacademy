import { initializeFirebaseAdmin, requireConfirmation } from "./firebaseAdmin.mjs";

requireConfirmation("backfillGraduates.mjs");
const admin = await initializeFirebaseAdmin();
const db = admin.firestore();
const approved = await db.collection("certificateProfile").where("status", "==", "Approved").get();
let updated = 0;
let skipped = 0;

for (let offset = 0; offset < approved.docs.length; offset += 400) {
  const batch = db.batch();
  const profiles = approved.docs.slice(offset, offset + 400);
  for (const profileSnap of profiles) {
    const profile = profileSnap.data();
    if (!profile.certificateId) { skipped += 1; continue; }
    const studentRef = db.collection("scholarshipApplications").doc(profileSnap.id);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) { skipped += 1; continue; }
    batch.update(studentRef, {
      status: "Graduated",
      certificateStatus: "Approved",
      certificateId: profile.certificateId,
      graduatedAt: profile.completionDate || profile.approvedAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    updated += 1;
  }
  await batch.commit();
}

console.log(`Graduate backfill complete. Updated: ${updated}; skipped: ${skipped}.`);
