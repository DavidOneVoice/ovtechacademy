import {
  collection,
  doc,
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
  const snapshot = await getDocs(query(collection(db, PUBLIC_ALUMNI_COLLECTION), ...constraints));
  return {
    records: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.size === ALUMNI_PAGE_SIZE,
  };
};

export const publicAlumniRef = (certificateId) => doc(db, PUBLIC_ALUMNI_COLLECTION, certificateId);
