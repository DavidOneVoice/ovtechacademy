import { getPhoneCountry, validateWhatsAppNumber } from "../data/phoneNumbers.js";
import { STUDENT_EMAIL_FIELDS, STUDENT_PHONE_FIELDS } from "./enrollment.js";

const firstValue = (student, fields) => fields.map((key) => student?.[key])
  .find((value) => typeof value === "string" && value.trim()) || "";

export const portalIdentifierForStudent = (student) =>
  firstValue(student, STUDENT_EMAIL_FIELDS) || firstValue(student, STUDENT_PHONE_FIELDS);

export function getPortalProfileForm(student) {
  return {
    fullName: student?.fullName || student?.name || student?.studentName || "",
    email: firstValue(student, STUDENT_EMAIL_FIELDS),
    // Do not infer a country from legacy local phone numbers.
    phoneCountry: getPhoneCountry(student?.phoneCountry) ? student.phoneCountry : "",
    whatsapp: student?.phoneNationalNumber || firstValue(student, STUDENT_PHONE_FIELDS),
  };
}

export function buildPortalProfilePayload(form, pin = "", { includePhone = true } = {}) {
  const fullName = String(form.fullName || "").trim();
  const email = String(form.email || "").trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 150) throw new Error("Enter your full name using 2–150 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  const phone = includePhone ? validateWhatsAppNumber(form) : null;
  return {
    fullName, email,
    ...(phone ? { phoneCountry: phone.phoneCountry, phoneNationalNumber: phone.phoneNationalNumber } : {}),
    ...(pin ? { pin } : {}),
  };
}

export function portalProfileContactChanged(student, form, { includePhone = true } = {}) {
  const email = String(form.email || "").trim().toLowerCase();
  if (email !== firstValue(student, STUDENT_EMAIL_FIELDS).trim().toLowerCase()) return true;
  if (!includePhone) return false;
  let number;
  try { number = validateWhatsAppNumber(form); }
  catch { return true; }
  let previous = firstValue(student, STUDENT_PHONE_FIELDS);
  if (getPhoneCountry(student?.phoneCountry)) {
    try { previous = validateWhatsAppNumber({
      phoneCountry: student.phoneCountry,
      whatsapp: student.phoneNationalNumber || previous,
    }).whatsapp; } catch { /* A legacy malformed contact must be corrected explicitly. */ }
  }
  return number.whatsapp !== previous || number.phoneCountry !== (student?.phoneCountry || "");
}
