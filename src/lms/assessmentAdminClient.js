import { requestPortalApi } from './portalClient.js';

export function assessmentAdminRequest(action, data, signal) {
  return requestPortalApi('/api/final-assessment-admin', action, data, signal);
}
