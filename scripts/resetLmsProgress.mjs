import { getFirestore, requireConfirmation } from "./firebaseAdmin.mjs";

const BATCH_LIMIT = 450;
const PROGRESS_PAGE_SIZE = 300;

export const resetLmsProgress = async () => {
  const db = await getFirestore();
  let progressDocumentsReset = 0;
  let committedOperations = 0;

  while (true) {
    const progressSnapshot = await db
      .collection("studentProgress")
      .orderBy("__name__")
      .limit(PROGRESS_PAGE_SIZE)
      .get();

    if (progressSnapshot.empty) break;

    let batch = db.batch();
    let operationsInBatch = 0;

    for (const progressDoc of progressSnapshot.docs) {
      batch.delete(progressDoc.ref);
      operationsInBatch += 1;
      progressDocumentsReset += 1;

      if (operationsInBatch === BATCH_LIMIT) {
        await batch.commit();
        committedOperations += operationsInBatch;
        batch = db.batch();
        operationsInBatch = 0;
      }
    }

    if (operationsInBatch > 0) {
      await batch.commit();
      committedOperations += operationsInBatch;
    }
  }

  return { progressDocumentsReset, committedOperations };
};

export const printLmsResetSummary = (summary) => {
  console.log(`Progress documents reset: ${summary.progressDocumentsReset}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  requireConfirmation("resetLmsProgress.mjs");
  const summary = await resetLmsProgress();
  printLmsResetSummary(summary);
}
