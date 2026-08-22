export const isValidResourceUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
};

// storagePath is retained for older records whose files live under Vite's public
// LMS resource directory. Arbitrary root-relative values (for example /PDF) are
// deliberately not accepted as downloadable files.
export const isValidResourceStoragePath = (value) =>
  typeof value === "string" && /^\/lms-resources\/[^/].+/i.test(value.trim());

export const getResourceAction = (resource = {}) => {
  const downloadUrl = String(resource.downloadUrl || "").trim();
  if (isValidResourceUrl(downloadUrl)) {
    return { label: "Download", href: downloadUrl };
  }

  const storagePath = String(resource.storagePath || "").trim();
  if (isValidResourceUrl(storagePath) || isValidResourceStoragePath(storagePath)) {
    return { label: "Download", href: storagePath };
  }

  return { label: "Resource unavailable", href: "" };
};

export const mergeSafeResourceData = (intended, existing) => {
  if (intended?.type !== "resource" || !existing) return intended;
  return {
    ...intended,
    downloadUrl: isValidResourceUrl(intended.downloadUrl)
      ? intended.downloadUrl
      : isValidResourceUrl(existing.downloadUrl) ? existing.downloadUrl : "",
    storagePath: isValidResourceStoragePath(intended.storagePath)
      ? intended.storagePath
      : isValidResourceStoragePath(existing.storagePath) ? existing.storagePath : "",
  };
};
