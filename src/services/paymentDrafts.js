const KEY = 'ovtech.checkout-drafts.v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const validId = (id) => /^[a-f0-9-]{36}$/.test(id || '');

export function listPaymentDrafts() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.values(data).filter((item) => validId(item?.id) && Number.isFinite(item.createdAt) && Date.now() - item.createdAt < MAX_AGE);
  } catch { return []; }
}
export const readPaymentDraft = (id) => listPaymentDrafts().find((item) => item.id === id) || null;
export function savePaymentDraft(draft) {
  if (!validId(draft.id)) throw new Error('The saved registration could not be identified. Please start again.');
  const data = Object.fromEntries(listPaymentDrafts().map((item) => [item.id, item]));
  data[draft.id] = draft;
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { throw new Error('Allow this website to save your registration in this browser before continuing to payment.'); }
  return draft;
}
export const createPaymentDraft = (data) => savePaymentDraft({ ...data, id: crypto.randomUUID(), createdAt: Date.now() });
export function forgetPaymentDraft(id) {
  const data = Object.fromEntries(listPaymentDrafts().filter((item) => item.id !== id).map((item) => [item.id, item]));
  localStorage.setItem(KEY, JSON.stringify(data));
}
