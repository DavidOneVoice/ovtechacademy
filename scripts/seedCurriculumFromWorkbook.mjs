import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const DEFAULT_WORKBOOK_PATH = path.join(projectRoot, "data", "OVTech Master Curriculum.xlsx");
const SERVICE_ACCOUNT_PATH = path.join(projectRoot, "serviceAccountKey.json");

const slugify = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const pick = (row, names) => names.map((name) => row[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
const boolValue = (value, fallback = true) => (value === undefined || value === "" ? fallback : !["false", "no", "0", "draft", "unpublished"].includes(String(value).toLowerCase()));
const numberValue = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeRow = (row, index) => {
  const course = pick(row, ["course", "Course", "track", "Track"]);
  const section = pick(row, ["section", "Section", "module", "Module", "section/module", "Section/Module", "Section / Module"]);
  const title = pick(row, ["title", "Title", "lesson", "Lesson", "Lesson Title", "Resource Title"]);
  const youtubeUrl = pick(row, ["youtubeUrl", "YouTube URL", "Youtube URL", "Video URL", "videoUrl"]);
  const downloadUrl = pick(row, ["downloadUrl", "Download URL", "File URL", "Resource URL"]);
  const fileName = pick(row, ["fileName", "File Name", "Filename"]);
  const requestedType = String(pick(row, ["type", "Type", "itemType", "Item Type"]) || "").toLowerCase();
  const type = requestedType || (youtubeUrl ? "video" : "resource");
  const unlockDay = numberValue(pick(row, ["unlockDay", "Unlock Day", "day", "Day"]), 1);
  const globalOrder = numberValue(pick(row, ["globalOrder", "Global Order", "order", "Order"]), index + 1);
  const lessonOrder = numberValue(pick(row, ["lessonOrder", "Lesson Order"]), globalOrder);
  const normalizedSection = section || "General";

  if (!course || !title) return { invalid: `Row ${index + 2}: missing course or title` };

  if (["resource", "download", "file", "worksheet", "pdf"].includes(type)) {
    const resourceId = pick(row, ["resourceId", "Resource ID"]) || slugify(`${course}-${normalizedSection}-${title}`);
    return {
      collectionName: "lmsResources",
      id: resourceId,
      data: {
        resourceId,
        course,
        section: normalizedSection,
        module: normalizedSection,
        title,
        fileType: pick(row, ["fileType", "File Type"]) || "link",
        fileName: fileName || title,
        downloadUrl: downloadUrl || "",
        storagePath: pick(row, ["storagePath", "Storage Path"]) || "",
        unlockDay,
        isPublished: boolValue(pick(row, ["isPublished", "Published", "published"])),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    };
  }

  const lessonId = pick(row, ["lessonId", "Lesson ID"]) || slugify(`${course}-${normalizedSection}-${globalOrder}-${title}`);
  return {
    collectionName: "curriculum",
    id: lessonId,
    data: {
      lessonId,
      course,
      section: normalizedSection,
      module: normalizedSection,
      globalOrder,
      lessonOrder,
      title,
      type: "video",
      youtubeUrl: youtubeUrl || "",
      unlockDay,
      isPublished: boolValue(pick(row, ["isPublished", "Published", "published"])),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
};

const workbookPath = path.resolve(process.argv[2] || DEFAULT_WORKBOOK_PATH);
if (!existsSync(workbookPath)) {
  console.error(`Workbook not found: ${workbookPath}`);
  console.error("Place the curriculum file at data/OVTech Master Curriculum.xlsx or pass a path as the first argument.");
  process.exit(1);
}
if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Firebase Admin service account not found: ${SERVICE_ACCOUNT_PATH}`);
  console.error("Add a local serviceAccountKey.json file in the project root. This file is ignored by git.");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer" });
const rows = workbook.SheetNames.flatMap((sheetName) => XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }));
let created = 0;
let updated = 0;
let skipped = 0;

for (const [index, row] of rows.entries()) {
  const normalized = normalizeRow(row, index);
  if (normalized.invalid) {
    console.warn(`Skipped: ${normalized.invalid}`);
    skipped += 1;
    continue;
  }
  if (normalized.data.type === "video" && !normalized.data.youtubeUrl) console.warn(`Warning: ${normalized.id} has no YouTube URL.`);
  if (normalized.collectionName === "lmsResources" && !normalized.data.downloadUrl && !normalized.data.storagePath) console.warn(`Warning: ${normalized.id} has no download URL or storage path.`);

  const ref = db.collection(normalized.collectionName).doc(normalized.id);
  const existing = await ref.get();
  await ref.set(
    {
      ...normalized.data,
      createdAt: existing.exists ? existing.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  existing.exists ? updated += 1 : created += 1;
}

console.log(`Seed complete from ${workbookPath}. Created: ${created}. Updated: ${updated}. Skipped: ${skipped}.`);
