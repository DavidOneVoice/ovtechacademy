import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { listPaymentDrafts, readPaymentDraft, savePaymentDraft } from '../services/paymentDrafts';
import { paymentRequest } from '../services/payments';
import { findCourse } from '../data/courses';
import { formatMoney } from '../data/pricing';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const [drafts] = useState(() => listPaymentDrafts().filter((item) => item.orderReference));
  const [initialDraft] = useState(() => {
    const requested = params.get('draft');
    // A return with no draft identifier must never guess between registrations.
    if (requested) return readPaymentDraft(requested);
    const pending = drafts.filter((item) => !item.submitted);
    return pending.length === 1 ? pending[0] : null;
  });
  const [draft, setDraft] = useState(initialDraft);
  const [initialReference] = useState(params.get('reference') || params.get('trxref') || initialDraft?.paymentReference || '');
  const [reference, setReference] = useState(initialReference);
  const [result, setResult] = useState(null);
  const shouldAutoCheck = Boolean(initialDraft?.orderReference && /^[A-Za-z0-9._=-]{6,100}$/.test(initialReference));
  const [busy, setBusy] = useState(shouldAutoCheck);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const initialRequest = useRef(null);
  const run = async (action) => {
    if (!draft?.orderReference || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const data = await paymentRequest(action, { reference: draft.orderReference, paymentReference: reference.trim() });
      setResult(data);
      if (data.paymentReference) setReference(data.paymentReference);
      if (data.verified) {
        const saved = savePaymentDraft({ ...draft, details: data.details, fees: data.fees, paymentReference: data.paymentReference, submitted: data.submitted });
        setDraft(saved);
      }
    } catch (issue) { setError(issue.message); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!shouldAutoCheck) return;
    let active = true;
    initialRequest.current ||= paymentRequest('verify-hosted', { reference: initialDraft.orderReference, paymentReference: initialReference });
    initialRequest.current.then((data) => {
      if (!active) return;
      setResult(data); setReference(data.paymentReference);
      setDraft(savePaymentDraft({ ...initialDraft, details: data.details, fees: data.fees, paymentReference: data.paymentReference, submitted: data.submitted }));
    }).catch((issue) => { if (active) setError(issue.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [initialDraft, initialReference, shouldAutoCheck]);
  return <main className="academy-registration"><Navbar /><section className="academy-payment-review">
    <span className="academy-eyebrow">Payment and registration</span>
    <h1>{result?.submitted ? (draft.type === 'scholarship' ? 'Your scholarship payment is confirmed.' : 'Registration complete.') : result?.verified ? 'Payment verified. Complete your registration.' : 'Check your payment and finish registration.'}</h1>
    {!draft?.orderReference ? <>
      <p>{draft ? 'This draft has not reached the payment step yet.' : 'Choose the registration you started in this browser.'}</p>
      {drafts.length > 0 && <label className="academy-draft-choice">Saved registration<select defaultValue="" onChange={(event) => { setDraft(readPaymentDraft(event.target.value)); setResult(null); setError(''); }}><option value="" disabled>Select your registration</option>{drafts.map((item) => <option key={item.id} value={item.id}>{item.details.fullName} — {findCourse(item.details.courseId)?.title} ({item.type}){item.submitted ? ' — submitted' : ''}</option>)}</select></label>}
      {draft && <a className="academy-button" href={`/payment-review?draft=${draft.id}`} target="_blank" rel="noopener noreferrer">Review registration</a>}
      <p>If you paid through an earlier payment link or used another browser, admissions can match your receipt to your application. Keep your Paystack reference and contact us; there is no need to pay again.</p>
    </> : <>
      <div className="academy-payment-receipt"><h2>{result?.courseTitle || findCourse(draft.details.courseId)?.title}</h2><p>{draft.details.fullName}</p><p>{draft.details.email}</p><p>{draft.details.learningMethod}</p></div>
      {!result?.verified && <form className="academy-registration-form" onSubmit={(event) => { event.preventDefault(); run('verify-hosted'); }}>
        <p>Enter the transaction reference from your Paystack receipt. If Paystack included it in the return link, it is already filled in below.</p>
        <label>Paystack transaction reference<input name="paymentReference" value={reference} onChange={(event) => setReference(event.target.value)} required minLength={6} maxLength={100} autoComplete="off" disabled={busy} /></label>
        <button className="academy-button" disabled={busy}>{busy ? 'Checking with Paystack…' : 'Verify Payment'}</button>
        <p>Opening this page alone does not confirm payment. We check the amount, email, and transaction directly with Paystack.</p>
      </form>}
      {result?.verified && <><p>Payment confirmed: <strong>{formatMoney(result.amount, 'NGN')}</strong></p><p className="academy-reference">Paystack reference: <strong>{result.paymentReference}</strong></p>
        {result.submitted ? <><p>Your {draft.type === 'scholarship' ? 'payment and application' : 'registration'} has been saved for admissions. The team will contact you with onboarding details.</p><a className="academy-button" href="/" target="_blank" rel="noopener noreferrer">Back to Home</a></> : <><p>Select the button below to finish. Your payment will be checked again before submission.</p><button className="academy-button" onClick={() => run('complete-hosted')} disabled={busy}>{busy ? 'Completing registration…' : 'Complete Registration'}</button></>}
      </>}
      {!result?.submitted && <p><a href={`/payment-review?draft=${draft.id}`} target="_blank" rel="noopener noreferrer">Back to registration details</a></p>}
    </>}
    {error && <div className="academy-error" role="alert"><p>{error}</p><p>If you have paid, keep your receipt and contact admissions before making another payment.</p></div>}
    <p><a href="/contact" target="_blank" rel="noopener noreferrer">Contact admissions</a> · <a href="https://wa.me/2348130624789" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></p>
  </section><Footer /></main>;
}
