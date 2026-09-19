import { handlePaymentRequest } from '../../server/payment-http.mjs';
export default (request, context) => handlePaymentRequest(request, process.env, undefined, context?.geo?.country?.code);
export const config = { path: '/api/payments' };
