export const DAY39_MIGRATION = 'data-analytics-day39-videos-20260925-v1';
export const DAY39_VIDEOS = Object.freeze({
  mobilePart1: 'https://www.youtube.com/watch?v=50o0SNwrBrE',
  mobilePart2: 'https://youtu.be/4Qn6ifcMnHc',
  dax: 'https://www.youtube.com/watch?v=w3EGdt6I0JI',
  daxTitle: 'DAX and Measures Tutorial',
});

const assertTarget = (data, id, type, title) => {
  const idField = type === 'video' ? 'lessonId' : 'resourceId';
  if (!data || data[idField] !== id || data.sourceLessonId !== id
    || data.curriculumGroup !== 'data-analytics' || data.course !== 'Power BI'
    || data.unlockDay !== 39 || data.type !== type || data.title !== title
    || data.isPublished !== true) {
    throw new Error(`Unexpected Day 39 curriculum record ${id}; no changes applied.`);
  }
};

// One transaction keeps the replacement lesson and retired resource consistent.
// Stable lesson IDs preserve existing completion records. The private migration
// record backs up the original content and prevents later admin edits reverting.
export async function migrateDataAnalyticsDay39(db) {
  const marker = db.collection('academyMigrations').doc(DAY39_MIGRATION);
  return db.runTransaction(async (tx) => {
    const saved = await tx.get(marker);
    if (saved.exists) {
      if (!saved.data().completedAt) throw new Error('Unexpected incomplete Day 39 migration record.');
      return { alreadyComplete: true };
    }
    const mobileRef = db.collection('curriculum').doc('PB043');
    const part2Ref = db.collection('curriculum').doc('PB044');
    const daxRef = db.collection('curriculum').doc('PB046');
    const resourceRef = db.collection('lmsResources').doc('PB046');
    const [mobileSnap, part2Snap, daxSnap, resourceSnap] = await Promise.all(
      [mobileRef, part2Ref, daxRef, resourceRef].map((ref) => tx.get(ref)),
    );
    const mobile = mobileSnap.data(), part2 = part2Snap.data(), resource = resourceSnap.data();
    assertTarget(mobile, 'PB043', 'video', 'Power BI Mobile Pt.1');
    assertTarget(part2, 'PB044', 'video', 'Power BI Mobile Pt.2');
    assertTarget(resource, 'PB046', 'resource', 'DAX / MEASURES HANDOUT');
    if (daxSnap.exists || mobile.youtubeUrl !== DAY39_VIDEOS.mobilePart2
      || part2.youtubeUrl !== DAY39_VIDEOS.mobilePart2 || resource.downloadUrl || resource.storagePath) {
      throw new Error('Day 39 content changed since review; no changes applied.');
    }
    const now = new Date();
    const lesson = Object.fromEntries([
      'curriculumGroup', 'course', 'section', 'module', 'globalOrder',
      'lessonOrder', 'courseOrder', 'unlockDay', 'week', 'lectureDate', 'dayOfWeek',
    ].map((field) => [field, resource[field]]));
    tx.create(daxRef, {
      ...lesson, lessonId: 'PB046', sourceLessonId: 'PB046', type: 'video',
      title: DAY39_VIDEOS.daxTitle, youtubeUrl: DAY39_VIDEOS.dax, isPublished: true,
      createdAt: now, updatedAt: now,
    });
    tx.update(mobileRef, { youtubeUrl: DAY39_VIDEOS.mobilePart1, updatedAt: now });
    tx.update(resourceRef, { isPublished: false, updatedAt: now });
    tx.create(marker, {
      completedAt: now, originalMobilePart1: mobile, originalDaxResource: resource,
      createdLessonPath: daxRef.path,
    });
    return { lessonsUpdated: 1, lessonsCreated: 1, resourcesRetired: 1 };
  });
}
