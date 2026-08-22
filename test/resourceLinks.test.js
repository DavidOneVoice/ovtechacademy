import test from "node:test";
import assert from "node:assert/strict";
import { getResourceAction, isValidResourceUrl, mergeSafeResourceData } from "../src/lms/resourceLinks.js";

test("accepts external HTTP resource URLs", () => {
  assert.deepEqual(getResourceAction({ downloadUrl: "https://example.com/file.pdf" }), {
    label: "Download", href: "https://example.com/file.pdf",
  });
});

test("rejects file types, routes, and blanks as URLs", () => {
  for (const value of ["PDF", "/PDF", "DOC", "DOCX", "Word Document", "Excel", "PPT", "link", ""]) {
    assert.equal(isValidResourceUrl(value), false);
    assert.equal(getResourceAction({ downloadUrl: value }).href, "");
  }
});

test("uses only the supported local resource storage path", () => {
  assert.equal(getResourceAction({ storagePath: "/lms-resources/file.pdf" }).href, "/lms-resources/file.pdf");
  assert.equal(getResourceAction({ storagePath: "/PDF" }).href, "");
});

test("preserves an existing valid URL when an import has a blank or invalid URL", () => {
  const existing = { downloadUrl: "https://example.com/original.pdf" };
  for (const downloadUrl of ["", "PDF", "/PDF"]) {
    const merged = mergeSafeResourceData({ type: "resource", downloadUrl }, existing);
    assert.equal(merged.downloadUrl, existing.downloadUrl);
  }
  const replacement = mergeSafeResourceData(
    { type: "resource", downloadUrl: "https://example.com/new.pdf" },
    existing,
  );
  assert.equal(replacement.downloadUrl, "https://example.com/new.pdf");
});
