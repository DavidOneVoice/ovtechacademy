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

The script reads approved `certificateProfile` documents and upserts (with merge)
their existing certificate IDs. It does not allocate IDs, update counters, or
alter profiles. Records without a valid ID, public name, course, or issue date are
reported as skipped. This includes `OVT-SD-2026-000001` when its approved profile
is present and complete.

## Security limitation

The current application does not use Firebase Authentication for administrators;
its role is stored in browser local storage and cannot be trusted by Firestore
rules. New approval uses one Firestore transaction for the profile, counter, and
public record, and public writes are restricted to a fixed verification schema,
but those writes cannot be cryptographically admin-only in the current design.
The backfill uses the Admin SDK. Production hardening should move approval to a
trusted server/Cloud Function or adopt Firebase Auth admin custom claims, then
change public certificate writes to authenticated admin-only access.
