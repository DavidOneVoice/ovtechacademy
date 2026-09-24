# Search visibility

Public site: https://ovtechacademy.com

## What the build publishes

`npm run build` creates the client application, renders the public pages to HTML,
and validates the output before deployment. Netlify runs this through the existing
`build:production` command. This keeps course content readable before JavaScript
runs. Regional fees still come from the visitor's location in the browser.

`src/seo/metadata.js` defines the 19 indexable paths, unique titles/descriptions,
self-referencing canonical URLs, social sharing text and structured data.
Organization, Course, course ItemList, BreadcrumbList and Article data use the
published course catalogue and guide content. Structured data does not guarantee
special search appearances.

Public routes load their own JavaScript on demand. React's static renderer waits
for each route before writing its HTML; the Vite manifest supplies the matching
CSS and module preloads so the rendered page is styled immediately. The homepage
and guides do not preload Firebase, application forms or portal bundles. Large
project screenshots below the homepage introduction load lazily. Course and
guide sharing previews use the relevant course image rather than a dated flyer.

The build generates `/sitemap.xml` and `/robots.txt`. Public routes serve their
own HTML, known application routes serve a separate noindex shell, and unknown
URLs return HTTP 404. Portal, admin, registration, payment, attendance and
certificate pages stay out of the sitemap and carry noindex instructions. These
instructions are search controls, not authentication or access controls.

Do not add trailing-slash redirects on Netlify: its rule matcher normalizes those
paths and a slash-only redirect can loop. Preserve the API rewrites when changing
`public/_redirects`. Generated redirects and headers live in `dist`, not source.

## Content maintenance

The five starter guides are in `src/data/guides.js`; course FAQs and preparation
advice are in `src/data/courseGuidance.js`. Add genuinely useful material based on
the actual syllabus, student questions and approved examples. Keep course dates,
formats, curriculum and fees accurate. Use real publication/update dates, and do
not add fake reviews, job guarantees, locations or keyword-filled duplicate pages.

Add public routes to both `src/seo/publicPages.js` and the metadata definitions.
Guide and course detail URLs are generated from their data automatically. Run
`npm test` and `npm run build` before publishing; the build includes `test:seo`.

## Google Search Console setup

Completed on 24 September 2026 for `https://ovtechacademy.com/`: ownership verified,
the sitemap successfully processed with 16 discovered pages at that time, and
the homepage confirmed indexed. The sitemap now includes 19 public pages after
adding the Cybersecurity and AI Automation guides and the analytics notice. Discovery of those additions
and indexing of individual pages still depend on Google's next crawl.

The academy owner's public HTML verification tag is committed in `index.html`
outside the generated SEO block. Keep it in place after ownership verification.
It was provided by Search Console for `https://ovtechacademy.com/`; it is intended
to be public and is not a login credential. The build environment option below
can supply an additional Google-provided tag if another verification is needed.

If the property ever needs reconnecting:

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

## Google Analytics measurement

`src/analytics/events.js` emits local `ovtech:conversion` CustomEvents for course
views, first application edits, successful scholarship applications, first
checkout opening and confirmed registration completion. Only real catalogue
course IDs and scholarship/tuition types are allowed. Names, contact details,
payment references, application IDs and page URLs are excluded.

Configured on 24 September 2026 in the owner's existing `ovtechacad` property
(`541559075`), matching this website's Firebase project. The web stream is
`OVTech Academy website`, URL `https://ovtechacademy.com`, stream `15069934018`,
measurement ID `G-EK7YNYFWJV`. These are public configuration identifiers, not
credentials. Other Firebase app properties were not changed.

`src/analytics/google.js` forwards the allowed events only after the visitor
chooses Allow analytics. The Google script is absent before that choice. Consent
is remembered for up to 180 days; Analytics cookies use the same maximum lifetime
without extending it on every visit. The footer links to `/analytics-and-cookies`
where visitors can change their choice. Essential only stops measurement and
removes Analytics cookies without removing application drafts or portal sessions.

Measurement runs only on the production domain, public pages and explicitly
allowed admissions pages. Page locations and titles come from fixed definitions;
query strings, fragments, payment references and private routes cannot become
event data. Referral information is limited to recognised service domains, never
their paths or query strings. Student, admin, attendance and certificate routes
and preview environments are excluded. Cookie and storage blocking must not
prevent applications or portal access.

Enhanced measurement is off in the stream, including automatic form and browser
history tracking. Advertising consent, Google signals and ad personalisation are
off in the website tag. Email redaction is active, with URL redaction for
`reference`, `trxref`, `draft`, `application`, `email`, `phone`, `whatsapp`,
`fullname`, `name`, `location`, `referralcode`, `token` and `code` as a further
backstop. Do not enable automatic capture or send personal form values to tags.

`generate_lead` (saved scholarship application) and `registration_complete`
(confirmed registration completion) are key events, counted once per event with
no assigned monetary value. Ordinary course views and application starts are not
completed applications. Event-scoped custom dimensions `Course` (`course_id`)
and `Application type` (`application_type`) provide course and admissions-path
breakdowns. Counts depend on visitor consent, browser blockers and
successful delivery; they are not the authoritative enrolment or payment ledger.

Regression tests cover consent, withdrawal, private routes, query stripping,
allowed event parameters and blocked browser storage. Validate actual page and
course visits in Realtime after deploying; never create fake live applications
or payments merely to test Analytics. Standard reports and custom definitions
can take time to populate.

## Promotion still needing owner input

Paid campaigns need the owner's advertising account, audience, geography, chosen
course, creative approval and spending limit. No ads or spending are enabled by
this change. Start any eventual pilot with a defined enquiry/application outcome
and review its cost before expanding. The site work does not require an SEO agency.
