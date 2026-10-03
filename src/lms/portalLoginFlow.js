import { requirePortalStudent } from "./portalClient.js";

// Lookup only offers choices. Authentication is established exclusively by a
// successful server login response, including during the no-PIN transition.
export async function resolvePortalLogin({ identifier, enrollments = [], selectedId = "", pin = "" }, request) {
  const contact = String(identifier || "").trim();
  if (!contact) throw new Error("Enter your registered email or WhatsApp/phone number.");
  let choices = enrollments;
  if (!choices.length) {
    const result = await request("lookup", { identifier: contact });
    choices = Array.isArray(result.enrollments) ? result.enrollments : [];
  }
  if (!choices.length) throw new Error("No enrollment was found. Use the email or phone number on your enrolled application.");
  const enrollment = choices.length === 1 ? choices[0] : choices.find((choice) => choice.id === selectedId);
  if (!enrollment) return { stage: "enrollment", enrollments: choices, selectedId: "" };
  if (enrollment.pinRequired && !pin) return { stage: "pin", enrollments: choices, selectedId: enrollment.id };
  try {
    const result = await request("login", {
      identifier: contact, studentId: enrollment.id,
      ...(enrollment.pinRequired ? { pin } : {}),
    });
    return { stage: "authenticated", session: requirePortalStudent(result) };
  } catch (error) {
    error.enrollments = choices;
    error.studentId = enrollment.id;
    throw error;
  }
}
