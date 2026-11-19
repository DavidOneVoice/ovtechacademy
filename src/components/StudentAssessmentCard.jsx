import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { portalRequest } from '../lms/portalClient.js';
import { assessmentStatusLabels, FINAL_ASSESSMENT } from '../lms/finalAssessment.js';
import '../pages/FinalAssessment.css';

export default function StudentAssessmentCard({ studentId, cohortId, sidebarSlot, showCard = true }) {
  const [status, setStatus] = useState(null);
  const [problem, setProblem] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => portalRequest('assessmentStatus', {}, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.details?.studentId === studentId && result.details.cohortId === cohortId) setStatus(result);
      else setStatus(null);
      setProblem('');
    }).catch((error) => {
      if (!controller.signal.aborted && error.status !== 401) setProblem(error.message);
    });
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [studentId, cohortId, reload]);

  if (!status && !problem) return null;

  const label = {
    different_enrollment: 'View assessment details',
    in_progress: 'Resume final assessment',
    submitted: 'View assessment result',
    approved: 'View assessment result',
    rejected: 'Retake final assessment',
  }[status?.stage] || 'Take final assessment';

  return <>
    {status && sidebarSlot?.current && createPortal(<Link to={FINAL_ASSESSMENT.path}>Final assessment</Link>, sidebarSlot.current)}
    {showCard && <section className="va-dashboard-card" aria-label="Final assessment">
    <div>
      <h2>Final assessment</h2>
      {status?.lastResult ? <p><strong>{status.lastResult.score}/{status.lastResult.total}</strong> · {assessmentStatusLabels[status.stage]}</p>
        : <p>{FINAL_ASSESSMENT.total} questions · {FINAL_ASSESSMENT.minutes} minutes{status?.stage === 'in_progress' ? ' · In progress' : ''}</p>}
      {problem && <p role="status">{problem}</p>}
    </div>
    {status ? <Link className="va-button" to={FINAL_ASSESSMENT.path}>{label}</Link>
      : <button type="button" className="va-button" onClick={() => setReload((current) => current + 1)}>Check availability</button>}
  </section>}
  </>;
}
