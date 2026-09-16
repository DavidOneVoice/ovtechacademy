import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PaymentError } from './payment-core.mjs';

export function firebasePaymentStore(serviceAccount) {
  const app = getApps().find((item) => item.name === 'enrollment-payments') || initializeApp({ credential: cert(serviceAccount) }, 'enrollment-payments');
  const db = getFirestore(app);
  const orders = db.collection('paymentOrders');
  const applications = db.collection('scholarshipApplications');
  const now = () => FieldValue.serverTimestamp();
  return {
    getOrder: async (reference) => (await orders.doc(reference).get()).data(),
    getApplication: async (id) => (await applications.doc(id).get()).data(),
    async reserveOrder(order) {
      if (order.type === 'tuition') {
        await orders.doc(order.reference).create({ ...order, createdAt: now() });
        return order;
      }
      const lock = db.collection('scholarshipPaymentLocks').doc(order.applicationId);
      return db.runTransaction(async (tx) => {
        const existing = (await tx.get(lock)).data();
        if (existing) {
          const saved = (await tx.get(orders.doc(existing.reference))).data();
          if (saved) return saved;
        }
        tx.create(orders.doc(order.reference), { ...order, createdAt: now() });
        tx.set(lock, { reference: order.reference, createdAt: now() });
        return order;
      });
    },
    saveCheckout: (reference, authorizationUrl) => orders.doc(reference).update({ authorizationUrl }),
    async markVerified(order, payment, application) {
      return db.runTransaction(async (tx) => {
        const ref = orders.doc(order.reference);
        const latest = (await tx.get(ref)).data();
        const appRef = applications.doc(order.applicationId);
        const existing = (await tx.get(appRef)).data();
        const receiptRef = db.collection('paymentReceipts').doc(String(payment.id));
        const receipt = (await tx.get(receiptRef)).data();
        if (receipt && receipt.reference !== order.reference) throw new PaymentError('This transaction is already linked to another registration.', 409);
        if (latest.status === 'submitted' || latest.status === 'paid') return latest;
        if (existing?.paymentVerified && existing.paymentReference !== order.reference) throw new PaymentError('This application already has a verified payment.', 409);
        const paymentFields = {
          paymentVerified: true, paymentStatus: 'Paid', paymentReference: order.reference,
          paymentAmount: order.amount, paymentCurrency: 'NGN',
          paymentProvider: 'paystack', paymentTransactionId: String(payment.id), paymentVerifiedAt: now(),
        };
        tx.set(receiptRef, { reference: order.reference, verifiedAt: now() });
        if (order.type === 'tuition') tx.create(appRef, {
          ...application, ...paymentFields, status: 'Payment Received',
          registrationStatus: 'awaiting_submission', createdAt: now(),
        });
        else {
          if (!existing) throw new PaymentError('Application no longer exists. Contact admissions with your payment reference.', 409);
          tx.update(appRef, paymentFields);
        }
        tx.update(ref, { status: 'paid', transactionId: String(payment.id), verifiedAt: now() });
        return { ...latest, status: 'paid' };
      });
    },
    async finalize(reference) {
      return db.runTransaction(async (tx) => {
        const ref = orders.doc(reference);
        const order = (await tx.get(ref)).data();
        if (!order || !['paid', 'submitted'].includes(order.status)) throw new PaymentError('Payment must be verified before submission.', 409);
        if (order.status === 'submitted') return;
        const appRef = applications.doc(order.applicationId);
        const application = (await tx.get(appRef)).data();
        if (!application) throw new PaymentError('Admissions needs to restore this application. Contact us with your payment reference.', 409);
        if (order.type === 'tuition') tx.update(appRef, {
          registrationStatus: 'submitted', submittedAt: now(),
          status: application.status === 'Payment Received' ? 'Pending' : application.status,
        });
        tx.update(ref, { status: 'submitted', submittedAt: now() });
      });
    },
  };
}
