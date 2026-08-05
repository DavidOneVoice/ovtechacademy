import { requireConfirmation } from "./firebaseAdmin.mjs";
import { resetAttendanceTestData } from "./resetAttendanceTestData.mjs";
import { resetLmsProgress } from "./resetLmsProgress.mjs";

requireConfirmation("resetDemoData.mjs");

await resetAttendanceTestData();
await resetLmsProgress();

