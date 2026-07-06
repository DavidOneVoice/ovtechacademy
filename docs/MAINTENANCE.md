# OVTech Academy Maintenance Toolkit

These commands use Firebase Admin credentials from `serviceAccountKey.json` in the project root. The service account file is intentionally local-only and should not be committed.

## Seed curriculum

Seeds or updates LMS curriculum and resources from the default workbook at `data/OVTech Master Curriculum.xlsx`.

```bash
npm run seed:curriculum
```

To use a different workbook path, pass it to the script:

```bash
node scripts/seedCurriculumFromWorkbook.mjs ./path/to/curriculum.xlsx
```

## Reset attendance test data

Deletes all documents in `attendanceSessions`, including each session's `records` subcollection, and resets attendance counters on every `scholarshipApplications` student document. This does not modify scholarship status, payment status, LMS progress, curriculum, or resources.

This is destructive and requires `--confirm`:

```bash
npm run reset:attendance -- --confirm
```

Direct script usage:

```bash
node scripts/resetAttendanceTestData.mjs --confirm
```

## Reset LMS progress

Deletes every document in `studentProgress`. This does not touch curriculum, resources, or scholarship applications.

This is destructive and requires `--confirm`:

```bash
npm run reset:lms -- --confirm
```

Direct script usage:

```bash
node scripts/resetLmsProgress.mjs --confirm
```

## Reset demo data

Runs the attendance reset first, then the LMS progress reset, and prints a combined summary.

This is destructive and requires `--confirm`:

```bash
npm run reset:demo -- --confirm
```

Direct script usage:

```bash
node scripts/resetDemoData.mjs --confirm
```
