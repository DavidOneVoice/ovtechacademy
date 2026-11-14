import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cohortLink, recordCohortId } from '../data/cohort.js';
import { assessmentAdminRequest } from '../lms/assessmentAdminClient.js';
import { assessmentStatusLabels, FINAL_ASSESSMENT_ADMIN_PATH } from '../lms/finalAssessment.js';
import '../pages/FinalAssessment.css';

export default function AssessmentReviewSummary({ student, compact = false }) {
  const { id } = student;
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const link = `${cohortLink(FINAL_ASSESSMENT_ADMIN_PATH, recordCohortId(student))}&student=${encodeURIComponent(id)}`;

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => assessmentAdminRequest('studentResult', { studentId: id }, controller.signal)
      .then((value) => { if (!controller.signal.aborted) { setResult(value); setFailure(null); } })
      .catch((error) => { if (!controller.signal.aborted) { setResult(null); setFailure(error); } });
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [id]);

  const score = result?.lastResult;
  let status = 'Loading…';
  if (failure) status = failure.status === 401 ? 'Sign in again to view the score.' : failure.message;
  if (result) status = result.stage === 'unavailable' ? 'Assessment unpublished' : result.stage === 'ready' ? 'Awaiting first attempt' : assessmentStatusLabels[result.stage];
  return <section className="va-admin-summary" aria-label="Final assessment result">
    <h3>Final assessment</h3>
    <p>{score && <><strong>{score.score}/{score.total}</strong> · </>}{status}</p>
    {(!compact || failure?.status === 401) && <Link to={link}>Open assessment review</Link>}
  </section>;
}
