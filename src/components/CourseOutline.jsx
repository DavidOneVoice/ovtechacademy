import { useEffect, useRef } from "react";
import { getCoursePricing } from "../data/pricing";
export default function CourseOutline({ course, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; dialog.close(); };
  }, []);
  const fees = getCoursePricing(course.id);
  return <dialog ref={ref} className="academy-course-dialog" aria-labelledby="course-dialog-title" onCancel={onClose} onClick={(event) => { if(event.target === ref.current) onClose(); }}>
    <div className="academy-dialog-inner">
      <button className="academy-dialog-close" aria-label="Close course outline" onClick={onClose}>×</button>
      <span className="academy-eyebrow">{course.duration} · October 5, 2026</span>
      <h2 id="course-dialog-title">{course.title}</h2><p>{course.description}</p>
      <div className="academy-fee-strip"><span>Full tuition <strong>{fees.tuition}</strong></span><span>Scholarship fee <strong>{fees.scholarship}</strong></span></div>
      <h3>What you’ll learn</h3><ol>{course.outline.map((item) => <li key={item}>{item}</li>)}</ol>
      <h3>Tools and skills</h3><div className="academy-tags">{course.tools.map((tool) => <span key={tool}>{tool}</span>)}</div>
      <h3>Projects you’ll build</h3><ul>{course.projects.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="academy-mode-note">{course.scholarshipRecordedOnly ? "Scholarship places include pre-recorded lessons. One-on-one live classes are available with full tuition." : "This course is delivered through live group classes."}</p>
      <div className="academy-dialog-actions"><a target="_blank" rel="noopener noreferrer" className="academy-button" href={`/scholarship?course=${course.id}`}>Apply for Scholarship</a><a target="_blank" rel="noopener noreferrer" className="academy-button academy-button-secondary" href={fees.fullTuitionPaymentLink}>Register & Pay Full Tuition</a></div>
    </div>
  </dialog>;
}
