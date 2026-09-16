import { handlePaystackWebhook } from '../../server/payment-http.mjs';
export default (request) => handlePaystackWebhook(request);
export const config = { path: '/api/paystack-webhook' };
