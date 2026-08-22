import test from "node:test";
import assert from "node:assert/strict";
import { getResourceAction, isValidResourceUrl, mergeSafeResourceData } from "../src/lms/resourceLinks.js";

test("accepts external HTTPS resource URLs", () => {
  assert.deepEqual(getResourceAction({ downloadUrl: "https://example.com/file.pdf" }), {
    label: "Download", href: "https://example.com/file.pdf",
  });
});

test("rejects file types, routes, and blanks as URLs", () => {
  for (const value of ["PDF", "/PDF", "DOC", "DOCX", "Word Document", "Excel", "PPT", "link", "", "http://example.com/file.pdf"]) {
    assert.equal(isValidResourceUrl(value), false);
    assert.equal(getResourceAction({ downloadUrl: value }).href, "");
  }
});

test("uses only the supported local resource storage path", () => {
  for (const storagePath of [
    "/lms-resources/datahandbook.pdf",
    "/lms-resources/Excel Mini - Project 1.docx",
    "/lms-resources/Test+sample.xlsx",
  ]) {
    assert.equal(getResourceAction({ storagePath }).href, storagePath);
  }
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

test("preserves only valid existing local resource storage paths", () => {
  const existing = { storagePath: "/lms-resources/original.xlsx" };
  const preserved = mergeSafeResourceData({ type: "resource", storagePath: "/PDF" }, existing);
  assert.equal(preserved.storagePath, existing.storagePath);

  const replacement = mergeSafeResourceData(
    { type: "resource", storagePath: "/lms-resources/new.docx" },
    existing,
  );
  assert.equal(replacement.storagePath, "/lms-resources/new.docx");
});
