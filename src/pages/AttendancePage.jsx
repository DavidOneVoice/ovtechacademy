import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AttendancePin from '../components/AttendancePin';
import { attendanceRequest } from '../attendance/api';
import './AttendancePage.css';

export default function AttendancePage() {
  const { sessionId } = useParams();
  // Each link has its own verification state, including when navigation stays in the SPA.
  return <AttendanceSession key={sessionId} sessionId={sessionId} />;
}

function AttendanceSession({ sessionId }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef(null);
  const pinInput = useRef(null);
  const setupPanel = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    attendanceRequest('session', { sessionId }, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setSession(result); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [sessionId]);

  const verify = async (event) => {
    event.preventDefault();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(''); setMessage(''); setVerified(null);
    try {
      const result = await attendanceRequest('verify', { sessionId, email, pin }, controller.signal);
      if (!controller.signal.aborted) { setVerified(result); setPin(''); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const mark = async () => {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    try {
      const result = await attendanceRequest('mark', { grant: verified.grant }, controller.signal);
      if (!controller.signal.aborted) {
        setMessage(result.message);
        setVerified((current) => ({ ...current, alreadyMarked: true }));
      }
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure.message); setVerified(null); }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const openPinSetup = () => {
    if (!setupPanel.current) return;
    setupPanel.current.open = true;
    setupPanel.current.querySelector('input')?.focus();
    setupPanel.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const pinSaved = ({ email: savedEmail }) => {
    setEmail(savedEmail); setPin(''); setError('');
    setMessage('Your attendance PIN is ready. Enter it above, then select “Verify my details”.');
    if (setupPanel.current) setupPanel.current.open = false;
    pinInput.current?.focus();
    pinInput.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return <><Navbar /><main className="attendance-page"><section className="attendance-card">
    <span className="attendance-kicker">OVTech Academy · Live class attendance</span>
    <h1>{session?.track || 'Class'} attendance</h1>
    {session && <p className="attendance-copy">{session.cohort} cohort · {session.dateKey}</p>}
    <p className="attendance-copy">Enter your registered email and private attendance PIN to confirm your own details. You can mark attendance once for this class.</p>
    {loading && <p className="attendance-alert" role="status">Loading today’s class…</p>}
    {error && <p className="attendance-alert" role="alert">{error}</p>}
    {message && <p className="attendance-alert" role="status">{message}</p>}
    {!loading && session && <>
      {!verified ? <form className="attendance-form-panel" onSubmit={verify}>
        <label><span>Registered email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <div>
          <label><span>Attendance PIN</span><input ref={pinInput} required type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={pin} onChange={(event) => setPin(event.target.value)} /></label>
          <p className="attendance-pin-help">First time signing attendance, or forgot your PIN? <button type="button" disabled={busy} onClick={openPinSetup}>Create or reset your attendance PIN</button></p>
        </div>
        <button className="attendance-submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify my details'}</button>
      </form> : <div className="attendance-form-panel">
        <div className="attendance-profile"><div><strong>Name</strong><span>{verified.student.fullName}</span></div><div><strong>Course</strong><span>{verified.student.track}</span></div><div><strong>Cohort</strong><span>{verified.student.cohort}</span></div><div><strong>Previous attendance</strong><span>{verified.student.attendedDays} of {verified.student.lectureDays} classes</span></div></div>
        <p>Confirm that these are your details before marking attendance.</p>
        <button className="attendance-submit" disabled={busy || verified.alreadyMarked} onClick={mark}>{verified.alreadyMarked ? 'Attendance recorded' : busy ? 'Recording…' : 'Confirm & mark my attendance'}</button>
        <button type="button" className="attendance-change-student" disabled={busy} onClick={() => { setVerified(null); setMessage(''); setEmail(''); }}>Use another student’s details</button>
      </div>}
      {!verified && <AttendancePin sessionId={sessionId} email={email} panelRef={setupPanel} onSaved={pinSaved} />}
    </>}
    <a target="_blank" rel="noopener noreferrer" href="/lms" className="attendance-login-link">Open student portal ↗</a>
  </section></main><Footer /></>;
}
