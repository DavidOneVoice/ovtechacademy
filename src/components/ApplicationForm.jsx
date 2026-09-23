import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import { db } from "../src/firebase";
import courses, { findCourse } from "../data/courses";
import { applicationPricingFields } from "../data/pricing";
import usePricing from "../hooks/usePricing";
import PricingStatus from "./PricingStatus";
import ScholarshipConfirmationDialog from "./ScholarshipConfirmationDialog";
import { COHORT } from "../data/cohort";
import { trackEvent } from "../analytics/events";
import { AGE_RANGES, REFERRALS, emptyRegistration, validateRegistration } from "../data/registration";
import { createPaymentDraft, readPaymentDraft, forgetPaymentDraft } from "../services/paymentDrafts";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function ApplicationForm({ type = "scholarship" }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const scholarship = type === "scholarship";
  const [form, setForm] = useState(() => {
    const saved = !scholarship && readPaymentDraft(params.get("draft"));
    return saved && !saved.checkoutOpened && !saved.submitted ? saved.details : emptyRegistration(params.get("course"));
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pendingApplication, setPendingApplication] = useState(null);
  const submitting = useRef(false);
  const applicationStarted = useRef(false);
  const [applicationId] = useState(() => doc(collection(db, "scholarshipApplications")).id);
  const course = findCourse(form.courseId);
  const fees = usePricing(form.courseId);
  const change = (event) => {
    const { name, value } = event.target;
    if (!applicationStarted.current) {
      applicationStarted.current = true;
      trackEvent("begin_application", { course_id: name === "courseId" ? value : form.courseId, application_type: type });
    }
    setError("");
    if (name === "courseId") {
      const next = findCourse(value);
      setForm((old) => ({ ...old, courseId: value, learningMethod: scholarship ? next?.scholarshipMethod || "" : next?.tuitionMethods.length === 1 ? next.tuitionMethods[0] : "" }));
      setAccepted(false);
    } else setForm((old) => ({ ...old, [name]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || done || pendingApplication) return;
    setError("");
    try {
      const clean = validateRegistration(form, type);
      if (!fees) throw new Error("Please wait for your local fees to load, or retry the fee lookup.");
      if (scholarship) {
        setPendingApplication({ details: clean, course, fees });
        return;
      }
      if (!accepted) throw new Error("Please confirm the fee and learning format before continuing.");
      submitting.current = true;
      setBusy(true);
      const draft = createPaymentDraft({ type: 'tuition', details: clean, countryCode: fees.countryCode, fees });
      const previous = readPaymentDraft(params.get('draft'));
      if (previous && !previous.checkoutOpened && !previous.submitted) forgetPaymentDraft(previous.id);
      navigate(`/payment-review?draft=${draft.id}`);
    } catch (issue) { setError(issue.message || "We couldn’t continue. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  };
  const cancelApplication = () => {
    if (submitting.current) return;
    setPendingApplication(null);
    setError("");
  };
  const confirmScholarship = async () => {
    if (!pendingApplication || submitting.current || done) return;
    // Save the same validated details and regional fee that the learner confirmed.
    const { details: clean, course, fees } = pendingApplication;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const application = {
        ...clean, track: course.title, learningMethod: course.scholarshipMethod,
        applicationType: "scholarship", cohortId: COHORT.id, cohortStartDate: COHORT.startDate,
        durationWeeks: course.durationWeeks,
        ...applicationPricingFields(fees),
        scholarshipPaymentLink: `${COHORT.website}/scholarship-payment?application=${applicationId}`,
        fullTuitionPaymentLink: `${COHORT.website}/register?course=${course.id}`,
        status: "Pending", createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "scholarshipApplications", applicationId), application);
      trackEvent("generate_lead", { course_id: course.id, application_type: "scholarship" });
      setPendingApplication(null);
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
    finally { submitting.current = false; setBusy(false); }
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
          <label>WhatsApp number<input name="whatsapp" type="tel" value={form.whatsapp} onChange={change} required maxLength={25} autoComplete="tel" placeholder="Include your country code" /></label>
          <label>City and country<input name="location" value={form.location} onChange={change} required maxLength={180} placeholder="Your city and country" /></label>
          <label>Age range<select name="ageRange" value={form.ageRange} onChange={change} required><option value="">Select your age range</option>{AGE_RANGES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>How did you hear about us?<select name="referral" value={form.referral} onChange={change} required><option value="">Select an option</option>{REFERRALS.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label>Referral code <span className="academy-optional">(optional)</span><input name="referralCode" value={form.referralCode} onChange={change} maxLength={80} /></label>
        <label>{scholarship ? "Why are you applying for a scholarship?" : "What would you like to achieve? (optional)"}<textarea name="reason" value={form.reason} onChange={change} required={scholarship} minLength={scholarship ? 10 : undefined} maxLength={2000} rows={4} /></label>
        {!scholarship && fees && <label className="academy-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>{`I confirm my course and learning format, and understand that full tuition is ${fees.tuition}. I will return after payment to complete registration.`}</span></label>}
        {error && !pendingApplication && <p className="academy-error" role="alert">{error}</p>}
        <button className="academy-button" type="submit" disabled={busy || !course || !fees}>{busy ? "Please wait…" : scholarship ? "Submit Scholarship Application" : `Continue to Payment${fees ? ` · ${fees.tuition}` : ""}`}</button>
        {!scholarship && <p className="academy-form-help">Next, review your details and open your course’s payment page. Your draft stays in this browser for seven days. After payment, return to complete registration. Already paid? <a target="_blank" rel="noopener noreferrer" href="/payment-success">Check payment and complete registration</a>.</p>}
      </form>
      <aside className="academy-registration-summary"><span className="academy-eyebrow">Your learning plan</span><h2>{course?.title || "Your next chapter"}</h2>
        {course ? <><img src={course.image} alt={course.alt} width="1536" height="1024" /><dl><div><dt>Starts</dt><dd>{COHORT.startDateLabel}</dd></div><div><dt>Duration</dt><dd>{course.duration}</dd></div><div><dt>Full tuition</dt><dd>{fees ? fees.tuition : <PricingStatus />}</dd></div>{scholarship && fees && <><div><dt>Scholarship support</dt><dd>{fees.scholarshipPercent}</dd></div><div><dt>You pay if approved</dt><dd>{fees.scholarship} ({fees.studentPaysPercent})</dd></div></>}</dl></> : <p>Pick one of our six courses to see the exact fee, duration, and available class format.</p>}
        <a target="_blank" rel="noopener noreferrer" href={scholarship ? `/register${course ? `?course=${course.id}` : ""}` : `/scholarship${course ? `?course=${course.id}` : ""}`}>{scholarship ? "Prefer full tuition? Register here →" : "Looking for a scholarship? Apply here →"}</a>
      </aside>
    </div>}
    {pendingApplication && <ScholarshipConfirmationDialog course={pendingApplication.course} fees={pendingApplication.fees} busy={busy} error={error} onConfirm={confirmScholarship} onCancel={cancelApplication} />}
    <Footer />
  </main>;
}
