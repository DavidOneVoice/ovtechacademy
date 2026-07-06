import { requireConfirmation } from "./firebaseAdmin.mjs";
import {
  printAttendanceResetSummary,
  resetAttendanceTestData,
} from "./resetAttendanceTestData.mjs";
import { printLmsResetSummary, resetLmsProgress } from "./resetLmsProgress.mjs";

requireConfirmation("resetDemoData.mjs");

const attendanceSummary = await resetAttendanceTestData();
const lmsSummary = await resetLmsProgress();

console.log("Demo reset complete.");
printAttendanceResetSummary(attendanceSummary);
printLmsResetSummary(lmsSummary);
console.log(
  `Total committed operations: ${
    attendanceSummary.committedOperations + lmsSummary.committedOperations
  }`,
);
