import test from "node:test";
import assert from "node:assert/strict";
import { createAnalytics, analyticsPage, safeReferrer, MEASUREMENT_ID } from "../src/analytics/google.js";
import { readConsent, changeConsent, CONSENT_KEY } from "../src/analytics/consent.js";

function environment(url = "https://ovtechacademy.com/") {
  const values = new Map();
  const scripts = [];
  const cookies = [];
  const win = Object.assign(new EventTarget(), {
    Event, location: new URL(url),
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    document: { referrer: "https://www.google.com/search?q=private@example.test", createElement: () => ({}), head: { append: (script) => scripts.push(script) } },
  });
  Object.defineProperty(win.document, "cookie", { get: () => "_ga=old; _ga_EK7YNYFWJV=old; payment_session=keep", set: (value) => cookies.push(value), configurable: true });
  return { win, scripts, cookies, values, commands: () => (win.dataLayer || []).map((command) => Array.from(command)) };
}

test("analytics makes no script or event requests before consent, after denial, or after expiry", () => {
  const { win, scripts, values, commands } = environment();
  const analytics = createAnalytics(win);
  for (const choice of [null, "denied"]) {
    if (choice) changeConsent(choice, win);
    analytics.sync();
    analytics.conversion({ event: "generate_lead", course_id: "data-analytics" });
  }
  values.set(CONSENT_KEY, JSON.stringify({ choice: "granted", expires: 1 }));
  analytics.sync();
  assert.equal(readConsent(win), "unset");
  assert.deepEqual(scripts, []);
  assert.deepEqual(commands(), []);
});

test("consent loads one tag with safe locations, no ads and manual pageviews", () => {
  const { win, scripts, commands } = environment("https://ovtechacademy.com/courses/software-development?email=private@example.test#secret");
  changeConsent("granted", win);
  const analytics = createAnalytics(win);
  analytics.sync(); analytics.sync();
  analytics.conversion({ event: "view_course", course_id: "software-development" });
  const all = commands();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].referrerPolicy, "origin");
  assert.equal(all.filter((item) => item[0] === "event" && item[1] === "page_view").length, 1);
  assert.equal(all.filter((item) => item[0] === "event" && item[1] === "view_course").length, 1);
  const config = all.find((item) => item[0] === "config")[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.page_location, "https://ovtechacademy.com/courses/software-development");
  assert.equal(config.page_referrer, "https://google.com/");
  assert.doesNotMatch(JSON.stringify(all), /private@example|secret|\?email/);
});

test("conversion reporting discards names, form fields, references and URL queries", () => {
  const { win, commands } = environment("https://ovtechacademy.com/payment-success?reference=secret-receipt&draft=secret-draft");
  changeConsent("granted", win);
  const analytics = createAnalytics(win);
  analytics.conversion({ event: "registration_complete", course_id: "software-development", application_type: "tuition", email: "private@example.test", fullName: "Private Person", reference: "secret-receipt", page_location: "bad-url" });
  const sent = commands().find((item) => item[0] === "event" && item[1] === "registration_complete");
  assert.equal(sent[2].page_location, "https://ovtechacademy.com/payment-success");
  assert.equal(sent[2].course_id, "software-development");
  assert.equal(sent[2].application_type, "tuition");
  assert.doesNotMatch(JSON.stringify(commands()), /private@example|Private Person|secret-receipt|secret-draft|bad-url/);
});

test("private routes and preview deployments stay untracked even with prior consent", () => {
  for (const url of ["https://ovtechacademy.com/lms", "https://ovtechacademy.com/admin/assistant", "https://ovtechacademy.com/attendance/private-id", "https://ovtechacademy.com/verify/private-id", "https://ovtechacademy.com/unknown", "http://localhost:5173/", "https://preview.example.test/"]) {
    const { win, scripts, commands } = environment(url);
    changeConsent("granted", win);
    const analytics = createAnalytics(win);
    analytics.sync();
    analytics.conversion({ event: "generate_lead", course_id: "data-analytics" });
    assert.equal(scripts.length, 0, url);
    assert.equal(commands().length, 0, url);
  }
});

test("revocation stops events and removes only analytics cookies, then safe navigation can resume", () => {
  const { win, cookies, commands, scripts } = environment();
  changeConsent("granted", win);
  const analytics = createAnalytics(win);
  analytics.sync();
  const eventsBefore = commands().filter((item) => item[0] === "event").length;
  changeConsent("denied", win);
  analytics.conversion({ event: "generate_lead" });
  assert.equal(win[`ga-disable-${MEASUREMENT_ID}`], true);
  assert.equal(commands().filter((item) => item[0] === "event").length, eventsBefore);
  assert.ok(cookies.length > 0);
  assert.ok(cookies.every((value) => value.startsWith("_ga")));
  changeConsent("granted", win);
  win.location = new URL("https://ovtechacademy.com/lms?email=private@example.test");
  analytics.sync();
  assert.equal(win[`ga-disable-${MEASUREMENT_ID}`], true);
  win.location = new URL("https://ovtechacademy.com/courses");
  analytics.sync();
  assert.equal(win[`ga-disable-${MEASUREMENT_ID}`], false);
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(JSON.stringify(commands()), /\/lms|private@example/);
});

test("blocked browser storage does not break the page or implicitly allow tracking", () => {
  const { win, scripts } = environment();
  win.localStorage.getItem = () => { throw new Error("blocked"); };
  win.localStorage.setItem = () => { throw new Error("blocked"); };
  Object.defineProperty(win.document, "cookie", { get: () => { throw new Error("blocked"); } });
  const analytics = createAnalytics(win);
  assert.doesNotThrow(() => analytics.sync());
  assert.equal(scripts.length, 0);
  changeConsent("granted", win);
  assert.equal(readConsent(win), "granted");
  assert.doesNotThrow(() => analytics.sync());
});

test("unknown routes and referral URLs cannot become event data", () => {
  assert.equal(analyticsPage("/attendance/secret"), null);
  assert.equal(safeReferrer("https://google.com.attacker.test/private"), "");
  assert.equal(safeReferrer("https://ovtechacademy.com/payment-success?reference=secret"), "");
  assert.equal(safeReferrer("javascript:alert(1)"), "");
});
