import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminWorkspace from '../components/AdminWorkspace';
import { cohortLink } from '../data/cohort.js';
import useAdminCohort from '../hooks/useAdminCohort';
import { assessmentAdminRequest } from '../lms/assessmentAdminClient.js';
import { assessmentStatusLabels, FINAL_ASSESSMENT } from '../lms/finalAssessment.js';
import './FinalAssessment.css';

function VerifyAccess({ onVerified }) {
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(null);
  useEffect(() => () => current.current?.abort(), []);

  async function verify(event) {
    event.preventDefault();
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError('');
    try {
      if (challenge) {
        await assessmentAdminRequest('verifyCode', { challenge, code }, controller.signal);
        if (!controller.signal.aborted) onVerified();
      } else {
        const result = await assessmentAdminRequest('requestCode', { email }, controller.signal);
        if (!controller.signal.aborted) setChallenge(result.challenge);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className="va-panel">
    <h2>Verify assessment access</h2>
    <p>{challenge ? 'Enter the six-digit code sent to your academy email. It expires in 10 minutes.' : 'Use the academy email authorised to publish assessments and review student results.'}</p>
    <form className="va-admin-form" onSubmit={verify}>
      {challenge
        ? <label>Verification code<input autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} /></label>
        : <label>Academy email<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /></label>}
      {error && <p className="va-alert" role="alert">{error}</p>}
      <div className="va-admin-row">
        <button className="va-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : challenge ? 'Verify access' : 'Email verification code'}</button>
        {challenge && <button className="va-button va-button-secondary" type="button" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setError(''); }}>Request another code</button>}
      </div>
    </form>
  </section>;
}

function CohortResults({ cohort, data, requestedStudent, onRefresh, onFailure }) {
  const [filter, setFilter] = useState(requestedStudent ? 'all' : 'submitted');
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const dialog = useRef(null);
  const operation = useRef(null);
  useEffect(() => () => operation.current?.abort(), []);
  const students = data.students.filter(({ latest }) => filter === 'all' || latest.status === filter);

  async function publish(event) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('questions');
    if (!file?.size) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      if (file.size > 235_000) throw new Error('The assessment file is too large.');
      let bank;
      try { bank = JSON.parse(await file.text()); }
      catch { throw new Error('Choose the valid assessment question bank JSON file.'); }
      await assessmentAdminRequest('publish', { cohortId: cohort.id, bank }, controller.signal);
      if (!controller.signal.aborted) {
        setFeedback(`The assessment is open for ${cohort.label} Virtual Assistant students.`);
        onRefresh();
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure.status === 401) onFailure(failure);
        else setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function review() {
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      await assessmentAdminRequest('review', {
        studentId: decision.student.studentId, attemptId: decision.student.latest.id, decision: decision.status,
      }, controller.signal);
      if (!controller.signal.aborted) {
        dialog.current.close();
        setFeedback(decision.status === 'approved' ? 'Assessment approved for this cohort.' : 'One retake is available to this student.');
        setDecision(null);
        onRefresh();
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure.status === 401) onFailure(failure);
        else setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function confirm(student, status) {
    setError('');
    setFeedback('');
    setDecision({ student, status });
    dialog.current.showModal();
  }

  if (!data.publication) return <section className="va-panel">
    <h2>Publish to {cohort.label}</h2>
    <p>Choose the {FINAL_ASSESSMENT.total}-question Virtual Assistant question bank. Publishing makes the assessment available to enrolled Virtual Assistant students in this cohort.</p>
    <form className="va-admin-form" onSubmit={publish}>
      <label>Question bank (.json)<input name="questions" type="file" accept="application/json,.json" required disabled={busy} /></label>
      {error && <p className="va-alert" role="alert">{error}</p>}
      <button className="va-button" type="submit" disabled={busy}>{busy ? 'Publishing…' : `Publish to ${cohort.label}`}</button>
    </form>
  </section>;

  return <section className="va-panel">
    <div className="va-admin-header">
      <div><h2>{cohort.label} results</h2><p>Virtual Assistant · {data.students.filter(({ latest }) => latest.status === 'submitted').length} awaiting review</p></div>
      <label className="va-admin-filter">Filter by status<select value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="all">All attempts</option>
        {Object.entries(assessmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {feedback && <p role="status">{feedback}</p>}
    {students.length === 0 ? <p>{filter === 'all' ? 'Students will appear once they start an assessment.' : 'No attempts match this status.'}</p>
      : <div className="va-admin-table-wrap" role="region" aria-label="Student assessment results" tabIndex={0}>
        <table className="va-admin-table">
          <thead><tr><th>Student</th><th>Attempt</th><th>Score</th><th>Status</th><th>Review</th></tr></thead>
          <tbody>{students.map((student) => <tr key={student.studentId} className={student.studentId === requestedStudent ? 'va-requested-student' : undefined}>
            <th scope="row"><Link className="va-text-link" to={`${cohortLink('/enrolled-students', cohort.id)}&student=${encodeURIComponent(student.studentId)}`}>{student.name}</Link></th>
            <td>{student.latest.number}</td><td>{student.lastResult ? `${student.lastResult.score}/${student.lastResult.total}` : '—'}</td>
            <td>{assessmentStatusLabels[student.latest.status]}</td>
            <td>{student.latest.status === 'submitted' ? <div className="va-admin-row">
              <button type="button" className="va-button" onClick={() => confirm(student, 'approved')}>Approve</button>
              <button type="button" className="va-button va-button-secondary" onClick={() => confirm(student, 'rejected')}>Reject & allow retake</button>
            </div> : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    <dialog ref={dialog} className="va-dialog" aria-labelledby="va-review-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
      {decision && <>
        <h2 id="va-review-title">{decision.status === 'approved' ? 'Approve this result?' : 'Reject this result and allow a retake?'}</h2>
        <p>{decision.student.name} scored {decision.student.latest.score}/{decision.student.latest.total}.</p>
        <p>{decision.status === 'approved' ? 'Approval permanently locks this assessment for this cohort.' : 'This result will stay in the assessment record. The student can start one new attempt.'}</p>
        {error && <p className="va-alert" role="alert">{error}</p>}
        <div className="va-question-actions">
          <button disabled={busy} className="va-button va-button-secondary" type="button" onClick={() => dialog.current.close()}>Cancel</button>
          <button disabled={busy} className="va-button" type="button" onClick={review}>{busy ? 'Saving…' : decision.status === 'approved' ? 'Approve result' : 'Reject & allow retake'}</button>
        </div>
      </>}
    </dialog>
  </section>;
}

export default function AdminFinalAssessments() {
  const [search, setSearch] = useSearchParams();
  const cohort = useAdminCohort();
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState(null);
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((count) => count + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => assessmentAdminRequest('overview', { cohortId: cohort.selectedId }, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setData({ ...result, cohortId: cohort.selectedId }); setFailure(null); } })
      .catch((error) => { if (!controller.signal.aborted) { setData(null); setFailure(error); } });
    load();
    window.addEventListener('focus', load);
    return () => {
      controller.abort();
      window.removeEventListener('focus', load);
    };
  }, [cohort.selectedId, reload]);

  function selectCohort(id) {
    setSearch({ cohort: id }, { replace: true });
  }

  return <AdminWorkspace cohort={{ ...cohort, setSelectedId: selectCohort }} title="Final assessments" description="Publish the Virtual Assistant assessment by cohort and review student results." cohortDescription="Assessments and results follow your selected cohort.">
    <main className="va-admin-section">
      {failure?.status === 401 ? <VerifyAccess onVerified={refresh} />
        : failure ? <section className="va-panel"><p className="va-alert" role="alert">{failure.message}</p><button className="va-button" type="button" onClick={refresh}>Try again</button></section>
          : data?.cohortId === cohort.selectedId
            ? <CohortResults key={cohort.selectedId} data={data} cohort={cohort.selected} requestedStudent={search.get('student')} onRefresh={refresh} onFailure={setFailure} />
            : <section className="va-panel"><p role="status">Loading final assessments…</p></section>}
    </main>
  </AdminWorkspace>;
}
