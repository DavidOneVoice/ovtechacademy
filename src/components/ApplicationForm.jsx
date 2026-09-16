import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import { db } from "../src/firebase";
import courses, { findCourse } from "../data/courses";
import { getCoursePricing } from "../data/pricing";
import { COHORT } from "../data/cohort";
import { AGE_RANGES, REFERRALS, emptyRegistration, validateRegistration } from "../data/registration";
import { paymentRequest, goToCheckout } from "../services/payments";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function ApplicationForm({ type = "scholarship" }) {
  const [params] = useSearchParams();
  const scholarship = type === "scholarship";
  const [form, setForm] = useState(() => emptyRegistration(params.get("course")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [applicationId] = useState(() => doc(collection(db, "scholarshipApplications")).id);
  const course = findCourse(form.courseId);
  const fees = getCoursePricing(form.courseId);
  const change = (event) => {
    const { name, value } = event.target;
    setError("");
    if (name === "courseId") {
      const next = findCourse(value);
      setForm((old) => ({ ...old, courseId: value, learningMethod: scholarship ? next?.scholarshipMethod || "" : next?.tuitionMethods.length === 1 ? next.tuitionMethods[0] : "" }));
      setAccepted(false);
    } else setForm((old) => ({ ...old, [name]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    try {
      const clean = validateRegistration(form, type);
      if (!accepted) throw new Error("Please confirm the fee and learning format before continuing.");
      setBusy(true);
      if (!scholarship) {
        const result = await paymentRequest("initialize", { type: "tuition", details: clean });
        goToCheckout(result.authorizationUrl);
        return;
      }
      const application = {
        ...clean, track: course.title, learningMethod: course.scholarshipMethod,
        applicationType: "scholarship", cohortId: COHORT.id, cohortStartDate: COHORT.startDate,
        durationWeeks: course.durationWeeks,
        detectedCountry: "Nigeria", detectedCountryCode: "NG", currency: "NGN",
        tuition: fees.tuition, tuitionAmount: course.tuitionAmount,
        scholarshipFee: fees.scholarship, scholarshipFeeAmount: course.scholarshipAmount,
        scholarshipPercent: fees.scholarshipPercent, studentPaysPercent: fees.studentPaysPercent,
        scholarshipPaymentLink: `${COHORT.website}/scholarship-payment?application=${applicationId}`,
        fullTuitionPaymentLink: `${COHORT.website}/register?course=${course.id}`,
        status: "Pending", createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "scholarshipApplications", applicationId), application);
      setDone(true);
      if (import.meta.env.VITE_EMAILJS_SERVICE_ID && import.meta.env.VITE_EMAILJS_TEMPLATE_ID && import.meta.env.VITE_EMAILJS_PUBLIC_KEY) {
        try { await emailjs.send(import.meta.env.VITE_EMAILJS_SERVICE_ID, import.meta.env.VITE_EMAILJS_TEMPLATE_ID, {
          email: clean.email, to_name: clean.fullName,
          subjectTitle: "Your OVTech Scholarship Application Has Been Received",
          mainMessage: `Thank you for applying for ${course.title} in the ${COHORT.label} cohort. Your application is under review.`,
          extraMessage: `If approved, your scholarship fee is ${fees.scholarship}. Learning format: ${course.scholarshipMethod}. We will contact you with next steps.`,
          ctaText: "", ctaLink: "",
        }, import.meta.env.VITE_EMAILJS_PUBLIC_KEY); }
        catch { /* Submission already succeeded; never ask the learner to submit twice. */ }
      }
    } catch (issue) { setError(issue.message || "We couldn’t save your application. Please try again."); }
    finally { setBusy(false); }
  };
  return <main className="academy-registration"><Navbar />
    <header className="academy-registration-heading"><span className="academy-eyebrow">{COHORT.label} cohort · {COHORT.startDateLabel}</span>
      <h1>{scholarship ? "OVTech Scholarship Application" : "Full-Tuition Registration"}</h1>
      <p>{scholarship ? "Choose your course and tell us about yourself. You only pay the scholarship fee if your application is approved." : "Your details first. Secure payment next. Then come back to complete your registration."}</p>
    </header>
    {done ? <section className="academy-completion" role="status"><span className="academy-eyebrow">Application received</span><h2>You’ve taken the first step.</h2><p>Your {course.title} scholarship application is saved for our admissions team to review. We’ll contact you by email or WhatsApp.</p><p>Application reference: <strong>{applicationId}</strong></p><a target="_blank" rel="noopener noreferrer" className="academy-button" href="/courses">Explore the courses</a></section> :
    <div className="academy-registration-layout">
      <form className="academy-registration-form" onSubmit={submit}>
        <h2>1. Choose your course</h2>
        <label>Course<select name="courseId" value={form.courseId} onChange={change} required disabled={busy}><option value="">Select your course</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {course && <div className="academy-learning-rule" aria-live="polite">
          {scholarship && course.scholarshipRecordedOnly ? <><strong>Scholarship places cover pre-recorded learning only.</strong><p>One-on-one live classes are available only with full tuition.</p><label>Available learning method<select name="learningMethod" value={course.scholarshipMethod} onChange={change}><option value={course.scholarshipMethod}>{course.scholarshipMethod}</option></select></label></> :
          !scholarship && course.tuitionMethods.length > 1 ? <label>Learning method<select name="learningMethod" value={form.learningMethod} onChange={change} required disabled={busy}><option value="">Choose your learning method</option>{course.tuitionMethods.map((method) => <option key={method}>{method}</option>)}</select></label> :
          <><strong>Learning format: live group classes</strong><p>This course has one class format. There is no learning-method selection to make.</p></>}
        </div>}
        <h2>2. Your details</h2><div className="academy-form-grid">
          <label>Full name<input name="fullName" value={form.fullName} onChange={change} required maxLength={120} autoComplete="name" /></label>
          <label>Email address<input name="email" type="email" value={form.email} onChange={change} required maxLength={254} autoComplete="email" /></label>
          <label>WhatsApp number<input name="whatsapp" type="tel" value={form.whatsapp} onChange={change} required maxLength={25} autoComplete="tel" placeholder="e.g. +234 801 234 5678" /></label>
          <label>City and country<input name="location" value={form.location} onChange={change} required maxLength={180} placeholder="e.g. Lagos, Nigeria" /></label>
          <label>Age range<select name="ageRange" value={form.ageRange} onChange={change} required><option value="">Select your age range</option>{AGE_RANGES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>How did you hear about us?<select name="referral" value={form.referral} onChange={change} required><option value="">Select an option</option>{REFERRALS.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label>Referral code <span className="academy-optional">(optional)</span><input name="referralCode" value={form.referralCode} onChange={change} maxLength={80} /></label>
        <label>{scholarship ? "Why are you applying for a scholarship?" : "What would you like to achieve? (optional)"}<textarea name="reason" value={form.reason} onChange={change} required={scholarship} minLength={scholarship ? 10 : undefined} maxLength={2000} rows={4} /></label>
        {fees && <label className="academy-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>{scholarship ? `I understand that, if approved, I will pay ${fees.scholarship} (${fees.studentPaysPercent} of the ${fees.tuition} tuition) and study through ${course.scholarshipMethod.toLowerCase()}.` : `I confirm my course and learning format, and understand that full tuition is ${fees.tuition}. I will return after payment to complete registration.`}</span></label>}
        {error && <p className="academy-error" role="alert">{error}</p>}
        <button className="academy-button" type="submit" disabled={busy || !course}>{busy ? "Please wait…" : scholarship ? "Submit Scholarship Application" : `Continue to Paystack${fees ? ` · ${fees.tuition}` : ""}`}</button>
        {!scholarship && <p className="academy-form-help">This saves a payment draft. Your registration is submitted only after Paystack confirms the correct payment and you complete the final step. Already paid? Open your Paystack return link in the same browser or <a target="_blank" rel="noopener noreferrer" href="/contact">contact admissions</a> with your reference before paying again.</p>}
      </form>
      <aside className="academy-registration-summary"><span className="academy-eyebrow">Your learning plan</span><h2>{course?.title || "Your next chapter"}</h2>
        {course ? <><img src={course.image} alt={course.alt} width="1536" height="1024" /><dl><div><dt>Starts</dt><dd>{COHORT.startDateLabel}</dd></div><div><dt>Duration</dt><dd>{course.duration}</dd></div><div><dt>Full tuition</dt><dd>{fees.tuition}</dd></div>{scholarship && <><div><dt>Scholarship support</dt><dd>{fees.scholarshipPercent}</dd></div><div><dt>You pay if approved</dt><dd>{fees.scholarship} ({fees.studentPaysPercent})</dd></div></>}</dl></> : <p>Pick one of our six courses to see the exact fee, duration, and available class format.</p>}
        <p>All fees shown are in Nigerian naira (NGN).</p><a target="_blank" rel="noopener noreferrer" href={scholarship ? `/register${course ? `?course=${course.id}` : ""}` : `/scholarship${course ? `?course=${course.id}` : ""}`}>{scholarship ? "Prefer full tuition? Register here →" : "Looking for a scholarship? Apply here →"}</a>
      </aside>
    </div>}<Footer />
  </main>;
}
