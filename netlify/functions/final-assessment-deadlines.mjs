import { academyDb } from '../../server/academy-db.mjs';
import { createFinalAssessmentService } from '../../server/final-assessment.mjs';

export default async () => {
  await createFinalAssessmentService({ db: academyDb() }).finalizeOverdue();
  return new Response(null, { status: 204 });
};

export const config = { schedule: '* * * * *' };
