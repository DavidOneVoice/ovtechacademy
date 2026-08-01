import { getFirestore, requireConfirmation } from "./firebaseAdmin.mjs";

requireConfirmation("backfillPublicCertificates.mjs");

const db = await getFirestore();
const profiles = await db.collection("certificateProfile")
  .where("status", "==", "Approved")
  .get();

const candidates = profiles.docs.map((snapshot) => {
  const profile = snapshot.data();
  const certificateId = String(profile.certificateId || "").trim();
  const studentName = String(profile.displayName || "").trim();
  const courseOrTrack = String(profile.course ?? profile.track ?? "").trim();
  const completionDate = profile.completionDate;
  const issuedAt = profile.approvedAt;

  if (!certificateId || !studentName || !courseOrTrack || !completionDate || !issuedAt) {
    throw new Error(
      `certificateProfile/${snapshot.id} is missing required public data. ` +
      `Available fields: ${Object.keys(profile).sort().join(", ")}`,
    );
  }

  return {
    profilePath: snapshot.ref.path,
    ref: db.collection("publicCertificates").doc(certificateId),
    record: {
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
    },
  };
});

const existingSnapshots = candidates.length
  ? await db.getAll(...candidates.map(({ ref }) => ref))
  : [];
const repairs = candidates.filter((_, index) => {
  const existing = existingSnapshots[index];
  return !existing.exists || !String(existing.data()?.studentName || "").trim();
});

for (let offset = 0; offset < repairs.length; offset += 500) {
  const batch = db.batch();
  for (const { ref, record } of repairs.slice(offset, offset + 500)) {
    batch.set(ref, record, { merge: true });
  }
  await batch.commit();
}

for (const { profilePath, ref } of repairs) {
  console.log(`Created or repaired ${ref.path} from ${profilePath}`);
}
console.log(
  `Backfill complete: scanned ${profiles.size} approved profiles, ` +
  `created or repaired ${repairs.length}, skipped ${candidates.length - repairs.length} complete existing records.`,
);
