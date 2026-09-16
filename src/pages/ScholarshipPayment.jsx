import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { paymentRequest, goToCheckout } from "../services/payments";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export default function ScholarshipPayment() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pay = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await paymentRequest("initialize", { type: "scholarship", applicationId: params.get("application"), email }); goToCheckout(result.authorizationUrl); }
    catch (issue) { setError(issue.message); setBusy(false); }
  };
  return <main className="academy-registration"><Navbar /><section className="academy-completion"><span className="academy-eyebrow">Approved applicants</span><h1>Secure your scholarship place.</h1><p>Enter the email address on your approved application. Paystack will show your course’s scholarship fee before you pay.</p>
    {!params.get("application") && <p className="academy-error" role="alert">Open the payment link in your scholarship approval email. It contains your application reference.</p>}
    <form className="academy-registration-form" onSubmit={pay}><label>Application email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error && <p className="academy-error" role="alert">{error}</p>}<button className="academy-button" disabled={busy || !params.get("application")}>{busy ? "Please wait…" : "Continue to Paystack"}</button></form><p><a target="_blank" rel="noopener noreferrer" href="/contact">Need help? Contact admissions</a></p>
  </section><Footer /></main>;
}
