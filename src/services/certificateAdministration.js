import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { publicAlumniRef } from "./publicAlumni";

export const revokeApprovedCertificate = async ({ db, studentId, reason }) => {
  const profileRef = doc(db, "certificateProfile", studentId);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists() || profileSnap.data().status !== "Approved") {
    throw new Error("Certificate is no longer approved.");
  }

  const approvedProfile = profileSnap.data();
  const certificateId = approvedProfile.certificateId;
  if (!certificateId) throw new Error("Approved certificate has no certificate ID.");

  const batch = writeBatch(db);
  batch.update(profileRef, {
    status: "Revoked",
    revokedAt: serverTimestamp(),
    revokedBy: "admin",
    revocationReason: reason,
    previousCertificateId: certificateId,
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, "publicCertificates", certificateId));
  batch.delete(publicAlumniRef(certificateId));
  await batch.commit();
  return profileRef;
};
