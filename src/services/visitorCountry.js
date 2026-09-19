import { normalizeCountryCode } from "../data/pricing.js";

// One request shared by every price on a page. Do not reuse the legacy localStorage
// country: older versions cached NG even when detection failed.
export function createVisitorCountryStore(fetcher = (...args) => fetch(...args)) {
  let state = { status: "idle", countryCode: null };
  let pending;
  const listeners = new Set();
  const publish = (next) => { state = next; listeners.forEach((listener) => listener()); };
  const load = () => {
    if (pending) return pending;
    if (state.status === "ready") return Promise.resolve();
    publish({ status: "loading", countryCode: null });
    pending = Promise.resolve().then(async () => {
      try {
        const response = await fetcher("/api/visitor-country", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Location unavailable");
        const countryCode = normalizeCountryCode((await response.json()).countryCode);
        if (!countryCode) throw new Error("Country unavailable");
        publish({ status: "ready", countryCode });
      } catch {
        publish({ status: "error", countryCode: null });
      } finally { pending = null; }
    });
    return pending;
  };
  return {
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    load,
  };
}
export const visitorCountryStore = createVisitorCountryStore();
