import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { metadataForPath, safeJson } from "./metadata.js";

export default function SeoMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = metadataForPath(pathname);
    document.title = page.title;
    const setMeta = (kind, name, value) => {
      let element = document.head.querySelector(`meta[${kind}="${name}"]`);
      if (!value) { element?.remove(); return; }
      if (!element) { element = document.createElement("meta"); element.setAttribute(kind, name); document.head.append(element); }
      element.content = value;
    };
    setMeta("name", "description", page.description);
    setMeta("name", "robots", page.robots);
    for (const [name, value] of Object.entries({ "og:title": page.title, "og:description": page.description, "og:type": page.guide ? "article" : "website", "og:url": page.canonical, "og:image": page.image, "og:image:alt": page.imageAlt, "og:image:width": page.image ? "1536" : null, "og:image:height": page.image ? "1024" : null })) setMeta("property", name, value);
    setMeta("name", "twitter:title", page.title);
    setMeta("name", "twitter:description", page.description);
    setMeta("name", "twitter:image", page.image);
    setMeta("name", "twitter:image:alt", page.imageAlt);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (page.canonical) {
      if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
      canonical.href = page.canonical;
    } else canonical?.remove();
    let data = document.getElementById("ovtech-structured-data");
    if (page.structuredData) {
      if (!data) { data = document.createElement("script"); data.id = "ovtech-structured-data"; data.type = "application/ld+json"; document.head.append(data); }
      data.textContent = safeJson(page.structuredData);
    } else data?.remove();
  }, [pathname]);
  return null;
}
