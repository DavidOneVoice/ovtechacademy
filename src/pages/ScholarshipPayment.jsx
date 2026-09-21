import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paymentRequest } from "../services/payments";
import { createPaymentDraft } from "../services/paymentDrafts";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export default function ScholarshipPayment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pay = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await paymentRequest("prepare-hosted", { type: "scholarship", applicationId: params.get("application"), email });
      const draft = createPaymentDraft({ type: 'scholarship', details: result.details, fees: result.fees, countryCode: result.fees.countryCode, orderReference: result.reference });
      navigate(`/payment-review?draft=${draft.id}`);
    }
    catch (issue) { setError(issue.message); setBusy(false); }
  };
  return <main className="academy-registration"><Navbar /><section className="academy-completion"><span className="academy-eyebrow">Approved applicants</span><h1>Secure your scholarship place.</h1><p>Enter the email address on your approved application. Paystack will show your course’s scholarship fee before you pay.</p>
    {!params.get("application") && <p className="academy-error" role="alert">Open the payment link in your scholarship approval email. It contains your application reference.</p>}
    <form className="academy-registration-form" onSubmit={pay}><label>Application email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error && <p className="academy-error" role="alert">{error}</p>}<button className="academy-button" disabled={busy || !params.get("application")}>{busy ? "Please wait…" : "Continue to Payment"}</button></form><p><a target="_blank" rel="noopener noreferrer" href="/payment-success">Already paid? Check your payment</a></p><p><a target="_blank" rel="noopener noreferrer" href="/contact">Need help? Contact admissions</a></p>
  </section><Footer /></main>;
}
