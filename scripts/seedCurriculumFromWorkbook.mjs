import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyB5GOMutv7v4ZHgi01_cnytcif1luFvu18",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "ovtechacad.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ovtechacad",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "ovtechacad.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "228669791106",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:228669791106:web:7151c4f6d83f1a0ce80d9b",
};

const slugify = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const pick = (row, names) => names.map((name) => row[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
const boolValue = (value, fallback = true) => value === undefined || value === "" ? fallback : !["false", "no", "0", "draft"].includes(String(value).toLowerCase());

const normalizeRow = (row, index) => {
  const course = pick(row, ["course", "Course", "track", "Track"]);
  const section = pick(row, ["section", "Section", "module", "Module", "section/module", "Section/Module"]);
  const title = pick(row, ["title", "Title", "lesson", "Lesson", "Lesson Title"]);
  const type = String(pick(row, ["type", "Type"]) || (pick(row, ["youtubeUrl", "YouTube URL", "Youtube URL", "Video URL"]) ? "video" : "resource")).toLowerCase();
  const unlockDay = Number(pick(row, ["unlockDay", "Unlock Day", "day", "Day"]) || 1);
  const globalOrder = Number(pick(row, ["globalOrder", "Global Order", "order", "Order"]) || index + 1);
  const lessonOrder = Number(pick(row, ["lessonOrder", "Lesson Order"]) || globalOrder);

  if (!course || !title) return { invalid: `Row ${index + 2}: missing course or title` };

  if (type === "resource") {
    const resourceId = pick(row, ["resourceId", "Resource ID"]) || slugify(`${course}-${section}-${title}`);
    return { collectionName: "lmsResources", id: resourceId, data: {
      resourceId, course, section: section || "General", module: section || "General", title,
      fileType: pick(row, ["fileType", "File Type"]) || "link",
      fileName: pick(row, ["fileName", "File Name"]) || "",
      downloadUrl: pick(row, ["downloadUrl", "Download URL", "File URL"]) || "",
      storagePath: pick(row, ["storagePath", "Storage Path"]) || "",
      unlockDay, isPublished: boolValue(pick(row, ["isPublished", "Published"])), updatedAt: serverTimestamp(),
    }};
  }

  const lessonId = pick(row, ["lessonId", "Lesson ID"]) || slugify(`${course}-${section}-${globalOrder}-${title}`);
  return { collectionName: "curriculum", id: lessonId, data: {
    course, section: section || "General", module: section || "General", lessonId, globalOrder, lessonOrder, title,
    type: "video", youtubeUrl: pick(row, ["youtubeUrl", "YouTube URL", "Youtube URL", "Video URL"]) || "",
    unlockDay, isPublished: boolValue(pick(row, ["isPublished", "Published"])), updatedAt: serverTimestamp(),
  }};
};

const workbookPath = process.argv[2];
if (!workbookPath) {
  console.error("Usage: node scripts/seedCurriculumFromWorkbook.mjs ./OVTech_Master_Curriculum_Rebuilt(1).xlsx");
  process.exit(1);
}

let XLSX;
try {
  XLSX = await import("xlsx");
} catch {
  console.error("Missing optional workbook parser. Install it with: npm install --save-dev xlsx");
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer" });
const rows = workbook.SheetNames.flatMap((sheetName) => XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let created = 0, updated = 0, skipped = 0;

for (const [index, row] of rows.entries()) {
  const normalized = normalizeRow(row, index);
  if (normalized.invalid) { console.warn(`Skipped: ${normalized.invalid}`); skipped += 1; continue; }
  if (normalized.data.type === "video" && !normalized.data.youtubeUrl) console.warn(`Warning: ${normalized.id} has no YouTube URL.`);
  const ref = doc(db, normalized.collectionName, normalized.id);
  const existing = await getDoc(ref);
  await setDoc(ref, { ...normalized.data, createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp() }, { merge: true });
  existing.exists() ? updated += 1 : created += 1;
}

console.log(`Seed complete. Created: ${created}. Updated: ${updated}. Skipped: ${skipped}.`);
