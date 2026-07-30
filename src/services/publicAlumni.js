import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../src/firebase";

export const PUBLIC_ALUMNI_COLLECTION = "publicAlumni";
export const ALUMNI_PAGE_SIZE = 12;
export const ALUMNI_QUERY_CONSTRAINTS = [
  'where("status", "==", "active")',
  'orderBy("completionDate", "desc")',
  "limit(12)",
];
const SOCIAL_FIELDS = ["linkedin", "facebook", "instagram", "twitter", "tiktok"];

export const toDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const createPublicAlumniRecord = ({ profile, certificateId }) => {
  const record = {
    certificateId,
    studentName: String(profile.displayName || "").trim(),
    courseOrTrack: String(profile.course || profile.track || "").trim(),
    completionDate: profile.completionDate,
    photoUrl: String(profile.photoUrl || "").trim(),
    verificationPath: `/verify/${certificateId}`,
    profileCreatedAt: profile.approvedAt || serverTimestamp(),
    status: "active",
  };
  SOCIAL_FIELDS.forEach((field) => {
    const value = String(profile[field] || "").trim();
    if (value) record[field] = value;
  });
  return record;
};

export const getAlumniPage = async (cursor = null) => {
  const constraints = [
    where("status", "==", "active"),
    orderBy("completionDate", "desc"),
    limit(ALUMNI_PAGE_SIZE),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  try {
    const snapshot = await getDocs(query(collection(db, PUBLIC_ALUMNI_COLLECTION), ...constraints));
    return {
      records: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
      cursor: snapshot.docs.at(-1) || null,
      hasMore: snapshot.size === ALUMNI_PAGE_SIZE,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      const message = String(error?.message || "");
      console.error("[public alumni query]", {
        collectionPath: PUBLIC_ALUMNI_COLLECTION,
        queryConstraints: [...ALUMNI_QUERY_CONSTRAINTS, ...(cursor ? ["startAfter(cursor)"] : [])],
        firebaseErrorCode: error?.code || "unknown",
        firebaseErrorMessage: message,
        includesMissingIndexUrl: /https:\/\/console\.firebase\.google\.com\/\S+/i.test(message),
      });
    }
    throw error;
  }
};

export const publicAlumniRef = (certificateId) => doc(db, PUBLIC_ALUMNI_COLLECTION, certificateId);

export const logPublicAlumniRecord = async (certificateId) => {
  if (!import.meta.env.DEV) return;
  try {
    const reference = publicAlumniRef(certificateId);
    const snapshot = await getDoc(reference);
    const data = snapshot.data();
    console.info("[public alumni consent write]", {
      documentPath: reference.path,
      exists: snapshot.exists(),
      publicFields: data && {
        certificateId: data.certificateId,
        studentName: data.studentName,
        courseOrTrack: data.courseOrTrack,
        completionDate: data.completionDate,
        status: data.status,
        verificationPath: data.verificationPath,
      },
    });
  } catch (error) {
    console.warn("[public alumni consent write] Could not verify the saved public record.", error);
  }
};
