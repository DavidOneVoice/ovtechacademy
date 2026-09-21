import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirestorePaymentStore } from './payment-store.mjs';

// Exercise the real transaction code with isolated documents, never Firebase.
function database() {
  const docs = new Map();
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: async (ref) => ({ data: () => docs.get(ref.path) }),
        create: (ref, value) => { assert.ok(!docs.has(ref.path)); writes.push([ref.path, value]); },
        set: (ref, value) => writes.push([ref.path, value]),
        update: (ref, value) => { assert.ok(docs.has(ref.path)); writes.push([ref.path, {...docs.get(ref.path), ...value}]); },
      };
      const result = await fn(tx);
      for (const [key, value] of writes) docs.set(key, value);
      return result;
    },
  };
  return { docs, store: createFirestorePaymentStore(db) };
}
test('the same Paystack transaction cannot fund two registrations, and retries do not create duplicates', async () => {
  const {docs,store}=database();
  const order={reference:'order1',applicationId:'app1',checkoutMode:'hosted',type:'tuition',currency:'NGN',amount:300000,status:'pending'};
  const other={...order,reference:'order2',applicationId:'app2'};
  docs.set('paymentOrders/order1',order);docs.set('paymentOrders/order2',other);
  const payment={id:123,reference:'paystack-123'};
  const result=await store.markVerified(order,payment,{fullName:'Local test'});
  assert.equal(result.transactionReference,'paystack-123');
  assert.equal(docs.get('scholarshipApplications/app1').paymentReference,'paystack-123');
  await store.markVerified(order,payment,{fullName:'Local test'});
  await assert.rejects(store.markVerified(other,payment,{}),/another registration/);
  await assert.rejects(store.markVerified(order,{id:999,reference:'different'},{}),/different confirmed payment/);
  assert.ok(!docs.has('scholarshipApplications/app2'));
  await store.finalize('order1');await store.finalize('order1');
  assert.equal(docs.get('scholarshipApplications/app1').registrationStatus,'submitted');
});
