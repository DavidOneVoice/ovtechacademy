export const CONSENT_KEY = "ovtech:analytics-consent:v1";
export const CONSENT_EVENT = "ovtech:analytics-consent-changed";
export const CONSENT_DAYS = 180;
const choices = new Set(["granted", "denied"]);
const memory = new WeakMap();
const browser = () => typeof window === "undefined" ? null : window;

export function readConsent(win = browser(), now = Date.now()) {
  if (!win) return "pending";
  const temporary = memory.get(win);
  if (temporary?.expires > now) return temporary.choice;
  try {
    const saved = JSON.parse(win.localStorage.getItem(CONSENT_KEY));
    return choices.has(saved?.choice) && saved.expires > now ? saved.choice : "unset";
  } catch {
    const saved = memory.get(win);
    return saved?.expires > now ? saved.choice : "unset";
  }
}

export function changeConsent(choice, win = browser()) {
  if (!win || !choices.has(choice)) return;
  const saved = { choice, expires: Date.now() + CONSENT_DAYS * 86400000 };
  try { win.localStorage.setItem(CONSENT_KEY, JSON.stringify(saved)); memory.delete(win); }
  catch { memory.set(win, saved); }
  win.dispatchEvent(new win.Event(CONSENT_EVENT));
}

export function subscribeConsent(listener) {
  const win = browser();
  if (!win) return () => {};
  const storage = (event) => { if (!event.key || event.key === CONSENT_KEY) { memory.delete(win); listener(); } };
  win.addEventListener(CONSENT_EVENT, listener);
  win.addEventListener("storage", storage);
  return () => {
    win.removeEventListener(CONSENT_EVENT, listener);
    win.removeEventListener("storage", storage);
  };
}
export const serverConsent = () => "pending";
