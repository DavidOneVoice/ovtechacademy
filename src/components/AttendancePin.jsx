import { useState } from 'react';
import { attendanceRequest } from '../attendance/api';
import './AttendancePin.css';
export default function AttendancePin({ studentId, email: initialEmail = '', sessionId }) {
  const [email, setEmail] = useState(initialEmail);
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (challenge && pin !== repeat) { setError('Both PIN entries must match.'); return; }
    setBusy(true);
    try {
      if (!challenge) {
        const response = await attendanceRequest('requestPin', { email, studentId, sessionId });
        setChallenge(response.challenge); setMessage(response.message);
      } else {
        const response = await attendanceRequest('setPin', { challenge, code, pin });
        setMessage(response.message); setChallenge(''); setCode(''); setPin(''); setRepeat('');
      }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <details className="attendance-pin-panel"><summary>Set up or reset your attendance PIN</summary><p>Use a private PIN for live-class attendance. Verify your registered email to create or reset it. Your portal access stays the same.</p><form onSubmit={submit}>
    {!challenge ? <label>Registered email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label> : <><label>Email verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label><label>New attendance PIN<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={10} pattern="[0-9]{6,10}" value={pin} onChange={(event) => setPin(event.target.value)} /></label><label>Confirm attendance PIN<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={10} value={repeat} onChange={(event) => setRepeat(event.target.value)} /></label><small>Use 6–10 digits. Avoid repeated digits or simple sequences.</small></>}
    {message && <p role="status" className="attendance-pin-message">{message}</p>}{error && <p role="alert" className="attendance-pin-error">{error}</p>}
    <button disabled={busy} type="submit">{busy ? 'Please wait…' : challenge ? 'Save attendance PIN' : 'Send verification code'}</button>{challenge && <button type="button" className="attendance-pin-secondary" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setMessage(''); setError(''); }}>Use another email or request a new code</button>}
  </form></details>;
}
