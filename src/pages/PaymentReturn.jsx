import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { paymentRequest } from "../services/payments";
import { formatNaira } from "../data/pricing";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export default function PaymentReturn() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    paymentRequest("verify", { reference }).then((data) => { if (active) setResult(data); }).catch((issue) => { if (active) setError(issue.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [reference, retry]);
  const complete = async () => {
    setBusy(true); setError("");
    try { const data = await paymentRequest("complete", { reference }); setResult((old) => ({ ...old, ...data, submitted: true })); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  };
  return <main className="academy-registration"><Navbar /><section className="academy-completion">
    <span className="academy-eyebrow">Secure payment confirmation</span>
    <h1>{result?.submitted ? (result.type === "scholarship" ? "Scholarship payment confirmed." : "Registration complete.") : result?.verified ? "Payment verified. One last step." : "Let’s check your payment."}</h1>
    {busy && <p role="status">{result?.verified ? "Saving your registration…" : "Checking with Paystack…"}</p>}
    {error && <div className="academy-error" role="alert"><p>{error}</p><p>If you have already paid, please do not pay again. Keep the reference below and contact admissions if the problem continues.</p></div>}
    {reference && <p className="academy-reference">Payment reference: <strong>{reference}</strong></p>}
    {result?.verified && <><div className="academy-payment-receipt"><h2>{result.courseTitle}</h2><p>{result.fullName}</p><p>Payment confirmed: <strong>{formatNaira(result.amount)}</strong></p><p>{result.learningMethod}</p></div>
      {result.submitted ? <><p>Your registration has been saved and is visible to our admissions team. They will contact you with onboarding details.</p><a target="_blank" rel="noopener noreferrer" className="academy-button" href="/">Back to Home</a></> : <><p>Your payment is confirmed directly with Paystack. No receipt screenshot is needed. Select the button below to submit your registration.</p><button className="academy-button" disabled={busy} onClick={complete}>Complete Registration</button></>}
    </>}
    {!result?.verified && !busy && <button className="academy-button" onClick={() => { setBusy(true); setError(""); setRetry((value) => value + 1); }}>Check Payment Again</button>}
    <p><a target="_blank" rel="noopener noreferrer" href="/contact">Contact admissions</a></p>
  </section><Footer /></main>;
}
