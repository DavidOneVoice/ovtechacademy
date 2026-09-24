import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PUBLIC_PATHS, PRIVATE_PATHS, SITE_URL, metadataForPath, escapeHtml, normalizePath } from "../src/seo/metadata.js";

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");
const sitemap = await read("sitemap.xml");
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(locations.sort(), PUBLIC_PATHS.map((path) => `${SITE_URL}${path}`).sort());
for (const path of PUBLIC_PATHS) {
  const html = (await read(path === "/" ? "index.html" : `${path.slice(1)}.html`)).replaceAll("&#x27;", "&#39;");
  const page = metadataForPath(path);
  assert.equal((html.match(/<title>/g) || []).length, 1, `${path}: one title`);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, `${path}: one canonical`);
  assert.ok(html.includes(`<title>${escapeHtml(page.title)}</title>`), `${path}: correct title`);
  assert.ok(html.includes(`href="${page.canonical}"`), `${path}: correct canonical`);
  assert.match(html, /<div id="root" data-prerendered="true">/);
  assert.match(html, /<h1[ >]/, `${path}: real page heading before JavaScript`);
  assert.doesNotMatch(html, /class="route-loading"|<!--\$!-->/, `${path}: lazy route finished rendering`);
  assert.equal((html.match(/property="og:image"/g) || []).length, 1, `${path}: one share image`);
  assert.ok(html.includes(`content="${page.image}"`), `${path}: relevant share image`);
  for (const [, asset] of html.matchAll(/(?:href|src)="\/(assets\/[^"?]+)"/g)) await read(asset);
  if (path === "/" || path.startsWith("/guides")) assert.doesNotMatch(html, /(?:href|src)="\/assets\/(?:firebase|ApplicationForm|Admin|LmsDashboard)-/, `${path}: no unrelated application preloads`);
  assert.doesNotMatch(html, /name="robots" content="noindex/);
  const schema = html.match(/<script id="ovtech-structured-data" type="application\/ld\+json">(.*?)<\/script>/s);
  assert.deepEqual(JSON.parse(schema[1]), page.structuredData);
  if (page.course) {
    for (const topic of page.course.outline) assert.ok(html.includes(escapeHtml(topic)), `${path}: curriculum rendered`);
    assert.ok(html.includes("Questions about this course"));
    assert.doesNotMatch(html, /₦|£|\$[\d,]+/, `${path}: no build-machine regional fees`);
  }
  if (page.guide) {
    for (const section of page.guide.sections) assert.ok(html.includes(escapeHtml(section.heading)));
  }
}
for (const file of ["app.html", "404.html"]) {
  const html = await read(file);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /rel="canonical"|ovtech-structured-data/);
}
const robots = await read("robots.txt");
assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
assert.doesNotMatch(robots, /Disallow: \/(?:lms|admin|register)/, "crawlers must see noindex instructions");
const redirects = await read("_redirects");
const rules = redirects.split("\n").filter((line) => line && !line.startsWith("#")).map((line) => line.trim().split(/\s+/));
for (const [from, to, code] of rules) {
  if (code.startsWith("3")) assert.notEqual(normalizePath(from), normalizePath(to), `${from}: no trailing-slash redirect loop`);
  if (to.startsWith("/") && !to.startsWith("/.netlify") && /^(200|404)/.test(code)) await read(to.slice(1));
}
for (const path of PRIVATE_PATHS) assert.ok(rules.some(([from, to]) => from === path && to === "/app.html"));
for (const api of ["cohorts", "attendance", "payments", "paystack-webhook", "visitor-country"]) assert.ok(rules.some(([from, to]) => from === `/api/${api}` && to === `/.netlify/functions/${api}`));
assert.deepEqual(rules.at(-1), ["/*", "/404.html", "404"]);
const headers = await read("_headers");
for (const path of PRIVATE_PATHS) assert.ok(headers.includes(`${path}\n  X-Robots-Tag: noindex, nofollow`));
console.log(`SEO checks passed: ${PUBLIC_PATHS.length} rendered public pages, structured data, sitemap, private routes, API rewrites and genuine 404 fallback.`);
