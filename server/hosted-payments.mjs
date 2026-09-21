import { getCoursePricing, getPricingRegion } from '../src/data/pricing.js';
import { getPaymentPage } from '../src/data/paymentPages.js';
import { findCourse } from '../src/data/courses.js';
import { COHORT } from '../src/data/cohort.js';
import { validateRegistration } from '../src/data/registration.js';
import { PaymentError, applicationForOrder } from './payment-core.mjs';

export function assertHostedPayment(payment, order) {
  if (payment?.status !== 'success') throw new PaymentError('Paystack has not confirmed this payment yet. If you have paid, check again shortly.', 409);
  const paidAt = Date.parse(payment.paid_at || payment.paidAt);
  if (!payment.id || payment.currency !== 'NGN' || payment.amount !== order.amount * 100 ||
      payment.customer?.email?.trim().toLowerCase() !== order.details.email ||
      payment.domain !== 'live' || !Number.isFinite(paidAt) || paidAt < order.createdAtMs - 1000 ||
      (order.transactionReference && payment.reference !== order.transactionReference)) {
    throw new PaymentError('This payment does not match your registration, email, or expected amount. Contact admissions with your reference before making another payment.', 409);
  }
}

export function createHostedPaymentService({ store, gateway, makeReference, now = Date.now }) {
  const getOrder = async (reference) => {
    if (!/^ovt_[a-f0-9]{32}$/.test(reference || '')) throw new PaymentError('Your registration reference is missing or invalid.');
    const order = await store.getOrder(reference);
    if (!order || order.checkoutMode !== 'hosted') throw new PaymentError('This saved registration could not be found. Contact admissions if you have paid.', 404);
    return order;
  };
  const view = (order) => ({
    reference: order.reference, type: order.type, details: order.details,
    applicationId: order.applicationId, courseTitle: findCourse(order.courseId).title,
    fees: order.quotedFees, paymentUrl: order.paymentUrl,
    amount: order.amount, currency: 'NGN', submitted: order.status === 'submitted',
    verified: ['paid', 'submitted'].includes(order.status),
    paymentReference: order.transactionReference || '',
  });
  const prepare = async (input, origin, visitorCountryCode) => {
    let application;
    let details;
    if (input.type === 'tuition') details = validateRegistration(input.details, 'tuition');
    else if (input.type === 'scholarship') {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.applicationId || '')) throw new PaymentError('Enter a valid application reference.');
      application = await store.getApplication(input.applicationId);
      if (!application || application.email?.toLowerCase() !== input.email?.trim().toLowerCase()) throw new PaymentError('We could not match that approved application and email.', 404);
      if (application.applicationType !== 'scholarship' || application.cohortId !== COHORT.id) throw new PaymentError('Contact admissions for the payment instructions for your original cohort.');
      if (application.status !== 'Approved') throw new PaymentError('Your scholarship must be approved before payment.', 409);
      if (application.paymentVerified || application.paymentStatus === 'Paid') throw new PaymentError('This application is already paid. Contact admissions for onboarding.', 409);
      details = validateRegistration(application, 'scholarship');
    } else throw new PaymentError('Choose full tuition or an approved scholarship.');
    const countryCode = application ? application.detectedCountryCode || (application.currency === 'NGN' ? 'NG' : null) : visitorCountryCode;
    const fees = getCoursePricing(details.courseId, countryCode);
    if (!fees) throw new PaymentError('We could not confirm your local fees. Refresh the page or contact admissions.', 409);
    if (!application && input.countryCode && getPricingRegion(input.countryCode) !== fees.region) throw new PaymentError('Your location has changed. Go back and confirm your updated course fee.', 409);
    const mapping = getPaymentPage(fees, input.type);
    if (!mapping) throw new PaymentError('The payment page for this course is unavailable. Please contact admissions.', 409);
    const paymentPage = await gateway.page(mapping.slug);
    const amount = Number(paymentPage.amount) / 100;
    if (paymentPage.slug !== mapping.slug || paymentPage.currency !== 'NGN' || paymentPage.domain !== 'live' ||
        paymentPage.active !== true || paymentPage.published === false || paymentPage.fixed_amount === false ||
        (paymentPage.type && paymentPage.type !== 'payment') || !paymentPage.id ||
        !Number.isSafeInteger(Number(paymentPage.amount)) || amount <= 0) {
      throw new PaymentError('The configured Paystack page is not an active, fixed-amount naira payment page. Please contact admissions before paying.', 409);
    }
    const quotedAmount = input.type === 'tuition' ? fees.tuitionAmount : fees.scholarshipAmount;
    if (fees.currency === 'NGN' && amount !== quotedAmount) throw new PaymentError('The Paystack page amount does not match your course fee. Please contact admissions before paying.', 409);
    const reference = makeReference();
    let order = {
      reference, type: input.type, details, courseId: details.courseId,
      currency: 'NGN', amount, countryCode: fees.countryCode, quotedFees: fees,
      checkoutMode: 'hosted', paymentUrl: mapping.url, paymentPageId: paymentPage.id,
      applicationId: application ? input.applicationId : `tuition_${reference}`,
      status: 'pending', createdAtMs: now(),
    };
    order.applicationDetails = applicationForOrder(order);
    order = await store.reserveOrder(order);
    if (order.checkoutMode !== 'hosted') throw new PaymentError('An earlier checkout already exists for this application. Contact admissions before paying again.', 409);
    if (order.status !== 'pending') throw new PaymentError('Payment has already been received. Contact admissions for onboarding.', 409);
    return view(order);
  };
  const verify = async (reference, transactionReference) => {
    const order = await getOrder(reference);
    const receipt = order.transactionReference || transactionReference;
    if (!/^[A-Za-z0-9._=-]{6,100}$/.test(receipt || '')) throw new PaymentError('Enter the Paystack transaction reference from your receipt.');
    if (order.transactionReference && transactionReference && transactionReference !== order.transactionReference) throw new PaymentError('This registration already has a different confirmed payment. Contact admissions.', 409);
    const payment = await gateway.verify(receipt);
    if (payment.reference !== receipt) throw new PaymentError('Paystack returned a different payment reference. Please contact admissions.', 409);
    assertHostedPayment(payment, order);
    const updated = await store.markVerified(order, payment, order.applicationDetails);
    return { ...view({ ...order, ...updated, transactionReference: receipt }), verified: true };
  };
  const complete = async (reference, transactionReference) => {
    const result = await verify(reference, transactionReference);
    await store.finalize(reference);
    return { ...result, submitted: true };
  };
  return { prepare, status: async (reference) => view(await getOrder(reference)), verify, complete };
}
