import { useEffect, useRef, useState } from 'react';
import { attendanceRequest } from '../attendance/api';
import './AttendancePin.css';

export default function AttendancePin({ studentId, email: initialEmail = '', sessionId, panelRef, onSaved }) {
  // Follow the attendance form's address until this setup form is edited or a code is requested.
  const [emailOverride, setEmailOverride] = useState(null);
  const email = emailOverride ?? initialEmail;
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const request = useRef(null);

  useEffect(() => () => request.current?.abort(), []);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (challenge && pin !== repeat) { setError('Both PIN entries must match.'); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      if (!challenge) {
        const requestedEmail = email.trim();
        setEmailOverride(requestedEmail);
        const response = await attendanceRequest('requestPin', { email: requestedEmail, studentId, sessionId }, controller.signal);
        if (!controller.signal.aborted) { setChallenge(response.challenge); setMessage(response.message); }
      } else {
        const response = await attendanceRequest('setPin', { challenge, code, pin }, controller.signal);
        if (!controller.signal.aborted) {
          setMessage(response.message); setChallenge(''); setCode(''); setPin(''); setRepeat('');
          onSaved?.({ email });
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <details ref={panelRef} className="attendance-pin-panel">
    <summary>Set up or reset your attendance PIN</summary>
    <p>First, send a verification code to your registered email. Then enter that code and choose a private PIN with 6–10 digits. Your portal access stays the same.</p>
    <form onSubmit={submit}>
      {!challenge ? <label>Registered email<input required type="email" autoComplete="email" disabled={busy} value={email} onChange={(event) => setEmailOverride(event.target.value)} /></label> : <>
        <p className="attendance-pin-code-help">Check your registered email for the six-digit verification code, including your spam or junk folder.</p>
        <label>Email verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} disabled={busy} value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <label>New attendance PIN<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={10} pattern="[0-9]{6,10}" disabled={busy} value={pin} onChange={(event) => setPin(event.target.value)} /></label>
        <label>Confirm attendance PIN<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={10} disabled={busy} value={repeat} onChange={(event) => setRepeat(event.target.value)} /></label>
        <small>Use 6–10 digits. Avoid repeated digits or simple sequences.</small>
      </>}
      {message && <p role="status" className="attendance-pin-message">{message}</p>}
      {error && <p role="alert" className="attendance-pin-error">{error}</p>}
      <button disabled={busy} type="submit">{busy ? 'Please wait…' : challenge ? 'Save attendance PIN' : 'Send verification code'}</button>
      {challenge && <button type="button" className="attendance-pin-secondary" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setPin(''); setRepeat(''); setMessage(''); setError(''); }}>Use another email or request a new code</button>}
    </form>
  </details>;
}
