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

The script looks up the approved `certificateProfile` for
`OVT-SD-2026-000001` and upserts that certificate's minimal public record (with
merge). It does not allocate an ID, update a counter, alter the profile, or copy
private profile fields. It fails clearly if the profile is absent, ambiguous,
not approved, or missing a required public value.

## Security limitation

The current application does not use Firebase Authentication for administrators;
its role is stored in browser local storage and cannot be trusted by Firestore
rules. New approval updates the profile and counter transactionally, then merges
the public record before reporting success. Public writes are restricted to a fixed verification schema,
but those writes cannot be cryptographically admin-only in the current design.
The backfill uses the Admin SDK. Production hardening should move approval to a
trusted server/Cloud Function or adopt Firebase Auth admin custom claims, then
change public certificate writes to authenticated admin-only access.
