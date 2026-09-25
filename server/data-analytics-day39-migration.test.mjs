import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { migrateDataAnalyticsDay39, DAY39_MIGRATION, DAY39_VIDEOS } from './data-analytics-day39-migration.mjs';
import { getSafeYouTubeEmbedUrl } from '../src/lms/youtube.js';

const initial = () => {
  const common = {
    curriculumGroup: 'data-analytics', course: 'Power BI', unlockDay: 39,
    section: 'Power BI DAX, Relationships & Mobile', module: 'Power BI DAX, Relationships & Mobile',
    lectureDate: '2026-08-28', dayOfWeek: 'Friday', isPublished: true,
    createdAt: 'original-created', updatedAt: 'original-updated',
  };
  return {
    'curriculum/PB043': {
      ...common, lessonId: 'PB043', sourceLessonId: 'PB043', type: 'video',
      title: 'Power BI Mobile Pt.1', youtubeUrl: DAY39_VIDEOS.mobilePart2,
      courseOrder: 43, lessonOrder: 43, globalOrder: 169, week: 8,
    },
    'curriculum/PB044': {
      ...common, lessonId: 'PB044', sourceLessonId: 'PB044', type: 'video',
      title: 'Power BI Mobile Pt.2', youtubeUrl: DAY39_VIDEOS.mobilePart2,
      courseOrder: 44, lessonOrder: 44, globalOrder: 170, week: 8,
    },
    'lmsResources/PB046': {
      ...common, resourceId: 'PB046', sourceLessonId: 'PB046', type: 'resource',
      title: 'DAX / MEASURES HANDOUT', fileName: 'DAX / MEASURES HANDOUT',
      fileType: 'PDF', downloadUrl: '', storagePath: '',
      courseOrder: 46, lessonOrder: 46, globalOrder: 172, week: 9,
    },
    'studentProgress/test-student': { completedLessonIds: ['PB042', 'PB043'], lastWatchedLessonId: 'PB043' },
    'curriculum/computer-programming__PB043': { title: 'Unrelated course' },
  };
};

test('Day 39 correction updates only the approved content and preserves scheduling, progress and Part 2', async () => {
  const before = initial();
  const { db, docs } = memoryFirestore(before);
  assert.deepEqual(await migrateDataAnalyticsDay39(db), { lessonsUpdated: 1, lessonsCreated: 1, resourcesRetired: 1 });
  const mobile = docs.get('curriculum/PB043');
  assert.deepEqual(mobile, { ...before['curriculum/PB043'], youtubeUrl: DAY39_VIDEOS.mobilePart1, updatedAt: mobile.updatedAt });
  const dax = docs.get('curriculum/PB046');
  assert.equal(dax.title, DAY39_VIDEOS.daxTitle);
  assert.equal(dax.youtubeUrl, DAY39_VIDEOS.dax);
  assert.equal(dax.type, 'video'); assert.equal(dax.isPublished, true);
  assert.equal(dax.lessonId, 'PB046'); assert.equal(dax.globalOrder, 172);
  assert.equal(dax.unlockDay, 39); assert.equal(dax.lectureDate, '2026-08-28');
  for (const field of ['fileType', 'downloadUrl', 'storagePath', 'resourceId']) assert.equal(field in dax, false);
  const retired = docs.get('lmsResources/PB046');
  assert.deepEqual(retired, { ...before['lmsResources/PB046'], isPublished: false, updatedAt: retired.updatedAt });
  for (const path of ['curriculum/PB044', 'studentProgress/test-student', 'curriculum/computer-programming__PB043']) {
    assert.deepEqual(docs.get(path), before[path]);
  }
  const backup = docs.get(`academyMigrations/${DAY39_MIGRATION}`);
  assert.deepEqual(backup.originalMobilePart1, before['curriculum/PB043']);
  assert.deepEqual(backup.originalDaxResource, before['lmsResources/PB046']);
  // A future deployment must not undo an intentional subsequent admin change.
  docs.set('curriculum/PB043', { ...mobile, title: 'Later admin title' });
  const after = structuredClone(docs);
  assert.deepEqual(await migrateDataAnalyticsDay39(db), { alreadyComplete: true });
  assert.deepEqual(docs, after);
});

test('unexpected records abort the transaction without partially updating lessons or resources', async () => {
  for (const mutate of [
    (docs) => { delete docs['curriculum/PB043']; },
    (docs) => { docs['curriculum/PB043'].curriculumGroup = 'computer-programming'; },
    (docs) => { docs['curriculum/PB043'].youtubeUrl = 'https://youtu.be/someNewVideo'; },
    (docs) => { docs['lmsResources/PB046'].unlockDay = 40; },
    (docs) => { docs['lmsResources/PB046'].downloadUrl = '/new-handout.pdf'; },
    (docs) => { docs['curriculum/PB046'] = { title: 'Existing lesson must be preserved' }; },
  ]) {
    const before = initial(); mutate(before);
    const { db, docs } = memoryFirestore(before);
    await assert.rejects(migrateDataAnalyticsDay39(db), /no changes applied/);
    assert.deepEqual(docs, new Map(Object.entries(before)));
  }
});

test('the checked-in workbook and portal player agree with the production correction', () => {
  const workbook = XLSX.readFile(new URL('../data/OVTech Master Curriculum.xlsx', import.meta.url));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Master Curriculum'], { defval: '' });
  const find = (id) => rows.find((row) => row['Lesson ID'] === id);
  assert.equal(find('PB043')['YouTube Link'], DAY39_VIDEOS.mobilePart1);
  assert.equal(find('PB044')['YouTube Link'], DAY39_VIDEOS.mobilePart2);
  const dax = find('PB046');
  assert.equal(dax.Type, 'Video'); assert.equal(dax.Title, DAY39_VIDEOS.daxTitle);
  assert.equal(dax['YouTube Link'], DAY39_VIDEOS.dax); assert.equal(dax['Downloadable Resource'], '');
  for (const id of ['PB043', 'PB044', 'PB046']) assert.equal(find(id)['Unlock Day'], 39);
  assert.equal(getSafeYouTubeEmbedUrl(find('PB043')['YouTube Link']), 'https://www.youtube-nocookie.com/embed/50o0SNwrBrE?rel=0&modestbranding=1');
  assert.equal(getSafeYouTubeEmbedUrl(dax['YouTube Link']), 'https://www.youtube-nocookie.com/embed/w3EGdt6I0JI?rel=0&modestbranding=1');
});
