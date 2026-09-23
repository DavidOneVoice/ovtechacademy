import test from "node:test";
import assert from "node:assert/strict";
import courses from "../src/data/courses.js";
import { guides } from "../src/data/guides.js";
import { courseQuestions } from "../src/data/courseGuidance.js";
import { PUBLIC_PATHS, PRIVATE_PATHS, SITE_URL, metadataForPath, renderMetadata, safeJson } from "../src/seo/metadata.js";

test("public pages have unique titles, descriptions and their own canonical URL", () => {
  const pages = PUBLIC_PATHS.map(metadataForPath);
  assert.equal(new Set(pages.map((page) => page.title)).size, pages.length);
  assert.equal(new Set(pages.map((page) => page.description)).size, pages.length);
  for (const page of pages) {
    assert.equal(page.canonical, `${SITE_URL}${page.path}`);
    assert.match(page.robots, /^index,/);
    assert.equal(metadataForPath(`${page.path}?utm_source=example`).canonical, page.canonical);
    assert.equal(metadataForPath(`${page.path}/`).canonical, page.canonical);
  }
});

test("private, unknown and certificate URLs cannot inherit public search metadata", () => {
  for (const path of [...PRIVATE_PATHS, "/verify/example-certificate", "/attendance/example-session", "/courses/missing", "/guides/missing", "/unknown"]) {
    const page = metadataForPath(`${path}?email=private@example.test`);
    assert.equal(page.robots, "noindex, nofollow");
    assert.equal(page.canonical, null);
    assert.equal(page.structuredData, null);
    assert.doesNotMatch(renderMetadata(page), /private@example|ld\+json|rel="canonical"/);
  }
});

test("the course catalogue and detail schema reflect all six actual learning paths", () => {
  const list = metadataForPath("/courses").structuredData["@graph"].find((node) => node["@type"] === "ItemList");
  assert.equal(list.itemListElement.length, courses.length);
  for (const course of courses) {
    const page = metadataForPath(`/courses/${course.id}`);
    const schema = page.structuredData["@graph"].find((node) => node["@type"] === "Course");
    assert.equal(schema.name, course.title);
    assert.deepEqual(schema.teaches, course.outline);
    assert.equal(schema.timeRequired, `P${course.durationWeeks}W`);
    assert.ok(list.itemListElement.some((item) => item.url === page.canonical));
    assert.equal(courseQuestions(course).length, 4);
    assert.equal(schema.offers, undefined, "do not freeze regional prices into search data");
  }
});

test("guides reference real courses and use their actual publication date", () => {
  for (const guide of guides) {
    const page = metadataForPath(`/guides/${guide.slug}`);
    const article = page.structuredData["@graph"].find((node) => node["@type"] === "Article");
    assert.equal(article.datePublished, guide.published);
    for (const id of guide.courseIds) assert.ok(courses.some((course) => course.id === id));
  }
});

test("metadata safely encodes text and only publishes a real supplied verification token", () => {
  const page = { ...metadataForPath("/"), title: '<test> & "text"' };
  assert.match(renderMetadata(page), /&lt;test&gt; &amp; &quot;text&quot;/);
  assert.doesNotMatch(renderMetadata(page), /google-site-verification/);
  assert.match(renderMetadata(page, "test-token"), /google-site-verification" content="test-token"/);
  assert.doesNotMatch(safeJson({ value: "</script><script>" }), /<\/script>/);
});
