import { createHmac, timingSafeEqual } from 'node:crypto';
import { createPaymentService, PaymentError } from './payment-core.mjs';
import { firebasePaymentStore } from './payment-store.mjs';

const MAX_BODY = 32 * 1024;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const sessionToken = (reference, secret) => createHmac('sha256', secret).update(`ovtech-enrollment-session:${reference}`).digest('hex');
export function hasPaymentSession(request, reference, secret) {
  if (!/^ovt_[a-f0-9]{32}$/.test(reference || '')) return false;
  const cookie = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`ovtech_${reference}=`));
  return safeEqual(cookie?.slice(cookie.indexOf('=') + 1), sessionToken(reference, secret));
}
export function validWebhookSignature(body, signature, secret) {
  return safeEqual(signature, createHmac('sha512', secret).update(body).digest('hex'));
}
const readBody = async (request) => {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new PaymentError('Request is too large.', 413);
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_BODY) throw new PaymentError('Request is too large.', 413);
  return body;
};
function dependencies(env) {
  if (env.ENROLLMENT_PAYMENTS_ENABLED !== 'true' || !env.PAYSTACK_SECRET_KEY || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new PaymentError('Online tuition payment is being set up. Please contact admissions for help. If you have already paid, keep your reference and do not pay again.', 503);
  }
  const call = async (path, body) => {
    const response = await fetch(`https://api.paystack.co${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || result.status !== true) throw new PaymentError('We could not confirm the request with Paystack. If you have paid, keep your reference and contact admissions before paying again.', 502);
    return result.data;
  };
  const store = firebasePaymentStore(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON));
  return createPaymentService({ store, gateway: {
    initialize: (body) => call('/transaction/initialize', body),
    verify: (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`),
  } });
}
export async function handlePaymentRequest(request, env = process.env, injectedService) {
  try {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, { Allow: 'POST' });
    const origin = new URL(request.url).origin;
    if (request.headers.get('origin') !== origin) throw new PaymentError('Open the payment page on this website and try again.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PaymentError('Send a JSON request.', 415);
    const configuredOrigin = new URL(env.ENROLLMENT_SITE_URL || env.DEPLOY_PRIME_URL || env.URL || origin).origin;
    if (origin !== configuredOrigin) throw new PaymentError('Use the academy’s configured website to complete payment.', 403);
    const body = JSON.parse(await readBody(request));
    const service = injectedService || dependencies(env);
    if (body.action === 'initialize') {
      const result = await service.initialize(body, origin);
      return json(result, 200, { 'Set-Cookie': `ovtech_${result.reference}=${sessionToken(result.reference, env.PAYSTACK_SECRET_KEY)}; Path=/api/payments; HttpOnly; SameSite=Lax; Max-Age=604800${origin.startsWith('https:') ? '; Secure' : ''}` });
    }
    if (!['verify', 'complete'].includes(body.action)) throw new PaymentError('Unknown payment action.');
    if (!hasPaymentSession(request, body.reference, env.PAYSTACK_SECRET_KEY)) throw new PaymentError('Open the return link in the browser where you started payment. If that is unavailable, contact admissions with your reference; please do not pay again.', 403);
    return json(await service[body.action](body.reference));
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid request or payment configuration. Please contact admissions.' }, 400);
    const status = error.status || (error.name === 'Error' && /^(Please|Enter|Select|Tell|Your response)/.test(error.message) ? 400 : 500);
    return json({ error: status < 500 || error instanceof PaymentError ? error.message : 'We could not finish that request. If you have paid, keep your reference and contact admissions before paying again.' }, status);
  }
}
export async function handlePaystackWebhook(request, env = process.env, injectedService) {
  try {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    if (!env.PAYSTACK_SECRET_KEY) return json({ error: 'Webhook unavailable.' }, 503);
    const body = await readBody(request);
    if (!validWebhookSignature(body, request.headers.get('x-paystack-signature'), env.PAYSTACK_SECRET_KEY)) return json({ error: 'Invalid signature.' }, 401);
    const event = JSON.parse(body);
    if (event.event !== 'charge.success' || !/^ovt_[a-f0-9]{32}$/.test(event.data?.reference || '')) return json({ received: true });
    const service = injectedService || dependencies(env);
    await service.verify(event.data.reference);
    return json({ received: true });
  } catch { return json({ error: 'Webhook could not be processed; retry required.' }, 503); }
}
