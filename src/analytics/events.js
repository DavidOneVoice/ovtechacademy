import courses from "../data/courses.js";

const courseIds = new Set(courses.map((course) => course.id));
const events = new Set(["view_course", "begin_application", "generate_lead", "begin_checkout", "registration_complete"]);

// Keep form values out of the event boundary. The Google listener separately
// checks visitor consent and the route before forwarding these allowed fields.
export function safeEvent(name, values = {}) {
  if (!events.has(name)) return null;
  return {
    event: name,
    ...(courseIds.has(values.course_id) ? { course_id: values.course_id } : {}),
    ...(["scholarship", "tuition"].includes(values.application_type) ? { application_type: values.application_type } : {}),
  };
}

export function trackEvent(name, values) {
  const event = safeEvent(name, values);
  if (!event || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ovtech:conversion", { detail: event }));
}
