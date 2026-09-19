import { useEffect, useRef } from "react";

export default function ScholarshipConfirmationDialog({ course, fees, busy, error, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    headingRef.current.focus();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  return <dialog ref={dialogRef} className="academy-course-dialog academy-scholarship-confirmation"
    aria-labelledby="scholarship-confirmation-title" aria-describedby="scholarship-confirmation-message"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={(event) => { if (event.target === dialogRef.current && !busy) onCancel(); }}>
    <div className="academy-dialog-inner" aria-busy={busy}>
      <span className="academy-eyebrow">Before you submit</span>
      <h2 id="scholarship-confirmation-title" ref={headingRef} tabIndex={-1}>Scholarship commitment</h2>
      <p id="scholarship-confirmation-message">If your <strong>{course.title}</strong> application is approved, your scholarship will cover <strong>{fees.scholarshipPercent}</strong> of the full tuition of <strong>{fees.tuition}</strong>.</p>
      <div className="academy-scholarship-commitment-fee"><span>Registration fee if approved</span><strong>{fees.scholarship}</strong><span>The remaining {fees.studentPaysPercent} of tuition</span></div>
      <p>You will need to pay this registration fee to secure your place. Your learning format will be <strong>{course.scholarshipMethod.toLowerCase()}</strong>.</p>
      <p className="academy-scholarship-question">Will you be able to pay <strong>{fees.scholarship}</strong> if your scholarship is approved?</p>
      <p>No payment is taken when you submit this application.</p>
      {error && <p className="academy-error" role="alert">{error}</p>}
      <div className="academy-dialog-actions">
        <button type="button" className="academy-button academy-outline-button" onClick={onCancel} disabled={busy}>No, cancel application</button>
        <button type="button" className="academy-button" onClick={onConfirm} disabled={busy}>{busy ? "Submitting…" : "Yes, submit application"}</button>
      </div>
    </div>
  </dialog>;
}
