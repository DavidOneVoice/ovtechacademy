import { renderToString } from "react-dom/server";
import { StaticRouter, Routes, Route } from "react-router-dom";
import { publicPages } from "./seo/publicPages";
import SeoMetadata from "./seo/SeoMetadata";
import NotFound from "./pages/NotFound";

// Only public marketing pages are rendered during the build. Effects never run,
// so this does not query students, load regional prices, or submit any forms.
export function render(path) {
  return renderToString(<StaticRouter location={path}><SeoMetadata /><Routes>
    {publicPages.map(({ path: route, Component }) => <Route key={route} path={route} element={<Component />} />)}
    <Route path="*" element={<NotFound />} />
  </Routes></StaticRouter>);
}
