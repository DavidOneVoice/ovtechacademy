import { recordCohortId } from "../data/cohort.js";

export const STUDENT_EMAIL_FIELDS = ["email", "emailAddress", "studentEmail"];
export const STUDENT_PHONE_FIELDS = [
  "whatsapp", "whatsApp", "whatsappNumber", "phone", "phoneNumber", "mobile", "mobileNumber",
];

const normalize = (value) => String(value || "").trim().toLowerCase();
export const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

// Scholarship approval is an offer, not enrollment. Preserve paid legacy
// registrations and the existing October payment/registration requirements.
export const isPaidOrEnrolled = (student) => {
  if (student?.cohortId === "october-2026") {
    return student.status === "Enrolled" && (student.applicationType !== "tuition" ||
      (student.paymentVerified === true && student.registrationStatus === "submitted"));
  }
  const statuses = [student?.status, student?.paymentStatus, student?.enrollmentStatus].map(normalize);
  return statuses.some((status) => ["enrolled", "paid", "successful"].includes(status));
};

const enrollmentPriority = (student) =>
  [student.status, student.enrollmentStatus].some((status) => normalize(status) === "enrolled") ? 2 : 1;

const fieldMatches = (student, fields, value, normalizer) =>
  Boolean(value) && fields.some((field) => student[field] && normalizer(student[field]) === value);

export const getStudentLogin = (student) => ({
  email: STUDENT_EMAIL_FIELDS.map((field) => student?.[field]).find((value) => String(value || "").trim()) || "",
  whatsapp: STUDENT_PHONE_FIELDS.map((field) => student?.[field]).find((value) => String(value || "").trim()) || "",
});

export function getStudentLookupFilters(login) {
  const email = String(login.email || "").trim();
  const phone = String(login.whatsapp || "").trim();
  return [
    ...STUDENT_EMAIL_FIELDS.flatMap((field) => [...new Set([email, normalize(email)])]
      .filter(Boolean).map((value) => ({ field, value }))),
    ...STUDENT_PHONE_FIELDS.flatMap((field) => [...new Set([phone, normalizePhone(phone)])]
      .filter(Boolean).map((value) => ({ field, value }))),
  ];
}

export function findEligibleStudents(students, login) {
  const email = normalize(login.email);
  const phone = normalizePhone(login.whatsapp);
  const matches = [...new Map(students.map((student) => [student.id, student])).values()]
    .filter((student) => isPaidOrEnrolled(student) && (
      fieldMatches(student, STUDENT_EMAIL_FIELDS, email, normalize) ||
      fieldMatches(student, STUDENT_PHONE_FIELDS, phone, normalizePhone)
    ));
  // Never break an enrollment tie using Firestore document order. The learner
  // chooses when more than one enrolled course/cohort shares their details.
  return matches.sort((a, b) => enrollmentPriority(b) - enrollmentPriority(a) || a.id.localeCompare(b.id));
}

export async function lookupStudents(login, findByField) {
  const results = await Promise.all(getStudentLookupFilters(login)
    .map(({ field, value }) => findByField(field, value)));
  return findEligibleStudents(results.flat(), login);
}

export async function restoreStudentEnrollment(student, lookup) {
  // Keep a valid, deliberately selected enrollment, including older cohorts.
  if (isPaidOrEnrolled(student)) return [student];
  const matches = await lookup(getStudentLogin(student));
  return matches.filter((match) => recordCohortId(match) === recordCohortId(student));
}
