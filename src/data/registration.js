import { findCourse } from "./courses.js";
export const AGE_RANGES = ["Below 18", "18 - 24", "25 - 34", "35 - 44", "45+"];
export const REFERRALS = ["Facebook", "Instagram", "WhatsApp", "LinkedIn", "Friend / Referral", "Other"];
export const emptyRegistration = (courseId = "") => ({
  fullName: "", email: "", whatsapp: "", location: "", ageRange: "",
  courseId: findCourse(courseId)?.id || "", learningMethod: "", reason: "", referral: "", referralCode: "",
});
export function validateRegistration(input, type = "tuition") {
  const form = Object.fromEntries(Object.keys(emptyRegistration()).map((key) => [key, typeof input?.[key] === "string" ? input[key].trim() : ""]));
  const course = findCourse(form.courseId);
  if (!course) throw new Error("Please select a course.");
  if (form.fullName.length < 2 || form.fullName.length > 120) throw new Error("Enter your full name (2–120 characters).");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.email.length > 254) throw new Error("Enter a valid email address.");
  form.email = form.email.toLowerCase();
  if (!/^\+?[0-9][0-9 ()-]{7,24}$/.test(form.whatsapp)) throw new Error("Enter a valid WhatsApp number, including your country code if outside Nigeria.");
  if (form.location.length < 2 || form.location.length > 180) throw new Error("Enter your city and country.");
  if (!AGE_RANGES.includes(form.ageRange)) throw new Error("Select your age range.");
  if (!REFERRALS.includes(form.referral)) throw new Error("Select how you heard about us.");
  if (form.reason.length > 2000 || form.referralCode.length > 80) throw new Error("Your response is too long. Please shorten it.");
  if (type === "scholarship") {
    if (form.reason.length < 10) throw new Error("Tell us briefly why you are applying for a scholarship.");
    form.learningMethod = course.scholarshipMethod;
  } else if (course.tuitionMethods.length === 1) {
    form.learningMethod = course.tuitionMethods[0];
  } else if (!course.tuitionMethods.includes(form.learningMethod)) {
    throw new Error("Select an available learning method.");
  }
  return form;
}
