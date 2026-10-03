import { useEffect, useRef, useState } from "react";
import { portalRequest } from "../lms/portalClient";
import "./AttendancePin.css";

export default function PortalPin({ studentId, email: initialEmail = "", onSaved, open = false }) {
  const [email, setEmail] = useState(initialEmail);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  const submit = async (event) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (challenge && pin !== repeat) { setError("Both PIN entries must match."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      if (!challenge) {
        const response = await portalRequest("requestPin", { studentId, email: email.trim() }, controller.signal);
        if (!controller.signal.aborted) { setChallenge(response.challenge); setMessage(response.message); }
      } else {
        const response = await portalRequest("setPin", { challenge, code, pin }, controller.signal);
        if (!controller.signal.aborted) {
          setChallenge(""); setCode(""); setPin(""); setRepeat(""); setMessage(response.message);
          onSaved?.({ email: email.trim() });
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <details className="attendance-pin-panel portal-pin-panel" open={open || undefined}>
    <summary>Create or reset your student PIN</summary>
    <p>Use the same private PIN for your student portal and live-class attendance. Verify your registered email to create or reset it. After saving, sign in again with your new PIN.</p>
    <form onSubmit={submit}>
      {!challenge ? <label>Registered email<input required type="email" autoComplete="email" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></label> : <>
        <p className="attendance-pin-code-help">Enter the six-digit code sent to your registered email. Check your spam or junk folder too.</p>
        <label>Email verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} /></label>
        <label>New student PIN<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={10} pattern="[0-9]{6,10}" value={pin} disabled={busy} onChange={(event) => setPin(event.target.value)} /></label>
        <label>Confirm student PIN<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={10} pattern="[0-9]{6,10}" value={repeat} disabled={busy} onChange={(event) => setRepeat(event.target.value)} /></label>
        <small>Use 6–10 digits. Avoid repeated digits or simple sequences.</small>
      </>}
      {message && <p role="status" className="attendance-pin-message">{message}</p>}
      {error && <p role="alert" className="attendance-pin-error">{error}</p>}
      <button disabled={busy} type="submit">{busy ? "Please wait…" : challenge ? "Save student PIN" : "Send verification code"}</button>
      {challenge && <button disabled={busy} type="button" className="attendance-pin-secondary" onClick={() => { setChallenge(""); setCode(""); setPin(""); setRepeat(""); setMessage(""); setError(""); }}>Request a new code</button>}
    </form>
  </details>;
}
