# Search visibility

Public site: https://ovtechacademy.com

## What the build publishes

`npm run build` creates the client application, renders the public pages to HTML,
and validates the output before deployment. Netlify runs this through the existing
`build:production` command. This keeps course content readable before JavaScript
runs. Regional fees still come from the visitor's location in the browser.

`src/seo/metadata.js` defines the 16 indexable paths, unique titles/descriptions,
self-referencing canonical URLs, social sharing text and structured data.
Organization, Course, course ItemList, BreadcrumbList and Article data use the
published course catalogue and guide content. Structured data does not guarantee
special search appearances.

The build generates `/sitemap.xml` and `/robots.txt`. Public routes serve their
own HTML, known application routes serve a separate noindex shell, and unknown
URLs return HTTP 404. Portal, admin, registration, payment, attendance and
certificate pages stay out of the sitemap and carry noindex instructions. These
instructions are search controls, not authentication or access controls.

Do not add trailing-slash redirects on Netlify: its rule matcher normalizes those
paths and a slash-only redirect can loop. Preserve the API rewrites when changing
`public/_redirects`. Generated redirects and headers live in `dist`, not source.

## Content maintenance

The three starter guides are in `src/data/guides.js`; course FAQs and preparation
advice are in `src/data/courseGuidance.js`. Add genuinely useful material based on
the actual syllabus, student questions and approved examples. Keep course dates,
formats, curriculum and fees accurate. Use real publication/update dates, and do
not add fake reviews, job guarantees, locations or keyword-filled duplicate pages.

Add public routes to both `src/seo/publicPages.jsx` and the metadata definitions.
Guide and course detail URLs are generated from their data automatically. Run
`npm test` and `npm run build` before publishing; the build includes `test:seo`.

## Google Search Console setup

1. Sign in at https://search.google.com/search-console with the academy's account.
2. Add URL-prefix property `https://ovtechacademy.com/` (or use a domain property
   if the owner can add Google's exact TXT record in the DNS account).
3. For the HTML-tag method, copy the exact Google-provided verification token to
   the Netlify build environment as `GOOGLE_SITE_VERIFICATION`, redeploy, and then
   select Verify. It is also safe to use Google's exact HTML verification file in
   `public/` when the owner provides that file. Never invent a token.
4. Submit `https://ovtechacademy.com/sitemap.xml`. Inspect the homepage, course
   catalogue, a course page and a guide. Request indexing where appropriate.
5. Review indexing and performance reports after Google has crawled the site.
   Track relevant non-brand search queries and application outcomes over time.

Publishing the sitemap alone is not the same as submitting it through a verified
Search Console account. Crawling, indexing and rankings remain Google's decisions.

## Measurement groundwork

`src/analytics/events.js` emits local `ovtech:conversion` CustomEvents for course
views, first application edits, successful scholarship applications, first
checkout opening and confirmed registration completion. Only real catalogue
course IDs and scholarship/tuition types are allowed. Names, contact details,
payment references, application IDs and page URLs are excluded.

These hooks do **not** send data anywhere, load Google tags, store visitor IDs or
create an analytics dashboard. They are preparation for a separately configured
destination and visitor-consent flow. An actual GA4 property/Ads account and its
real IDs are needed before activation. Keep measurement off student/admin/payment
URLs unless explicitly designed to exclude all private URL/query data. Disable
automatic form capture and never pass personal form fields to advertising tags.

## Promotion still needing owner input

Paid campaigns need the owner's advertising account, audience, geography, chosen
course, creative approval and spending limit. No ads or spending are enabled by
this change. Start any eventual pilot with a defined enquiry/application outcome
and review its cost before expanding. The site work does not require an SEO agency.
