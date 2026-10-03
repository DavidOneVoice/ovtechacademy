import { useEffect, useRef, useState } from "react";
import { cohortLabel } from "../data/cohort";
import { normalizeProgrammeName } from "../data/programmes";
import { portalRequest } from "../lms/portalClient";
import { resolvePortalLogin } from "../lms/portalLoginFlow";
import PortalPin from "./PortalPin";

export default function PortalLogin({ onSignedIn, initialIdentifier = "", initialMessage = "", initialError = "", restoring = false }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [choices, setChoices] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(initialMessage);
  const [resetOpen, setResetOpen] = useState(false);
  const request = useRef(null);
  const pinInput = useRef(null);
  const selected = choices.find((choice) => choice.id === selectedId);
  const pinRequired = selected?.pinRequired === true;
  const disabled = busy || restoring;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (pinRequired) pinInput.current?.focus(); }, [pinRequired]);

  const submit = async (event) => {
    event.preventDefault();
    if (!identifier.trim()) { setError("Enter your registered email or WhatsApp/phone number."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await resolvePortalLogin({ identifier, enrollments: choices, selectedId, pin },
        (action, data) => portalRequest(action, data, controller.signal));
      if (!controller.signal.aborted) {
        if (response.stage === "authenticated") {
          setPin(""); onSignedIn(response.session);
        } else {
          setChoices(response.enrollments); setSelectedId(response.selectedId);
          if (response.stage === "enrollment") setMessage("Choose the course and cohort you want to open.");
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure.enrollments) setChoices(failure.enrollments);
        if (failure.studentId) setSelectedId(failure.studentId);
        if (String(failure.code || "").toLowerCase().includes("pin_required") && failure.studentId) {
          setChoices((previous) => previous.map((choice) => choice.id === failure.studentId ? { ...choice, pinRequired: true } : choice));
        }
        setPin(""); setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const changeIdentifier = (event) => {
    request.current?.abort();
    setIdentifier(event.target.value); setChoices([]); setSelectedId(""); setPin("");
    setError(""); setMessage(""); setResetOpen(false); setBusy(false);
  };

  return <div className="lms-login-card">
    <span>Student Portal</span>
    <h1>Welcome back to OVTech Academy</h1>
    <p>Enter the email address or WhatsApp/phone number used for enrollment. If you have created a student PIN, use it to sign in.</p>
    <form onSubmit={submit}>
      <label>Email or WhatsApp/phone number<input type="text" autoComplete="username" aria-describedby="portal-contact-help" required value={identifier} disabled={disabled} onChange={changeIdentifier} /><small id="portal-contact-help">Use your number as registered. For an international number, include its country code, such as +234 or +256.</small></label>
      {choices.length > 1 && <label>Your enrollment<select required value={selectedId} disabled={disabled} onChange={(event) => { setSelectedId(event.target.value); setPin(""); setError(""); setResetOpen(false); }}>
        <option value="">Choose a course and cohort</option>
        {choices.map((choice) => <option key={choice.id} value={choice.id}>{normalizeProgrammeName(choice.track)} · {cohortLabel(choice.cohortId || "july-2026")}</option>)}
      </select></label>}
      {pinRequired && <label>Student PIN<input ref={pinInput} type="password" inputMode="numeric" autoComplete="current-password" required pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={pin} disabled={disabled} onChange={(event) => setPin(event.target.value)} /></label>}
      {restoring && <p className="portal-message" role="status">Checking your saved session…</p>}
      {message && <p className="portal-message" role="status">{message}</p>}
      {error && <p className="lms-error" role="alert">{error}</p>}
      <button type="submit" disabled={disabled}>{busy ? "Checking…" : selected ? "Sign in" : "Continue"}</button>
      {pinRequired && <button type="button" className="portal-text-button" disabled={disabled} onClick={() => setResetOpen((value) => !value)}>Forgot your PIN?</button>}
    </form>
    {resetOpen && <PortalPin key={`${selectedId}:${identifier}`} studentId={selectedId} email={identifier.includes("@") ? identifier.trim() : ""} open onSaved={() => {
      setPin(""); setResetOpen(false); setMessage("Your PIN is saved. Enter your new PIN above to sign in.");
    }} />}
    <div className="lms-login-support"><strong>Need help?</strong><span>You can sign in using either your registered email or phone number. After entering, open My profile to correct your details.</span></div>
  </div>;
}
