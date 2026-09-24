import { Suspense } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { StaticRouter, Routes, Route, matchPath } from "react-router-dom";
import { publicPages } from "./seo/publicPages";
import SeoMetadata from "./seo/SeoMetadata";
import AnalyticsConsent from "./analytics/AnalyticsConsent";
import NotFound from "./pages/NotFound";

// Only public marketing pages are rendered during the build. Effects never run,
// so this does not query students, load regional prices, or submit any forms.
export async function render(path) {
  const errors = [];
  // Wait for route modules so crawlers still receive the complete page, while
  // visitors only download the code needed for the route they actually open.
  const { prelude } = await prerenderToNodeStream(<StaticRouter location={path}><SeoMetadata /><AnalyticsConsent /><Suspense fallback={<p role="status" className="route-loading">Loading…</p>}><Routes>
    {publicPages.map(({ path: route, Component }) => <Route key={route} path={route} element={<Component />} />)}
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></StaticRouter>, { onError: (error) => errors.push(error) });
  let html = "";
  for await (const chunk of prelude) html += chunk.toString();
  if (errors.length) throw errors[0];
  return html;
}

export const pageModuleForPath = (path) => publicPages.find((page) => matchPath(page.path, path))?.module;
