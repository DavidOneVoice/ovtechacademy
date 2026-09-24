import courses from "../data/courses.js";
import { guides } from "../data/guides.js";

export const SITE_URL = "https://ovtechacademy.com";
export const SITE_NAME = "OVTech Academy";
const provider = { "@type": "EducationalOrganization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, sameAs: SITE_URL };
const organization = {
  ...provider, alternateName: "One Voice Tech", foundingDate: "2023",
  logo: `${SITE_URL}/ovlogo2.png`, email: "onevoicetech2023@gmail.com", telephone: "+2348130624789",
  sameAs: ["https://web.facebook.com/61559488910917/", "https://www.youtube.com/@D-OVTech", "https://www.tiktok.com/@onevoicetech"],
};
const definitions = [
  ["/analytics-and-cookies", "Analytics & Cookie Choices | OVTech Academy", "Learn how OVTech Academy measures website visits and applications. Choose whether to allow analytics cookies or use essential website functions only."],
  ["/", "Online Tech Courses & Practical Training | OVTech Academy", "Learn data analytics, coding, cybersecurity, virtual assistance and AI automation online. Explore practical projects, class formats and scholarship options."],
  ["/courses", "Online Tech Courses & Learning Paths | OVTech Academy", "Compare six online tech courses: curriculum, practical projects, duration, learning format and regional fees. Choose your learning path at OVTech Academy."],
  ["/about", "About OVTech Academy | Online Technology Education", "Meet OVTech Academy and founder Badru Olumide David. Learn about our approach to practical tech training, projects, mentorship and online learning."],
  ["/contact", "Contact Admissions | OVTech Academy", "Ask OVTech Academy about courses, scholarships, learning formats and registration. Contact the admissions team by email, WhatsApp or the enquiry form."],
  ["/scholarship", "Apply for a Tech Course Scholarship | OVTech Academy", "Apply for scholarship support on an OVTech online tech course. Choose your learning path and review its format. Scholarship fees are paid only after approval."],
  ["/alumni", "Alumni Directory | OVTech Academy", "Meet verified OVTech Academy graduates who have chosen to share their professional profiles, completed courses and projects."],
  ["/guides", "Tech Learning Guides for Beginners | OVTech Academy", "Explore beginner guides to coding, data analytics, cybersecurity, virtual assistance and AI automation. Try a practical project and choose your learning path."],
];

export const PUBLIC_METADATA = Object.fromEntries(definitions.map(([path, title, description]) => [path, { path, title, description }]));
for (const course of courses) {
  const path = `/courses/${course.id}`;
  PUBLIC_METADATA[path] = { path, title: `${course.title} Course Online | OVTech Academy`, description: course.description, course };
}
for (const guide of guides) {
  const path = `/guides/${guide.slug}`;
  PUBLIC_METADATA[path] = { path, title: `${guide.title} | OVTech Academy`, description: guide.description, guide };
}

export const PUBLIC_PATHS = Object.keys(PUBLIC_METADATA);
export const PRIVATE_PATHS = ["/register", "/payment-review", "/registration/complete", "/scholarship-payment", "/payment-success", "/lms", "/admin-login", "/admin", "/admin/assistant", "/admin/lms", "/admin/live-sessions", "/admin/graduated-students", "/enrolled-students", "/verify"];
export const normalizePath = (path = "/") => path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

function breadcrumb(path, title) {
  const parts = [{ name: "Home", item: `${SITE_URL}/` }];
  if (path.startsWith("/courses/")) parts.push({ name: "Courses", item: `${SITE_URL}/courses` });
  if (path.startsWith("/guides/")) parts.push({ name: "Learning guides", item: `${SITE_URL}/guides` });
  parts.push({ name: title, item: `${SITE_URL}${path}` });
  return { "@type": "BreadcrumbList", itemListElement: parts.map((part, i) => ({ "@type": "ListItem", position: i + 1, ...part })) };
}

export function metadataForPath(pathname) {
  const path = normalizePath(pathname);
  const page = PUBLIC_METADATA[path];
  if (!page) return { path, title: "OVTech Academy", description: "OVTech Academy student, admissions and verification services.", robots: "noindex, nofollow", canonical: null, structuredData: null };
  const imageCourse = page.course || courses.find((course) => page.guide?.courseIds.includes(course.id));
  const image = `${SITE_URL}${imageCourse?.image || "/images/hero.webp"}`;
  const imageAlt = imageCourse?.alt || "A learner and mentor working together on a practical technology project";
  const nodes = [];
  if (path === "/") nodes.push(organization, { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, alternateName: "One Voice Tech", url: `${SITE_URL}/` });
  if (path !== "/") nodes.push(breadcrumb(path, page.course?.title || page.guide?.title || page.title.split(" | ")[0]));
  if (path === "/courses") nodes.push({ "@type": "ItemList", itemListElement: courses.map((course, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/courses/${course.id}` })) });
  if (page.course) nodes.push({ "@type": "Course", "@id": `${SITE_URL}${path}#course`, name: page.course.title, description: page.course.description, url: `${SITE_URL}${path}`, provider, inLanguage: "en", teaches: page.course.outline, timeRequired: `P${page.course.durationWeeks}W` });
  if (page.guide) nodes.push({ "@type": "Article", headline: page.guide.title, description: page.guide.description, image: [image], datePublished: page.guide.published, dateModified: page.guide.published, author: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/about` }, publisher: provider, mainEntityOfPage: `${SITE_URL}${path}`, inLanguage: "en" });
  return { ...page, image, imageAlt, canonical: `${SITE_URL}${path}`, robots: "index, follow, max-image-preview:large", structuredData: nodes.length ? { "@context": "https://schema.org", "@graph": nodes } : null };
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export function renderMetadata(page, verification = "") {
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="${page.robots}" />`,
    ...(page.canonical ? [`<link rel="canonical" href="${escapeHtml(page.canonical)}" />`] : []),
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:type" content="${page.guide ? "article" : "website"}" />`,
    ...(page.canonical ? [`<meta property="og:url" content="${escapeHtml(page.canonical)}" />`] : []),
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    ...(page.image ? [
      `<meta property="og:image" content="${escapeHtml(page.image)}" />`,
      `<meta property="og:image:alt" content="${escapeHtml(page.imageAlt)}" />`,
      `<meta property="og:image:width" content="1536" />`,
      `<meta property="og:image:height" content="1024" />`,
      `<meta name="twitter:image" content="${escapeHtml(page.image)}" />`,
      `<meta name="twitter:image:alt" content="${escapeHtml(page.imageAlt)}" />`,
    ] : []),
    ...(verification ? [`<meta name="google-site-verification" content="${escapeHtml(verification)}" />`] : []),
    ...(page.structuredData ? [`<script id="ovtech-structured-data" type="application/ld+json">${safeJson(page.structuredData)}</script>`] : []),
  ];
  return tags.join("\n    ");
}
