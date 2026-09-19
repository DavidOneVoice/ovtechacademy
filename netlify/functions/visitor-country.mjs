import { normalizeCountryCode } from '../../src/data/pricing.js';

export default (request, context) => {
  const countryCode = normalizeCountryCode(context?.geo?.country?.code);
  return new Response(JSON.stringify({ countryCode }), {
    status: countryCode ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
    },
  });
};
export const config = { path: '/api/visitor-country' };
