import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { readPaymentDraft, savePaymentDraft, forgetPaymentDraft } from '../services/paymentDrafts';
import { paymentRequest } from '../services/payments';
import { formatMoney } from '../data/pricing';
import { getPaymentPage } from '../data/paymentPages';
import { findCourse } from '../data/courses';

async function checkReview(draft) {
  const result = draft.orderReference
    ? await paymentRequest('status-hosted', { reference: draft.orderReference })
    : await paymentRequest('prepare-hosted', { type: draft.type, details: draft.details, countryCode: draft.countryCode });
  if (result.paymentUrl !== getPaymentPage(result.fees, result.type)?.url) throw new Error('The payment link could not be matched to your course. Please contact admissions.');
  const saved = savePaymentDraft({ ...draft, details: result.details, fees: result.fees, orderReference: result.reference, submitted: result.submitted });
  return { result, saved };
}
export default function PaymentReview() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [initialDraft] = useState(() => readPaymentDraft(params.get('draft')));
  const [draft, setDraft] = useState(initialDraft);
  const [ready, setReady] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(Boolean(initialDraft));
  const requestLock = useRef(false);
  const initialRequest = useRef(null);
  const prepare = async () => {
    if (!draft || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(''); setReady(null);
    try {
      const { result, saved } = await checkReview(draft);
      setDraft(saved); setReady(result);
    } catch (issue) { setError(issue.message); }
    finally { requestLock.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!initialDraft) return;
    let active = true;
    // Reuse the same request when React checks an effect twice in development.
    initialRequest.current ||= checkReview(initialDraft);
    initialRequest.current.then(({ result, saved }) => { if (active) { setDraft(saved); setReady(result); } })
      .catch((issue) => { if (active) setError(issue.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [initialDraft]);
  const openPayment = (event) => {
    try { const saved = savePaymentDraft({ ...draft, checkoutOpened: true }); setDraft(saved); }
    catch (issue) { event.preventDefault(); setError(issue.message); }
  };
  const edit = () => navigate(`/register?draft=${draft.id}`);
  const details = ready?.details || draft?.details;
  const fees = ready?.fees || draft?.fees;
  const course = findCourse(details?.courseId);
  return <main className="academy-registration"><Navbar /><section className="academy-payment-review">
    <span className="academy-eyebrow">Review and payment</span><h1>Check your details before paying.</h1>
    {!draft ? <><p>Your saved registration is unavailable in this browser. If you have already paid, keep your receipt and contact admissions.</p><a className="academy-button" href="/register" target="_blank" rel="noopener noreferrer">Start registration</a></> : <>
      <h2>{course?.title}</h2>
      <dl className="academy-review-details">{[
        ['Full name', details.fullName], ['Email address', details.email], ['WhatsApp', details.whatsapp],
        ['City and country', details.location], ['Age range', details.ageRange], ['Learning format', details.learningMethod],
        ['How you heard about us', details.referral], ['Referral code', details.referralCode || 'Not supplied'],
        [draft.type === 'scholarship' ? 'Scholarship statement' : 'Learning goals', details.reason || 'Not supplied'],
        ['Payment type', draft.type === 'scholarship' ? 'Approved scholarship registration fee' : 'Full tuition'],
        ['Course fee', draft.type === 'scholarship' ? fees?.scholarship : fees?.tuition],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {!draft.checkoutOpened && draft.type === 'tuition' && !ready?.verified && <button className="academy-button academy-button-secondary" onClick={edit} disabled={busy}>Back / Edit details</button>}
      {busy && <p role="status">Checking the payment page and saving your registration details…</p>}
      {error && <div className="academy-error" role="alert"><p>{error}</p><p>Your details remain saved here. If you have paid, use your receipt reference; please do not pay again.</p><button className="academy-button" onClick={prepare} disabled={busy}>Check availability again</button></div>}
      {ready && !ready.verified && <div className="academy-payment-instructions">
        <h2>Make your payment</h2><p>Paystack will collect <strong>{formatMoney(ready.amount, 'NGN')}</strong>{fees.currency !== 'NGN' ? ` for your ${draft.type === 'scholarship' ? fees.scholarship : fees.tuition} course fee` : ''}.</p>
        <p>Use <strong>{details.email}</strong> as your email on Paystack so your payment can be matched to this registration.</p>
        {!draft.checkoutOpened ? <a className="academy-button" href={ready.paymentUrl} target="_blank" rel="noopener noreferrer" onClick={openPayment}>Make Payment — opens a new tab</a> : <><p>The payment page has been opened. If you paid, continue below to check your reference and finish registration.</p><a href={ready.paymentUrl} target="_blank" rel="noopener noreferrer" onClick={openPayment}>Haven’t paid? Reopen the payment page</a></>}
        <p>After payment, Paystack may return you to our payment-success page. You can also return to this tab and select the button below.</p>
      </div>}
      {(ready || draft.checkoutOpened) && <a className="academy-button academy-button-secondary" href={`/payment-success?draft=${draft.id}`} target="_blank" rel="noopener noreferrer">{ready?.verified ? 'Complete Registration' : 'I have paid — complete registration'}</a>}
      {!draft.checkoutOpened && !ready?.verified && <button className="academy-text-button" disabled={busy} onClick={() => { forgetPaymentDraft(draft.id); navigate('/register'); }}>Discard this draft</button>}
    </>}
    <p><a href="/contact" target="_blank" rel="noopener noreferrer">Contact admissions</a></p>
  </section><Footer /></main>;
}
