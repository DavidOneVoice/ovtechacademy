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
const args = process.argv.slice(2);

const getArgument = (name) => {
  const argument = args.find((value) => value.startsWith(`--${name}=`));
  return argument ? argument.slice(name.length + 3) : "";
};
const positionalFile = args.find((value) => !value.startsWith("--"));
const workbookPath = path.resolve(getArgument("file") || positionalFile || DEFAULT_WORKBOOK_PATH);
const curriculumGroup = getArgument("group") || "data-analytics";
const dryRun = args.includes("--dry-run");

const normalizeHeader = (value) => String(value || "").trim().replace(/\s+/g, " ");
const cell = (row, name) => row[name] === undefined || row[name] === null ? "" : row[name];
const textValue = (value) => String(value ?? "").trim();
const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const boolValue = (value, fallback = true) => value === undefined || value === ""
  ? fallback
  : !["false", "no", "0", "draft", "unpublished"].includes(String(value).trim().toLowerCase());
const isYoutubeUrl = (value) => {
  try {
    const url = new URL(value);
    return ["youtube.com", "www.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};
const normalizedSourceId = (lessonId) => textValue(lessonId).replace(/[^a-z0-9]/gi, "").toUpperCase();
const stableId = (lessonId) => curriculumGroup === "data-analytics"
  ? textValue(lessonId)
  : `${curriculumGroup}__${normalizedSourceId(lessonId)}`;

const parseWorksheet = (workbook) => {
  const preferredSheets = workbook.SheetNames.includes("Master Curriculum")
    ? ["Master Curriculum"]
    : workbook.SheetNames;
  for (const sheetName of preferredSheets) {
    const worksheet = workbook.Sheets[sheetName];
    const values = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", blankrows: true });
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
    const physicalRows = XLSX.utils.decode_range(worksheet["!ref"]).e.r + 1;
    return { sheetName, rows, physicalRows };
  }
  throw new Error(`No worksheet has all required headers: ${REQUIRED_HEADERS.join(", ")}`);
};

const rowDescription = (rowNumber, row) => ({
  rowNumber,
  globalOrder: textValue(cell(row, "Global Order")),
  lessonId: textValue(cell(row, "Lesson ID")),
  type: textValue(cell(row, "Type")),
  course: textValue(cell(row, "Course")),
  section: textValue(cell(row, "Section")),
  title: textValue(cell(row, "Title")),
});

const validateAndNormalize = (rows) => {
  const invalidRows = [];
  const collisions = [];
  const seenIds = new Map();
  const seenOrders = new Map();
  const validRows = [];

  for (const { rowNumber, values: row } of rows) {
    const sourceLessonId = textValue(cell(row, "Lesson ID"));
    const globalOrder = positiveInteger(cell(row, "Global Order"));
    const courseOrder = positiveInteger(cell(row, "Course Order"));
    const course = textValue(cell(row, "Course"));
    const section = textValue(cell(row, "Section"));
    const requestedType = String(cell(row, "Type") || "").trim().toLowerCase();
    const title = textValue(cell(row, "Title"));
    const unlockDay = positiveInteger(cell(row, "Unlock Day"));
    const youtubeUrl = textValue(cell(row, "YouTube Link"));
    const downloadUrl = textValue(cell(row, "Downloadable Resource"));
    const errors = [];

    if (!globalOrder) errors.push("missing or invalid positive-integer Global Order");
    if (!course) errors.push("missing Course");
    if (!section) errors.push("missing Section");
    if (!sourceLessonId) errors.push("missing Lesson ID");
    if (!courseOrder) errors.push("missing or invalid positive-integer Course Order");
    if (!requestedType) errors.push("missing Type");
    if (!title) errors.push("missing Title");
    if (!unlockDay) errors.push("missing or invalid positive-integer Unlock Day");

    const type = requestedType === "video" || requestedType === "resource" ? requestedType : "";
    if (requestedType && !type) errors.push(`unsupported Type "${requestedType}" (expected Video or Resource)`);
    if (type === "video" && !youtubeUrl) errors.push("Video is missing YouTube Link");
    if (type === "video" && youtubeUrl && !isYoutubeUrl(youtubeUrl)) errors.push(`invalid YouTube URL "${youtubeUrl}"`);
    if (type === "resource" && !downloadUrl) errors.push("Resource is missing Downloadable Resource");

    const id = sourceLessonId ? stableId(sourceLessonId) : "";
    if (id && seenIds.has(id)) {
      const firstRow = seenIds.get(id);
      const reason = `generated ID collision "${id}" (also Excel row ${firstRow})`;
      errors.push(reason);
      collisions.push({ id, firstRow, rowNumber });
    } else if (id) seenIds.set(id, rowNumber);
    if (globalOrder && seenOrders.has(globalOrder)) {
      errors.push(`duplicate Global Order ${globalOrder} (also Excel row ${seenOrders.get(globalOrder)})`);
    } else if (globalOrder) seenOrders.set(globalOrder, rowNumber);

    if (errors.length) {
      invalidRows.push({ ...rowDescription(rowNumber, row), reasons: errors });
      continue;
    }

    const common = {
      curriculumGroup, course, section, module: section, globalOrder,
      lessonOrder: courseOrder, courseOrder, title, type, unlockDay,
      week: cell(row, "Week"), lectureDate: cell(row, "Lecture Date"),
      dayOfWeek: cell(row, "Day of Week"), isPublished: boolValue(cell(row, "Published")),
    };
    validRows.push(type === "video" ? {
      rowNumber, collectionName: "curriculum", id,
      data: { ...common, lessonId: id, sourceLessonId, youtubeUrl },
    } : {
      rowNumber, collectionName: "lmsResources", id,
      data: { ...common, resourceId: id, sourceLessonId, fileType: "link", fileName: title, downloadUrl, storagePath: "" },
    });
  }
  return { validRows, invalidRows, collisions };
};

const printDetectionReport = ({ sheetName, rows, physicalRows }, validation) => {
  const courses = new Map();
  let videos = 0;
  let resources = 0;
  for (const { values: row } of rows) {
    const course = textValue(cell(row, "Course"));
    const type = String(cell(row, "Type") || "").trim().toLowerCase();
    if (!courses.has(course)) courses.set(course, { videos: 0, resources: 0 });
    if (type === "video") { courses.get(course).videos += 1; videos += 1; }
    if (type === "resource") { courses.get(course).resources += 1; resources += 1; }
  }
  const orders = rows.map(({ values }) => positiveInteger(cell(values, "Global Order"))).filter(Boolean);
  console.log(`Workbook:\n${workbookPath}\n\nWorksheet:\n${sheetName}`);
  console.log(`\nPhysical worksheet rows: ${physicalRows}`);
  console.log(`Last actual curriculum row: ${rows.at(-1)?.rowNumber ?? "none"}`);
  console.log(`Global Order: ${orders.length ? `${Math.min(...orders)} through ${Math.max(...orders)}` : "none"}`);
  console.log("\nCURRICULUM DETECTED");
  for (const [course, counts] of courses) {
    console.log(`\n${course}\nVideos: ${counts.videos}\nResources: ${counts.resources}\nTotal: ${counts.videos + counts.resources}`);
  }
  console.log(`\nTOTAL\nVideos: ${videos}\nResources: ${resources}\nTotal curriculum items: ${rows.length}`);
  console.log(`\nVALIDATION\nValid rows: ${validation.validRows.length}\nInvalid/skipped rows: ${validation.invalidRows.length}\nGenerated ID collisions: ${validation.collisions.length}`);
  if (validation.invalidRows.length) {
    console.log("\nINVALID/SKIPPED ROWS");
    for (const row of validation.invalidRows) {
      console.log(`Excel row ${row.rowNumber} | Global Order: ${row.globalOrder || "(missing)"} | Lesson ID: ${row.lessonId || "(missing)"} | Type: ${row.type || "(missing)"} | Course: ${row.course || "(missing)"} | Section: ${row.section || "(missing)"} | Title: ${row.title || "(missing)"} | Reason: ${row.reasons.join("; ")}`);
    }
  }
};

const comparableData = (data) => Object.fromEntries(Object.entries(data).filter(([key]) => !["createdAt", "updatedAt"].includes(key)));
const isUnchanged = (existing, intended) => JSON.stringify(comparableData(existing)) === JSON.stringify(comparableData({ ...existing, ...intended }));

if (!SUPPORTED_GROUPS.has(curriculumGroup)) throw new Error(`Unsupported --group=${curriculumGroup}. Use: ${[...SUPPORTED_GROUPS].join(", ")}`);
if (!existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);

const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer", cellDates: true });
const parsed = parseWorksheet(workbook);
const validation = validateAndNormalize(parsed.rows);
printDetectionReport(parsed, validation);
if (!validation.validRows.length || validation.invalidRows.length || validation.collisions.length) {
  console.error("\nImport blocked: every workbook row must pass validation and generated IDs must be unique.");
  process.exitCode = 1;
} else if (!existsSync(serviceAccountPath)) {
  if (dryRun) {
    console.log(`\nFIRESTORE PLAN\nComparison unavailable: Firebase Admin service account not found at ${serviceAccountPath}.`);
    console.log("Would create/update/skip unchanged: unknown until Firestore comparison can run.");
    console.log("\nDRY RUN COMPLETE — zero Firestore writes.");
  } else {
    throw new Error(`Validation complete, but Firebase Admin service account was not found: ${serviceAccountPath}`);
  }
} else {
  const admin = await initializeFirebaseAdmin();
  const db = await getFirestore();
  const refs = validation.validRows.map((row) => db.collection(row.collectionName).doc(row.id));
  const snapshots = await db.getAll(...refs);
  const plan = { create: [], update: [], unchanged: [], protected: [] };
  validation.validRows.forEach((row, index) => {
    const snapshot = snapshots[index];
    const existing = snapshot.exists ? snapshot.data() : null;
    if (existing?.curriculumGroup && existing.curriculumGroup !== curriculumGroup) plan.protected.push(row);
    else if (!existing) plan.create.push(row);
    else if (isUnchanged(existing, row.data)) plan.unchanged.push(row);
    else plan.update.push({ ...row, existing });
  });
  console.log(`\nFIRESTORE PLAN\nWould create: ${plan.create.length}\nWould update: ${plan.update.length}\nWould skip unchanged: ${plan.unchanged.length}\nWould skip protected: ${plan.protected.length}`);
  for (const row of plan.create) console.log(`CREATE ${row.collectionName}/${row.id} (Excel row ${row.rowNumber})`);
  for (const row of plan.update) console.log(`UPDATE ${row.collectionName}/${row.id} (Excel row ${row.rowNumber})`);
  for (const row of plan.unchanged) console.log(`UNCHANGED ${row.collectionName}/${row.id} (Excel row ${row.rowNumber})`);
  for (const row of plan.protected) console.log(`PROTECTED ${row.collectionName}/${row.id} (Excel row ${row.rowNumber}): belongs to another curriculum group`);

  if (dryRun) {
    console.log("\nDRY RUN COMPLETE — zero Firestore writes.");
  } else if (plan.protected.length) {
    throw new Error("Import blocked because one or more generated IDs belong to another curriculum group.");
  } else {
    const writes = [...plan.create, ...plan.update];
    const batch = db.batch();
    for (const row of writes) {
      const existing = row.existing;
      batch.set(db.collection(row.collectionName).doc(row.id), {
        ...row.data,
        createdAt: existing?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (writes.length) await batch.commit();
    console.log(`Import complete for ${curriculumGroup}: ${plan.create.length} created, ${plan.update.length} updated, ${plan.unchanged.length} unchanged.`);
  }
}
