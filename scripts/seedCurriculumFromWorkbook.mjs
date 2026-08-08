import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import {
  getFirestore,
  initializeFirebaseAdmin,
  projectRoot,
  serviceAccountPath,
} from "./firebaseAdmin.mjs";

const SUPPORTED_GROUPS = new Set(["data-analytics", "computer-programming"]);
const DEFAULT_WORKBOOK_PATH = path.join(projectRoot, "data", "OVTech Master Curriculum.xlsx");
const REQUIRED_HEADERS = ["Global Order", "Course", "Section", "Lesson ID", "Course Order", "Type", "Title", "Unlock Day"];

const getArgument = (name) => {
  const argument = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return argument ? argument.slice(name.length + 3) : "";
};
const positionalFile = process.argv.slice(2).find((value) => !value.startsWith("--"));
const workbookPath = path.resolve(getArgument("file") || positionalFile || DEFAULT_WORKBOOK_PATH);
const curriculumGroup = getArgument("group") || "data-analytics";

const normalizeHeader = (value) => String(value || "").trim().replace(/\s+/g, " ");
const cell = (row, name) => row[name] === undefined || row[name] === null ? "" : row[name];
const textValue = (value) => String(value ?? "").trim();
const positiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const boolValue = (value, fallback = true) => value === undefined || value === ""
  ? fallback
  : !["false", "no", "0", "draft", "unpublished"].includes(String(value).toLowerCase());
const isYoutubeUrl = (value) => {
  try {
    const url = new URL(value);
    return ["youtube.com", "www.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname);
  } catch {
    return false;
  }
};
const stableId = (lessonId) => curriculumGroup === "data-analytics"
  ? textValue(lessonId)
  : `${curriculumGroup}__${textValue(lessonId).replace(/\s+/g, "")}`;

const parseWorksheet = (workbook) => {
  for (const sheetName of workbook.SheetNames) {
    const values = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", blankrows: false });
    const headerRowIndex = values.findIndex((row) => {
      const headers = new Set(row.map(normalizeHeader));
      return REQUIRED_HEADERS.every((header) => headers.has(header));
    });
    if (headerRowIndex < 0) continue;
    const headers = values[headerRowIndex].map(normalizeHeader);
    const rows = values.slice(headerRowIndex + 1).map((rowValues, offset) => ({
      rowNumber: headerRowIndex + offset + 2,
      values: headers.reduce((row, header, index) => {
        if (header) row[header] = rowValues[index] ?? "";
        return row;
      }, {}),
    })).filter(({ values: row }) => Object.values(row).some((value) => textValue(value)));
    return { sheetName, rows };
  }
  throw new Error(`No worksheet has all required headers: ${REQUIRED_HEADERS.join(", ")}`);
};

const validateAndNormalize = (rows) => {
  const warnings = [];
  const seenLessonIds = new Map();
  const seenOrders = new Map();
  const validRows = [];

  for (const { rowNumber, values: row } of rows) {
    const lessonId = textValue(cell(row, "Lesson ID"));
    const globalOrder = positiveNumber(cell(row, "Global Order"));
    const courseOrder = positiveNumber(cell(row, "Course Order"));
    const course = textValue(cell(row, "Course"));
    const section = textValue(cell(row, "Section"));
    const requestedType = textValue(cell(row, "Type")).toLowerCase();
    const title = textValue(cell(row, "Title"));
    const unlockDay = positiveNumber(cell(row, "Unlock Day"));
    const youtubeUrl = textValue(cell(row, "YouTube Link"));
    const downloadUrl = textValue(cell(row, "Downloadable Resource"));
    const errors = [];

    if (!globalOrder) errors.push("missing or invalid Global Order");
    if (!course) errors.push("missing Course");
    if (!section) errors.push("missing Section");
    if (!lessonId) errors.push("missing Lesson ID");
    if (!courseOrder) errors.push("missing or invalid Course Order");
    if (!requestedType) errors.push("missing Type");
    if (!title) errors.push("missing Title");
    if (!unlockDay) errors.push("missing or invalid Unlock Day");

    const type = ["resource", "download", "file", "worksheet", "pdf"].includes(requestedType) ? "resource" : requestedType === "video" ? "video" : "";
    if (requestedType && !type) errors.push(`unsupported Type "${requestedType}"`);
    if (type === "video" && !youtubeUrl) errors.push("Video is missing YouTube Link");
    if (type === "video" && youtubeUrl && !isYoutubeUrl(youtubeUrl)) errors.push("invalid YouTube URL");
    if (type === "resource" && !downloadUrl) errors.push("Resource is missing Downloadable Resource");

    const normalizedLessonId = lessonId.toLowerCase();
    if (lessonId && seenLessonIds.has(normalizedLessonId)) {
      errors.push(`duplicate Lesson ID (also row ${seenLessonIds.get(normalizedLessonId)})`);
    } else if (lessonId) seenLessonIds.set(normalizedLessonId, rowNumber);
    if (globalOrder && seenOrders.has(globalOrder)) {
      errors.push(`duplicate Global Order (also row ${seenOrders.get(globalOrder)})`);
    } else if (globalOrder) seenOrders.set(globalOrder, rowNumber);

    if (errors.length) {
      warnings.push(`Row ${rowNumber}: ${errors.join("; ")}`);
      continue;
    }

    const id = stableId(lessonId);
    const common = {
      curriculumGroup,
      course,
      section,
      module: section,
      globalOrder,
      lessonOrder: courseOrder,
      courseOrder,
      title,
      type,
      unlockDay,
      week: cell(row, "Week"),
      lectureDate: cell(row, "Lecture Date"),
      dayOfWeek: cell(row, "Day of Week"),
      isPublished: boolValue(cell(row, "Published")),
    };
    validRows.push(type === "video" ? {
      collectionName: "curriculum", id,
      data: { ...common, lessonId: id, sourceLessonId: lessonId, youtubeUrl },
    } : {
      collectionName: "lmsResources", id,
      data: { ...common, resourceId: id, sourceLessonId: lessonId, fileType: "link", fileName: title, downloadUrl, storagePath: "" },
    });
  }

  const unlockDays = [...new Set(validRows.map((row) => row.data.unlockDay))].sort((a, b) => a - b);
  unlockDays.forEach((day, index) => {
    if (day !== index + 1) warnings.push(`Unlock sequence gap: expected Day ${index + 1}, found Day ${day}.`);
  });
  return { validRows, warnings, skipped: rows.length - validRows.length };
};

if (!SUPPORTED_GROUPS.has(curriculumGroup)) {
  console.error(`Unsupported --group=${curriculumGroup}. Use: ${[...SUPPORTED_GROUPS].join(", ")}`);
  process.exit(1);
}
if (!existsSync(workbookPath)) {
  console.error(`Workbook not found: ${workbookPath}`);
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer", cellDates: true });
const { sheetName, rows } = parseWorksheet(workbook);
const { validRows, warnings, skipped } = validateAndNormalize(rows);
console.log(`Validated ${rows.length} row(s) from "${sheetName}" for ${curriculumGroup}.`);
warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
if (!validRows.length) {
  console.error("No valid curriculum rows to import.");
  process.exit(1);
}
if (!existsSync(serviceAccountPath)) {
  console.error(`Validation complete, but Firebase Admin service account was not found: ${serviceAccountPath}`);
  process.exit(1);
}

const admin = await initializeFirebaseAdmin();
const db = await getFirestore();
let created = 0;
let updated = 0;
for (const row of validRows) {
  const ref = db.collection(row.collectionName).doc(row.id);
  const existing = await ref.get();
  if (existing.exists && existing.data().curriculumGroup && existing.data().curriculumGroup !== curriculumGroup) {
    console.warn(`Skipped ${row.collectionName}/${row.id}: belongs to ${existing.data().curriculumGroup}.`);
    continue;
  }
  await ref.set({
    ...row.data,
    createdAt: existing.exists ? existing.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  if (existing.exists) updated += 1;
  else created += 1;
}
console.log(`Import complete for ${curriculumGroup}: ${created} created, ${updated} updated, ${skipped} skipped.`);
