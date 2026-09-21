import { randomUUID } from 'node:crypto';
import { findCourse } from '../src/data/courses.js';
import { COHORT } from '../src/data/cohort.js';
import { getCoursePricing, getPricingRegion, applicationPricingFields } from '../src/data/pricing.js';
import { validateRegistration } from '../src/data/registration.js';

export class PaymentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function assertSuccessfulPayment(payment, order) {
  if (payment?.status !== 'success') throw new PaymentError('Payment has not been confirmed yet. If you have paid, wait a moment and check again.', 409);
  const metadata = payment.metadata || {};
  if (payment.reference !== order.reference || payment.amount !== order.amount * 100 ||
      payment.currency !== (order.currency || 'NGN') || payment.customer?.email?.toLowerCase() !== order.details.email ||
      metadata.orderReference !== order.reference || metadata.courseId !== order.courseId || metadata.applicationType !== order.type) {
    throw new PaymentError('This payment does not match your registration. Contact admissions with your reference; please do not pay again.', 409);
  }
  if (!payment.id) throw new PaymentError('Paystack has not supplied a transaction ID. Please check again.', 409);
}
export function applicationForOrder(order) {
  const course = findCourse(order.courseId);
  const fees = order.quotedFees || getCoursePricing(course.id, order.countryCode || 'NG');
  return {
    ...order.details, track: course.title, applicationType: order.type,
    cohortId: COHORT.id, cohortStartDate: COHORT.startDate, durationWeeks: course.durationWeeks,
    ...applicationPricingFields(fees),
    fullTuitionPaymentLink: `${COHORT.website}/register?course=${course.id}`,
  };
}

// The store and Paystack gateway are injected so all money paths can be tested
// without credentials, real applications, or a charge to anyone's card.
export function createPaymentService({ store, gateway, makeReference = () => `ovt_${randomUUID().replaceAll('-', '')}` }) {
  const getOrder = async (reference) => {
    if (!/^ovt_[a-f0-9]{32}$/.test(reference || '')) throw new PaymentError('Your payment reference is missing or invalid.');
    const order = await store.getOrder(reference);
    if (!order) throw new PaymentError('Payment reference not found. Contact admissions if you have paid.', 404);
    return order;
  };
  const initialize = async (input, origin, visitorCountryCode) => {
    let details, applicationId, application;
    if (input.type === 'tuition') details = validateRegistration(input.details, 'tuition');
    else if (input.type === 'scholarship') {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.applicationId || '')) throw new PaymentError('Enter a valid application reference.');
      application = await store.getApplication(input.applicationId);
      if (!application || !input.email || application.email?.toLowerCase() !== input.email.trim().toLowerCase()) {
        throw new PaymentError('We could not match that approved application and email.', 404);
      }
      if (application.applicationType !== 'scholarship' || application.cohortId !== COHORT.id) throw new PaymentError('Please use the payment instructions in your original approval email or contact admissions.');
      if (application.paymentVerified || application.paymentStatus === 'Paid') throw new PaymentError('This application is already paid. Contact admissions for onboarding.', 409);
      if (application.status !== 'Approved') throw new PaymentError('Your scholarship must be approved before payment.', 409);
      details = validateRegistration(application, 'scholarship');
      applicationId = input.applicationId;
    } else throw new PaymentError('Choose full tuition or an approved scholarship.');
    const course = findCourse(details.courseId);
    // Tuition uses Netlify's trusted visitor country. Approved scholarships keep
    // the region recorded at application time, even if the learner travels.
    const countryCode = application
      ? application.detectedCountryCode || (!application.currency || application.currency === 'NGN' ? 'NG' : null)
      : visitorCountryCode;
    const fees = getCoursePricing(course.id, countryCode);
    if (!fees) throw new PaymentError('We could not confirm your local fees. Please refresh the page or contact admissions.', 409);
    if (!application && input.countryCode && getPricingRegion(input.countryCode) !== fees.region) {
      throw new PaymentError('Your location has changed. Refresh the page and confirm the updated course fee before paying.', 409);
    }
    if (application?.currency && application.currency !== fees.currency) throw new PaymentError('Please contact admissions to confirm the currency on your application.', 409);
    // International checkout must be configured separately. Never replace the
    // displayed GBP/USD quote with a Nigerian price or send an unsupported charge.
    if (fees.currency !== 'NGN') throw new PaymentError(`Please contact admissions to arrange payment of ${input.type === 'tuition' ? fees.tuition : fees.scholarship} for this course.`, 409);
    const reference = makeReference();
    let order = {
      reference, type: input.type, details, courseId: course.id, currency: fees.currency, countryCode: fees.countryCode,
      amount: input.type === 'tuition' ? fees.tuitionAmount : fees.scholarshipAmount,
      applicationId: applicationId || `tuition_${reference}`, status: 'pending',
    };
    order.applicationDetails = applicationForOrder(order);
    // Reuse an in-flight scholarship checkout to avoid double payment on retries.
    order = await store.reserveOrder(order);
    if (order.status !== 'pending') throw new PaymentError('Your payment has already been received. Contact admissions with your reference.', 409);
    if (order.authorizationUrl) return { reference: order.reference, authorizationUrl: order.authorizationUrl };
    const transaction = await gateway.initialize({
      email: order.details.email, amount: order.amount * 100, currency: order.currency, reference: order.reference,
      callback_url: `${origin}/registration/complete`,
      metadata: { orderReference: order.reference, courseId: order.courseId, applicationType: order.type },
    });
    const url = new URL(transaction.authorization_url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com') throw new PaymentError('The payment provider returned an unexpected checkout address.', 502);
    await store.saveCheckout(order.reference, url.href);
    return { reference: order.reference, authorizationUrl: url.href };
  };
  const verify = async (reference) => {
    const order = await getOrder(reference);
    const payment = await gateway.verify(reference);
    assertSuccessfulPayment(payment, order);
    const updated = await store.markVerified(order, payment, order.applicationDetails || applicationForOrder(order));
    return {
      verified: true, submitted: updated.status === 'submitted' || order.type === 'scholarship',
      type: order.type, reference, applicationId: order.applicationId,
      amount: order.amount, currency: order.currency || 'NGN', fullName: order.details.fullName,
      courseTitle: order.applicationDetails?.track || findCourse(order.courseId).title, learningMethod: order.details.learningMethod,
    };
  };
  const complete = async (reference) => {
    const result = await verify(reference); // Never trust the browser's earlier verification.
    await store.finalize(reference);
    return { ...result, submitted: true };
  };
  return { initialize, verify, complete };
}
