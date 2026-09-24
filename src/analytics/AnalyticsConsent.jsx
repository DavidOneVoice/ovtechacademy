import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { readConsent, subscribeConsent, serverConsent, changeConsent } from "./consent.js";
import { analyticsPage, syncAnalytics } from "./google.js";
import "./AnalyticsConsent.css";

export default function AnalyticsConsent() {
  const { pathname } = useLocation();
  const choice = useSyncExternalStore(subscribeConsent, readConsent, serverConsent);
  useEffect(() => { syncAnalytics(); }, [pathname]);
  if (choice !== "unset" || !analyticsPage(pathname) || pathname === "/analytics-and-cookies") return null;
  return <section className="analytics-choice" aria-labelledby="analytics-choice-title">
    <div><h2 id="analytics-choice-title">Help us improve your experience</h2><p>With your permission, Google Analytics uses cookies to measure visits and applications. You can use the website with analytics off. <a href="/analytics-and-cookies" target="_blank" rel="noopener noreferrer">About analytics and cookies</a></p></div>
    <div className="analytics-choice-actions"><button type="button" onClick={() => changeConsent("denied")}>Essential only</button><button type="button" onClick={() => changeConsent("granted")}>Allow analytics</button></div>
  </section>;
}
