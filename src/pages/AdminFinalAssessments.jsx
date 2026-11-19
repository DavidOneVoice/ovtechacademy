import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import AdminWorkspace from '../components/AdminWorkspace';
import { cohortLink } from '../data/cohort.js';
import useAdminCohort from '../hooks/useAdminCohort';
import { assessmentAdminRequest } from '../lms/assessmentAdminClient.js';
import { ANSWER_LETTERS, assessmentStatusLabels, FINAL_ASSESSMENT } from '../lms/finalAssessment.js';
import './FinalAssessment.css';

function QuestionBank({ cohortId, onFailure }) {
  const panel = useRef(null);
  const request = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => () => request.current?.abort(), []);

  async function open() {
    panel.current.showModal();
    if (result || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError('');
    try {
      const bank = await assessmentAdminRequest('questionBank', { cohortId }, controller.signal);
      if (!controller.signal.aborted) setResult(bank.questions);
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure.status === 401) onFailure(failure);
        else setError(failure.message);
      }
    } finally {
      request.current = null;
    }
  }

  return <>
    <button className="va-button va-button-secondary" type="button" onClick={open}>View questions</button>
    <dialog className="va-dialog va-bank-dialog" ref={panel} aria-labelledby="va-bank-title">
      <div className="va-bank-heading"><h2 id="va-bank-title">Virtual Assistant questions</h2>
        <button className="va-button va-button-secondary" type="button" onClick={() => panel.current.close()}>Close</button></div>
      {error ? <p className="va-alert" role="alert">{error}</p> : !result ? <p role="status">Loading questions…</p>
        : <ol className="va-bank-list">{result.map(({ prompt, options, correct }) => <li key={prompt}>
          <strong>{prompt}</strong>
          <ol type="A">{options.map((option, index) => <li key={option}>{option}{ANSWER_LETTERS[index] === correct && <strong> · Correct answer</strong>}</li>)}</ol>
        </li>)}</ol>}
    </dialog>
  </>;
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

  async function publish() {
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      await assessmentAdminRequest('publish', { cohortId: cohort.id }, controller.signal);
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
    <h2>Virtual Assistant final assessment</h2>
    <p>{FINAL_ASSESSMENT.total} questions · {FINAL_ASSESSMENT.minutes} minutes</p>
    <p>Unpublished. Approve the questions to open this exam for Virtual Assistant students in {cohort.label}.</p>
    {error && <p className="va-alert" role="alert">{error}</p>}
    <div className="va-admin-row">
      <button className="va-button" type="button" disabled={busy} onClick={publish}>{busy ? 'Opening…' : `Approve and open for ${cohort.label}`}</button>
      <QuestionBank cohortId={cohort.id} onFailure={onFailure} />
    </div>
  </section>;

  return <section className="va-panel">
    <div className="va-admin-header">
      <div><h2>{cohort.label} results</h2><p>Exam open to this cohort{data.publication.publishedBy === 'initial-deployment' ? ' · Published automatically during setup' : ''}.</p><p>Virtual Assistant · {FINAL_ASSESSMENT.total} questions · {FINAL_ASSESSMENT.minutes} minutes · {data.students.filter(({ latest }) => latest.status === 'submitted').length} awaiting review</p>
        <QuestionBank cohortId={cohort.id} onFailure={onFailure} /></div>
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
  const location = useLocation();
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

  if (failure?.status === 401) return <Navigate to="/admin-login" replace state={{ returnTo: location.pathname + location.search }} />;

  return <AdminWorkspace cohort={{ ...cohort, setSelectedId: selectCohort }} title="Final assessments" description="Manage the Virtual Assistant assessment and review student results." cohortDescription="Assessments and results follow your selected cohort.">
    <main className="va-admin-section">
      {failure ? <section className="va-panel"><p className="va-alert" role="alert">{failure.message}</p><button className="va-button" type="button" onClick={refresh}>Try again</button></section>
          : data?.cohortId === cohort.selectedId
            ? <CohortResults key={cohort.selectedId} data={data} cohort={cohort.selected} requestedStudent={search.get('student')} onRefresh={refresh} onFailure={setFailure} />
            : <section className="va-panel"><p role="status">Loading final assessments…</p></section>}
    </main>
  </AdminWorkspace>;
}
