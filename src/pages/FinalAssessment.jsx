import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalRequest } from '../lms/portalClient.js';
import { ANSWER_LETTERS, assessmentStatusLabels, FINAL_ASSESSMENT } from '../lms/finalAssessment.js';
import './FinalAssessment.css';

const remainingSeconds = (deadline, clock) => Math.max(0, Math.ceil((deadline - clock.server - (Date.now() - clock.local)) / 1000));
const countdown = (seconds) => [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, '0')).join(':');

function EnrollmentDetails({ details }) {
  return <dl className="va-enrollment">
    <div><dt>Student</dt><dd>{details.name}</dd></div>
    <div><dt>Course</dt><dd>{details.course}</dd></div>
    <div><dt>Cohort</dt><dd>{details.cohort}</dd></div>
  </dl>;
}

function AssessmentAttempt({ state, onFinished, onReload }) {
  const { details, latest, questions, serverNow } = state;
  const [answers, setAnswers] = useState(state.answers);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [seconds, setSeconds] = useState(() => remainingSeconds(latest.deadline, { local: Date.now(), server: serverNow }));
  const [sync, setSync] = useState('saved');
  const [issue, setIssue] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const clock = useRef(null);
  const pending = useRef({});
  const inFlight = useRef(null);
  const submitRunning = useRef(false);
  const nextRetry = useRef(0);
  const requests = useRef(null);
  const dialog = useRef(null);
  const questionHeading = useRef(null);
  const focusQuestion = useRef(false);
  const question = questions[questionIndex];
  const missing = questions.map((_, index) => index + 1).filter((number) => answers[number] === undefined);
  const answered = questions.length - missing.length;

  async function saveAnswers() {
    const signal = requests.current?.signal;
    if (!signal || signal.aborted || inFlight.current || submitRunning.current || !Object.keys(pending.current).length) return;
    const batch = pending.current;
    pending.current = {};
    inFlight.current = batch;
    setSync('saving');
    let saved = false;
    try {
      const response = await portalRequest('assessmentSave', { attemptId: latest.id, answers: batch }, signal);
      if (signal.aborted) return;
      if (response.latest.status !== 'in_progress') onFinished(response.latest);
      else {
        saved = true;
        setSync('saved');
        if (!submitRunning.current) setIssue(null);
      }
    } catch (error) {
      pending.current = { ...batch, ...pending.current };
      if (!signal.aborted && !submitRunning.current) {
        nextRetry.current = Date.now() + 5000;
        setSync('unsaved');
        setIssue(error.status === 401 || error.status === 409 ? error : null);
      }
    } finally {
      inFlight.current = null;
      if (saved) void saveAnswers();
    }
  }

  async function submit(atDeadline = false) {
    const signal = requests.current?.signal;
    if (!signal || signal.aborted || submitRunning.current) return;
    const outstanding = { ...inFlight.current, ...pending.current };
    submitRunning.current = true;
    setSubmitting(true);
    setIssue(null);
    try {
      const result = await portalRequest('assessmentSubmit', { attemptId: latest.id, answers: outstanding, atDeadline }, signal);
      if (signal.aborted) return;
      if (result.latest.status !== 'in_progress') onFinished(result.latest);
      else {
        clock.current = { local: Date.now(), server: result.serverNow };
        setSeconds(remainingSeconds(latest.deadline, clock.current));
      }
    } catch (error) {
      if (!signal.aborted) setIssue(error);
    } finally {
      submitRunning.current = false;
      if (!signal.aborted) {
        setSubmitting(false);
        if (Object.keys(pending.current).length) setSync('unsaved');
      }
    }
  }

  const syncClock = useEffectEvent(() => {
    const time = Date.now();
    const left = remainingSeconds(latest.deadline, clock.current);
    setSeconds(left);
    if (time < nextRetry.current || submitRunning.current || issue?.status === 401 || issue?.status === 409) return;
    if (!left) {
      nextRetry.current = time + 6000;
      dialog.current?.close();
      void submit(true);
    } else if (sync === 'unsaved') {
      nextRetry.current = time + 5000;
      void saveAnswers();
    }
  });

  const connectionRestored = useEffectEvent(() => {
    syncClock();
    if (remainingSeconds(latest.deadline, clock.current)) void saveAnswers();
  });

  useEffect(() => {
    const controller = new AbortController();
    requests.current = controller;
    clock.current = { local: Date.now(), server: serverNow };
    const tick = () => syncClock();
    const connected = () => connectionRestored();
    const warnUnsaved = (event) => {
      if (!inFlight.current && !Object.keys(pending.current).length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const timer = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', connected);
    window.addEventListener('beforeunload', warnUnsaved);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', connected);
      window.removeEventListener('beforeunload', warnUnsaved);
    };
  }, [serverNow]);

  useEffect(() => {
    if (focusQuestion.current) questionHeading.current?.focus({ preventScroll: true });
  }, [questionIndex]);

  function goTo(index) {
    focusQuestion.current = true;
    if (index === questionIndex) questionHeading.current?.focus({ preventScroll: true });
    setQuestionIndex(index);
    if (window.innerWidth <= 850) questionHeading.current?.closest('.va-question')?.scrollIntoView({ block: 'start' });
  }

  function select(option) {
    const number = questionIndex + 1;
    pending.current[number] = option;
    setAnswers((previous) => ({ ...previous, [number]: option }));
    void saveAnswers();
  }

  return <>
    <header className="va-exam-bar">
      <div><h1>Final assessment</h1><p>{details.name} · {details.course} · {details.cohort}</p></div>
      <div className={`va-timer${seconds <= 300 ? ' va-timer-warning' : ''}`}>
        <span>Time remaining</span><strong role="timer" aria-live="off">{countdown(seconds)}</strong>
      </div>
    </header>
    <p className="va-visually-hidden" role="status">{seconds > 300 ? '' : seconds > 60 ? 'Five minutes or less remaining.' : seconds ? 'One minute or less remaining.' : 'Time is up.'}</p>
    {issue && <p className="va-alert" role="alert">{issue.message}{issue.status === 401 ? <> <Link to="/lms">Sign in again</Link></> : issue.status === 409 ? <> <button type="button" className="va-text-link" onClick={onReload}>Reload assessment</button></> : null}</p>}
    <div className="va-exam-grid">
      <section className="va-panel va-question" aria-label={`Question ${questionIndex + 1} of ${questions.length}`}>
        <div className="va-question-meta">
          <span>Question {questionIndex + 1} of {questions.length}</span>
          <span className="va-save-status" role="status">{sync === 'saving' ? 'Saving…' : sync === 'unsaved' ? 'Changes waiting to save' : 'Answers saved'}</span>
        </div>
        {sync === 'unsaved' && seconds > 0 && !issue && <p className="va-alert" role="status">Check your connection. <button type="button" className="va-text-link" onClick={saveAnswers}>Retry save</button></p>}
        <h2 tabIndex={-1} ref={questionHeading}>{question.prompt}</h2>
        <fieldset className="va-options" disabled={!seconds || submitting || issue?.status === 401 || issue?.status === 409}>
          <legend className="va-visually-hidden">Choose one answer</legend>
          {question.options.map((option, index) => <label className="va-option" key={index}>
            <input type="radio" name={`question-${questionIndex}`} checked={answers[questionIndex + 1] === index} onChange={() => select(index)} />
            <span className="va-option-letter" aria-hidden="true">{ANSWER_LETTERS[index]}</span><span>{option}</span>
          </label>)}
        </fieldset>
        <div className="va-question-actions">
          <button type="button" className="va-button va-button-secondary" disabled={questionIndex === 0} onClick={() => goTo(questionIndex - 1)}>Previous</button>
          {questionIndex < questions.length - 1
            ? <button type="button" className="va-button" onClick={() => goTo(questionIndex + 1)}>Next question</button>
            : <button type="button" className="va-button" disabled={!seconds || submitting} onClick={() => dialog.current.showModal()}>Review submission</button>}
        </div>
      </section>
      <aside className="va-panel va-navigation" aria-label="Question navigator">
        <div className="va-nav-heading"><h2>Questions</h2><strong>{answered}/{questions.length} answered</strong></div>
        <progress value={answered} max={questions.length} aria-label="Questions answered" />
        <div className="va-legend"><span><i className="va-legend-answered" />Answered</span><span><i />Unanswered</span></div>
        <div className="va-question-numbers">
          {questions.map((_, index) => <button key={index} type="button" data-answered={answers[index + 1] !== undefined}
            aria-label={`Question ${index + 1}, ${answers[index + 1] === undefined ? 'unanswered' : 'answered'}`} aria-current={index === questionIndex ? 'true' : undefined}
            onClick={() => goTo(index)}>{index + 1}</button>)}
        </div>
        <button type="button" className="va-button va-submit" disabled={submitting || issue?.status === 401 || issue?.status === 409}
          onClick={() => seconds ? dialog.current.showModal() : void submit(true)}>{submitting ? 'Submitting…' : seconds ? 'Submit assessment' : 'Check submission'}</button>
        {!seconds && <p role="status">Time is up. Your saved answers are being graded.</p>}
      </aside>
    </div>
    <dialog className="va-dialog" ref={dialog} aria-labelledby="va-submit-title" onCancel={(event) => { if (submitting) event.preventDefault(); }}>
      <h2 id="va-submit-title">Submit your assessment?</h2>
      <p>{missing.length ? `${missing.length} ${missing.length === 1 ? 'question is' : 'questions are'} unanswered. Select a number to return to that question, or submit as is.` : `You answered all ${questions.length} questions. Your score will be available immediately after you submit.`}</p>
      {missing.length > 0 && <div className="va-question-numbers va-missing-numbers" aria-label="Unanswered questions">
        {missing.map((number) => <button key={number} type="button" aria-label={`Return to question ${number}`} onClick={() => { dialog.current.close(); goTo(number - 1); }}>{number}</button>)}
      </div>}
      {issue && <p className="va-alert" role="alert">{issue.message}</p>}
      <div className="va-question-actions">
        <button type="button" className="va-button va-button-secondary" disabled={submitting} onClick={() => dialog.current.close()}>Keep working</button>
        <button type="button" className="va-button" disabled={submitting || !seconds || issue?.status === 401 || issue?.status === 409} onClick={() => void submit()}>{submitting ? 'Submitting…' : 'Submit now'}</button>
      </div>
    </dialog>
  </>;
}

export default function FinalAssessment() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);
  const request = useRef(null);
  const startDialog = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    portalRequest('assessmentStatus', { includeQuestions: true }, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setState(result); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure); });
    return () => controller.abort();
  }, [reload]);

  function reloadAssessment() {
    setState(null);
    setError(null);
    setReload((value) => value + 1);
  }

  async function start() {
    if (starting || request.current.signal.aborted) return;
    const signal = request.current.signal;
    setStarting(true);
    setError(null);
    try {
      const result = await portalRequest('assessmentStart', {
        studentId: state.details.studentId,
        cohortId: state.details.cohortId,
        previousAttemptId: state.latest?.id || null,
      }, signal);
      if (!signal.aborted) {
        startDialog.current.close();
        setState(result);
      }
    } catch (failure) {
      if (!signal.aborted) setError(failure);
    } finally {
      if (!signal.aborted) setStarting(false);
    }
  }

  function finished(latest) {
    setState((previous) => ({ details: previous.details, stage: latest.status, latest, lastResult: latest }));
    window.scrollTo(0, 0);
  }

  const details = state?.details;
  const canStart = ['ready', 'rejected'].includes(state?.stage);
  const result = state?.lastResult;
  return <main className="va-page">
    <div className="va-shell">
      <nav className="va-top" aria-label="Student portal navigation">
        {state?.stage === 'in_progress'
          ? <div className="va-brand"><img src="/ovlogo2.png" alt="" /><span>OVTech Academy</span></div>
          : <Link className="va-brand" to="/lms"><img src="/ovlogo2.png" alt="" /><span>OVTech Academy</span></Link>}
        {state?.stage !== 'in_progress' && <Link className="va-top-link" to="/lms">Back to dashboard</Link>}
      </nav>
      {state?.stage === 'in_progress' ? <AssessmentAttempt key={state.latest.id} state={state} onFinished={finished} onReload={reloadAssessment} /> : <>
        <header className="va-hero"><h1>{FINAL_ASSESSMENT.course} final assessment</h1>{details && <EnrollmentDetails details={details} />}</header>
        {!state && !error && <section className="va-panel"><p role="status">Opening assessment…</p></section>}
        {error && <section className="va-panel" role="alert"><p>{error.message}</p>{error.status === 401
          ? <Link className="va-button" to="/lms">Sign in to the student portal</Link>
          : <button type="button" className="va-button va-button-secondary" onClick={reloadAssessment}>Reload assessment</button>}</section>}
        {state?.stage === 'unavailable' && <section className="va-panel"><h2>Assessment unavailable</h2><p>This assessment opens when the academy publishes it for your Virtual Assistant cohort.</p></section>}
        {state?.stage === 'different_enrollment' && <section className="va-panel"><h2>Assessment already linked</h2><p>Sign in to the enrollment where you first started this assessment for this cohort.</p></section>}
        {state?.stage === 'verify_pin' && <section className="va-panel"><h2>Set up your student PIN</h2><p>Create your PIN in My profile and sign in again before starting the assessment.</p><Link className="va-button" to="/lms?panel=profile">Open my profile</Link></section>}
        {result && <section className="va-panel va-result" aria-live="polite">
          <div><span className="va-pill">{assessmentStatusLabels[state.stage]}</span><h2>Your assessment result</h2>
            <p>{state.stage === 'approved' ? 'Your result is approved and the assessment is closed for this cohort.'
              : state.stage === 'rejected' ? 'The academy has opened another attempt for you.'
                : 'Your score is ready. The academy will review your result.'}</p>
            {result.submission === 'time_expired' && <p>Submitted automatically when time expired.</p>}
          </div>
          <div className="va-result-score"><strong>{result.score}<small>/{result.total}</small></strong><span>{result.answered} of {result.total} answered</span><span>Attempt {result.number}</span></div>
        </section>}
        {canStart && <section className="va-panel va-instructions">
          <div><h2>{state.stage === 'rejected' ? 'Before your retake' : 'Before you begin'}</h2>
            <ul>
              <li>There are {details.total} multiple-choice questions. Select one answer per question.</li>
              <li>You have {details.minutes} minutes. The timer starts when you confirm and continues if you leave or refresh.</li>
              <li>Answers save as you go. Use the question numbers to jump ahead or revisit unanswered questions.</li>
              <li>Submit when you finish. At zero, your saved answers are automatically submitted and graded.</li>
              <li>Your result locks further attempts for this cohort unless the academy authorises a retake.</li>
            </ul>
          </div>
          <button type="button" className="va-button" onClick={() => startDialog.current.showModal()}>{state.stage === 'rejected' ? 'Start retake' : 'Start assessment'}</button>
          <dialog className="va-dialog" ref={startDialog} aria-labelledby="va-start-title" onCancel={(event) => { if (starting) event.preventDefault(); }}>
            <h2 id="va-start-title">Start your {details.minutes}-minute timer?</h2><p>Your time begins as soon as you confirm.</p>
            {error && <p className="va-alert" role="alert">{error.message}</p>}
            <div className="va-question-actions"><button type="button" disabled={starting} className="va-button va-button-secondary" onClick={() => startDialog.current.close()}>Go back</button><button type="button" disabled={starting} className="va-button" onClick={start}>{starting ? 'Opening…' : 'Start now'}</button></div>
          </dialog>
        </section>}
      </>}
    </div>
  </main>;
}
