import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const DEFAULT_WORKBOOK_PATH = path.join(projectRoot, "data", "OVTech Master Curriculum.xlsx");
const SERVICE_ACCOUNT_PATH = path.join(projectRoot, "serviceAccountKey.json");

const REQUIRED_HEADERS = ["Course", "Section", "Lesson ID", "Title", "YouTube Link"];

const slugify = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeHeader = (value) => String(value || "").trim().replace(/\s+/g, " ");
const pick = (row, names) => names.map((name) => row[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
const boolValue = (value, fallback = true) => (value === undefined || value === "" ? fallback : !["false", "no", "0", "draft", "unpublished"].includes(String(value).toLowerCase()));
const numberValue = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const rowHasCurriculumHeaders = (row) => {
  const headers = new Set(row.map(normalizeHeader).filter(Boolean));
  return REQUIRED_HEADERS.every((header) => headers.has(header));
};

const parseWorksheetRows = (worksheet) => {
  const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", blankrows: false });
  const headerRowIndex = sheetRows.findIndex(rowHasCurriculumHeaders);
  if (headerRowIndex === -1) return null;

  const headers = sheetRows[headerRowIndex].map(normalizeHeader);
  const rows = sheetRows.slice(headerRowIndex + 1).map((values) =>
    headers.reduce((row, header, columnIndex) => {
      if (header) row[header] = values[columnIndex] ?? "";
      return row;
    }, {}),
  ).filter((row) => Object.values(row).some((value) => String(value).trim() !== ""));

  return { headers: headers.filter(Boolean), headerRowIndex, rows };
};

const readCurriculumWorksheet = (workbook) => {
  for (const sheetName of workbook.SheetNames) {
    const parsed = parseWorksheetRows(workbook.Sheets[sheetName]);
    if (parsed) return { sheetName, ...parsed };
  }

  throw new Error(`No worksheet found with required headers: ${REQUIRED_HEADERS.join(", ")}`);
};

const normalizeRow = (row, index) => {
  const course = pick(row, ["Course", "course", "track", "Track"]);
  const section = pick(row, ["Section", "section", "module", "Module", "section/module", "Section/Module", "Section / Module"]);
  const title = pick(row, ["Title", "title", "lesson", "Lesson", "Lesson Title", "Resource Title"]);
  const youtubeUrl = pick(row, ["YouTube Link", "youtubeUrl", "YouTube URL", "Youtube URL", "Video URL", "videoUrl"]);
  const downloadUrl = pick(row, ["Downloadable Resource", "downloadUrl", "Download URL", "File URL", "Resource URL"]);
  const fileName = pick(row, ["fileName", "File Name", "Filename"]);
  const requestedType = String(pick(row, ["Type", "type", "itemType", "Item Type"]) || "").toLowerCase();
  const type = requestedType || (youtubeUrl ? "video" : "resource");
  const unlockDay = numberValue(pick(row, ["Unlock Day", "unlockDay", "day", "Day"]), 1);
  const globalOrder = numberValue(pick(row, ["Global Order", "globalOrder", "order", "Order"]), index + 1);
  const lessonOrder = numberValue(pick(row, ["Course Order", "lessonOrder", "Lesson Order"]), globalOrder);
  const normalizedSection = section || "General";

  if (!course || !title) return { invalid: `Row ${index + 2}: missing course or title` };

  if (["resource", "download", "file", "worksheet", "pdf"].includes(type)) {
    const resourceId = pick(row, ["resourceId", "Resource ID", "Lesson ID"]) || slugify(`${course}-${normalizedSection}-${title}`);
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

  const lessonId = pick(row, ["Lesson ID", "lessonId"]) || slugify(`${course}-${normalizedSection}-${globalOrder}-${title}`);
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
const { sheetName, headers, rows } = readCurriculumWorksheet(workbook);
const firstYoutubeUrl = pick(rows[0] || {}, ["YouTube Link"]);

console.log(`Detected worksheet name: ${sheetName}`);
console.log("Detected headers:", headers);
console.log("First parsed row:");
console.log(rows[0]);
console.log(`First YouTube URL read: ${firstYoutubeUrl || ""}`);

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

console.log(`Documents updated: ${updated}`);
console.log(`Seed complete from ${workbookPath}. Created: ${created}. Updated: ${updated}. Skipped: ${skipped}.`);
