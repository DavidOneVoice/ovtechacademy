# Cohorts and attendance

The active intake is October 2026. The `cohorts` catalogue is returned by `/api/cohorts` and admin views default to its newest entry. Applications, enrolled students, graduates, referrals and exports use the selected cohort. URLs carry `?cohort=...` between admin screens. Untagged legacy records are interpreted as July 2026 until the production migration tags them.

Production master builds run `scripts/prepareProduction.mjs` after a successful Vite build. It reads the live Firestore rules, applies only the attendance rule changes, saves the previous rules privately, and performs the idempotent cohort migration. The migration fixes its target IDs before making changes, backs up original cohort fields, skips explicitly assigned cohorts, and never moves or renames student documents. A resumed run uses the same targets. Neither preview deployments nor local builds mutate production.

Backups are under `academyMigrations`: `cohorts-july-october-2026-v1/originalCohortFields` and `attendance-pin-rules-v1`. Only the Firebase Admin SDK can read these. Restore individual original cohort fields from those backups if rollback is needed; do not clear new registrations or move documents. Certificate profiles, public alumni and progress are not migrated. Payment code is unchanged.

## Live-class attendance

All six canonical course cards appear. Cards without enrolled live-class learners in the selected cohort are disabled. Data Analytics, Web Development and Software Development require an explicit live learning method. Virtual Assistant, Cybersecurity and AI Automation default to live when no method was recorded; any explicit recorded-learning method is always excluded. Historical frontend names normalize to the established Software Development alias; no student programme values are overwritten.

Attendance sessions are separate per course, cohort and day. Original July session IDs remain compatible. Generation uses one transaction so simultaneous requests do not increment lecture days twice. The public attendance page receives session metadata only; it does not download the student roster. Students enter their registered email and private PIN, inspect their own name/course/cohort, then confirm attendance. Server checks enforce enrollment, live format, course, cohort, date and credential version. Recording is transactional and idempotent.

PIN setup and reset are available inside the existing portal and on attendance pages. They require a code emailed to the stored registration email. No portal account or new portal login is introduced. Codes expire after ten minutes, have five attempts, and can be consumed once. PINs are salted scrypt hashes stored in server-only collections; verification is throttled by address and platform IP. A five-minute signed grant is needed to mark attendance. Resetting a PIN invalidates old grants. Contact details are not displayed on attendance pages.

Email uses the existing EmailJS service and general academy template with `email`, `to_name`, `subjectTitle`, `mainMessage`, `extraMessage`, `ctaText`, and `ctaLink`. EmailJS must allow API requests from non-browser applications. If private-key authorization is enabled there, set `EMAILJS_PRIVATE_KEY` in Netlify Functions scope (never VITE-prefixed or committed). Existing VITE_EMAILJS settings must be available to Functions too. Delivery failure stops PIN setup; it never falls back to unverified PIN creation. No real emails are sent by the automated test suite.

## Existing access limitations

The existing portal and admin screens use public Firestore reads and local browser session state rather than authenticated identities. This change protects PIN secrets and server attendance submission but does not make the entire student database private or authenticate administrators. The existing public application/deletion permissions remain for compatibility, so a separate access-control migration is needed to protect all student information. Do not describe this PIN feature as complete platform security.

## Future intakes

Create a `cohorts/{month-year}` document with a label and startDate, update `src/data/cohort.js` to the new active intake, and update admission validation/rules and pricing as required for that intake. Older cohorts remain selectable newest first. Do not reassign prior students or duplicate certificate/progress documents. The public alumni directory continues to show opted-in graduates from every cohort.

## Validation

`npm test` covers migration preservation/idempotence, cohort sorting, course/method isolation, email code limits, private PIN hashing, reset invalidation, expired/tampered grants, duplicate attendance, HTTP boundaries, and payment regressions. An isolated UI check additionally exercises the dropdowns and legacy course URLs without live writes or emails. A real student's successful verification-email delivery still requires a live account check.
