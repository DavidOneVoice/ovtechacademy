import test from "node:test";
import assert from "node:assert/strict";
import { safeEvent, trackEvent } from "../src/analytics/events.js";

test("conversion events discard personal information, payment references and arbitrary fields", () => {
  assert.deepEqual(safeEvent("generate_lead", {
    course_id: "software-development", application_type: "scholarship",
    email: "private@example.test", fullName: "Private Person", whatsapp: "+1234567890",
    payment_reference: "secret-reference", url: "/payment-success?reference=secret", value: 123,
  }), { event: "generate_lead", course_id: "software-development", application_type: "scholarship" });
  assert.deepEqual(safeEvent("view_course", { course_id: "private@example.test", application_type: "arbitrary" }), { event: "view_course" });
  assert.equal(safeEvent("private@example.test"), null);
});

test("measurement hooks are safe during static rendering without a browser or external destination", () => {
  assert.doesNotThrow(() => trackEvent("view_course", { course_id: "data-analytics" }));
});
