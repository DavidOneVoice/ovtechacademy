// Fixed payment pages supplied by the academy. A page is shared wherever the
// quoted currency, amount, and payment purpose are the same. Checkout is in NGN;
// the server reads the actual fixed amount from Paystack before allowing payment.
const page = (slug) => `https://paystack.shop/pay/${slug}`;
export const paymentPages = Object.freeze({
  'NGN:scholarship:15000': page('ovtech-scholarship'),
  'NGN:scholarship:20000': page('ovtech-tuition'),
  'NGN:tuition:150000': page('ovtech-ngr-tuition'),
  'NGN:tuition:300000': page('ovtech-ngr-tuition-300000'),
  'NGN:tuition:400000': page('ovtech-paymentpage-400000'),
  'NGN:tuition:500000': page('ovtech-tuition-500000'),
  'GBP:scholarship:15': page('ovtech-uk-30000'),
  'GBP:scholarship:20': page('ovtech-scholarship-uk40000'),
  'GBP:scholarship:40': page('ovtech-scholarship-uk80000'),
  'GBP:tuition:100': page('ovtech-tuition-uk200000'),
  'GBP:tuition:300': page('ovtech-tuition-uk600000'),
  'USD:scholarship:15': page('ovtech-scholarship-usd15'),
  'USD:scholarship:25': page('ovtech-scholarship-us25'),
  'USD:scholarship:30': page('ovtech-scholarship-us30'),
  'USD:scholarship:50': page('ovtech-scholarship-us50'),
  'USD:tuition:100': page('ovtech-tuition-us100'),
  'USD:tuition:250': page('ovtech-tuition-us250000'),
  'USD:tuition:300': page('ovtech-tuition-us300'),
  'USD:tuition:400': page('ovtech-tuition-us400'),
});

export function getPaymentPage(fees, type) {
  if (!fees || !['scholarship', 'tuition'].includes(type)) return null;
  const amount = type === 'scholarship' ? fees.scholarshipAmount : fees.tuitionAmount;
  const key = `${fees.currency}:${type}:${amount}`;
  const url = paymentPages[key];
  return url ? { key, url, slug: new URL(url).pathname.split('/').pop() } : null;
}
