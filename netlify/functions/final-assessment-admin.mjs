import { handleFinalAssessmentAdmin } from '../../server/final-assessment-admin-http.mjs';

export default (request, context) => handleFinalAssessmentAdmin(request, context);
export const config = { path: '/api/final-assessment-admin' };
