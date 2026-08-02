# Public certificate verification

Approved certificates are published as minimal records at
`publicCertificates/{certificateId}`. Public clients can fetch a known document,
but Firestore rules deny collection listing. No query or composite index is used.

## Existing certificates

From a trusted workstation, place the project's ignored Firebase Admin service
account at `serviceAccountKey.json`, then explicitly run:

```sh
npm run backfill:certificates -- --confirm
```

The admin-only script scans every approved `certificateProfile`, checks the
corresponding `publicCertificates/{certificateId}` document, and creates only
records that are missing. It never allocates an ID, updates a counter, alters a
profile, overwrites an existing public record, or copies private profile fields.
It fails clearly if an approved profile is missing a required public value.

## Security limitation

The current application does not use Firebase Authentication for administrators;
its role is stored in browser local storage and cannot be trusted by Firestore
rules. New approval updates the profile and counter transactionally, then merges
the public record before reporting success. Public writes are restricted to a fixed verification schema,
but those writes cannot be cryptographically admin-only in the current design.
The backfill uses the Admin SDK. Production hardening should move approval to a
trusted server/Cloud Function or adopt Firebase Auth admin custom claims, then
change public certificate writes to authenticated admin-only access.
## Social preview metadata

Verification routes update their title and Open Graph URL, title, description and image in the browser using the public certificate fields only. Because the current Vite/Netlify deployment is a static single-page application, social crawlers that do not execute JavaScript receive the generic branded `certificate-social-preview.svg`; per-certificate server-rendered preview images would require server-side or edge rendering and are intentionally outside the current architecture.
