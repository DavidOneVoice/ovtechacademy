import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { render } from "../dist-ssr/entry-server.js";
import { PUBLIC_PATHS, PRIVATE_PATHS, SITE_URL, metadataForPath, renderMetadata, escapeHtml } from "../src/seo/metadata.js";

const directory = join(process.cwd(), "dist");
const template = await readFile(join(directory, "index.html"), "utf8");
const verification = process.env.GOOGLE_SITE_VERIFICATION || "";
const head = (page) => template.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n${renderMetadata(page, verification)}\n<!--seo:end-->`);
if (!template.includes('<!--seo:start-->') || !template.includes('<div id="root"></div>')) throw new Error("Prerender template markers are missing.");

// The application shell is separate from the indexable home page. Private,
// payment and utility routes must never inherit the homepage canonical/schema.
await writeFile(join(directory, "app.html"), head(metadataForPath("/lms")));
for (const path of PUBLIC_PATHS) {
  const filename = join(directory, path === "/" ? "index.html" : `${path.slice(1)}.html`);
  await mkdir(dirname(filename), { recursive: true });
  const body = render(path);
  if (!body.includes("<h1")) throw new Error(`Public page ${path} did not render its content.`);
  const html = head(metadataForPath(path)).replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${body}</div>`);
  await writeFile(filename, html);
}
await writeFile(join(directory, "404.html"), head({ ...metadataForPath("/not-found"), title: "Page not found | OVTech Academy" }).replace('<div id="root"></div>', `<div id="root">${render("/not-found")}</div>`));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_PATHS.map((path) => `  <url><loc>${escapeHtml(`${SITE_URL}${path}`)}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(directory, "sitemap.xml"), sitemap);
await writeFile(join(directory, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const sourceRedirects = await readFile("public/_redirects", "utf8");
const preserved = sourceRedirects.split("\n").filter((line) => line && !line.startsWith("/* "));
// Netlify normalizes trailing slashes before matching rules. Never redirect a
// path to the same path with only its slash changed: that causes a loop.
const marketing = PUBLIC_PATHS.filter((path) => path !== "/").flatMap((path) => [
  `${path}/index.html ${path} 301!`, `${path}.html ${path} 301!`, `${path} ${path}.html 200!`,
]);
const applications = PRIVATE_PATHS.map((path) => `${path} /app.html 200`);
await writeFile(join(directory, "_redirects"), [...preserved, ...marketing, ...applications,
  "/admin/* /app.html 200", "/verify/* /app.html 200", "/attendance/* /app.html 200", "/* /404.html 404", "",
].join("\n"));
const privateHeaders = [...PRIVATE_PATHS.flatMap((path) => [path, `${path}/`]), "/admin/*", "/verify/*", "/attendance/*", "/api/*", "/app.html", "/404.html"]
  .map((path) => `${path}\n  X-Robots-Tag: noindex, nofollow\n`).join("\n");
await writeFile(join(directory, "_headers"), `${privateHeaders}\n/robots.txt\n  Content-Type: text/plain; charset=utf-8\n\n/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n`);
console.log(`Prerendered ${PUBLIC_PATHS.length} public pages; generated sitemap, crawler rules, route metadata, and utility-page noindex headers.`);
