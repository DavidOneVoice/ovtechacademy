import { handlePaymentRequest } from '../../server/payment-http.mjs';
export default (request) => handlePaymentRequest(request);
export const config = { path: '/api/payments' };
