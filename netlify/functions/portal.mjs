import { handlePortal } from '../../server/portal-http.mjs';
export default (request, context) => handlePortal(request, context);
export const config = { path: '/api/portal' };
