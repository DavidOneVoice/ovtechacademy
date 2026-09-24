import { PUBLIC_METADATA, SITE_URL, normalizePath } from "../seo/metadata.js";
import { safeEvent } from "./events.js";
import { readConsent, subscribeConsent, CONSENT_DAYS } from "./consent.js";

// Public measurement ID from the owner's ovtechacad property / web stream.
export const MEASUREMENT_ID = "G-EK7YNYFWJV";
const admissions = {
  "/register": "Full-tuition application",
  "/payment-review": "Registration review",
  "/scholarship-payment": "Scholarship payment",
  "/payment-success": "Registration confirmation",
  "/registration/complete": "Registration confirmation",
};
const denied = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const granted = { ...denied, analytics_storage: "granted" };

export function analyticsPage(pathname) {
  const path = normalizePath(pathname);
  const page = PUBLIC_METADATA[path];
  const title = page?.title || admissions[path];
  if (!title) return null; // No portal, admin, attendance, certificate or unknown URLs.
  return { path, page_location: `${SITE_URL}${path}`, page_title: title, course_id: page?.course?.id };
}

export function safeReferrer(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    const host = url.hostname.toLowerCase();
    // Only a known service's domain, never search terms, user paths or queries.
    const services = ["google.com", "google.co.uk", "google.com.ng", "bing.com", "duckduckgo.com", "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "tiktok.com", "whatsapp.com", "t.co"];
    const service = services.find((domain) => host === domain || host.endsWith(`.${domain}`));
    return service ? `https://${service}/` : "";
  } catch { return ""; }
}

export function clearAnalyticsCookies(win) {
  const doc = win.document;
  let names;
  try { names = doc.cookie.split(";").map((part) => part.trim().split("=")[0]).filter((name) => /^_ga(?:_|$)/.test(name)); }
  catch { return; } // Cookie blocking must never stop an application or portal.
  for (const name of names) {
    for (const domain of ["", `; Domain=${win.location.hostname}`, "; Domain=ovtechacademy.com", "; Domain=.ovtechacademy.com"]) {
      try { doc.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`; } catch { /* Browser storage is blocked. */ }
    }
  }
}

export function createAnalytics(win) {
  const doc = win.document;
  const disableKey = `ga-disable-${MEASUREMENT_ID}`;
  const referrer = safeReferrer(doc.referrer);
  let started = false;
  let lastPath = null;
  let viewedCourse = null;
  const gtag = function () { win.dataLayer.push(arguments); };

  function permitted() {
    return win.location.protocol === "https:" && ["ovtechacademy.com", "www.ovtechacademy.com"].includes(win.location.hostname)
      && readConsent(win) === "granted" && analyticsPage(win.location.pathname);
  }
  const pageFields = (page) => ({ page_location: page.page_location, page_title: page.page_title, page_referrer: referrer });

  function sync() {
    const page = permitted();
    win[disableKey] = !page;
    if (!page) {
      if (readConsent(win) !== "granted") {
        if (started) gtag("consent", "update", denied);
        clearAnalyticsCookies(win);
      }
      lastPath = null;
      viewedCourse = null;
      return null;
    }
    if (!started) {
      started = true;
      win.dataLayer = win.dataLayer || [];
      win.gtag = gtag;
      // Basic consent mode: even the Google script is absent before permission.
      gtag("consent", "default", denied);
      gtag("consent", "update", granted);
      gtag("set", { ...pageFields(page), allow_google_signals: false, allow_ad_personalization_signals: false, ads_data_redaction: true, url_passthrough: false });
      gtag("js", new Date());
      gtag("config", MEASUREMENT_ID, {
        ...pageFields(page), send_page_view: false,
        allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_domain: "ovtechacademy.com", cookie_expires: CONSENT_DAYS * 86400,
        cookie_update: false, cookie_flags: "SameSite=Lax;Secure",
      });
      const script = doc.createElement("script");
      script.id = "ovtech-google-analytics";
      script.async = true;
      script.referrerPolicy = "origin";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      doc.head.append(script);
    } else if (!lastPath) gtag("consent", "update", granted);
    if (page.path !== lastPath) {
      lastPath = page.path;
      viewedCourse = null;
      gtag("set", pageFields(page));
      gtag("event", "page_view", { ...pageFields(page), send_to: MEASUREMENT_ID });
      if (page.course_id) {
        viewedCourse = page.course_id;
        gtag("event", "view_course", { ...pageFields(page), course_id: page.course_id, send_to: MEASUREMENT_ID });
      }
    }
    return page;
  }

  function conversion(detail) {
    const page = sync();
    const event = detail && safeEvent(detail.event, detail);
    if (!page || !event) return;
    if (event.event === "view_course" && event.course_id === viewedCourse) return;
    if (event.event === "view_course") viewedCourse = event.course_id;
    const { event: name, ...values } = event;
    gtag("event", name, { ...pageFields(page), ...values, send_to: MEASUREMENT_ID });
  }
  return { sync, conversion };
}

let client;
export function startAnalytics() {
  if (typeof window === "undefined" || client) return;
  client = createAnalytics(window);
  subscribeConsent(() => client.sync());
  window.addEventListener("ovtech:conversion", (event) => client.conversion(event.detail));
  document.addEventListener("visibilitychange", () => client.sync());
  client.sync();
}
export function syncAnalytics() { client?.sync(); }
