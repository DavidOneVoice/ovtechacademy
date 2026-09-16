import { getCoursePricing } from "../data/pricing";

export default function CourseCard({ course, onOutline }) {
  const fees = getCoursePricing(course.id);
  return <article id={course.id} className="academy-course-card">
    <img className="academy-course-image" src={course.image} alt={course.alt} loading="lazy" width="1536" height="1024" />
    <div className="academy-course-body">
      <span className="academy-eyebrow">{course.label}</span>
      <h3>{course.title}</h3><p>{course.description}</p>
      <dl className="academy-course-facts">
        <div><dt>Duration</dt><dd>{course.duration}</dd></div>
        <div><dt>Full tuition</dt><dd>{fees.tuition}</dd></div>
        <div><dt>With scholarship</dt><dd>{fees.scholarship} <small>({fees.scholarshipPercent} support)</small></dd></div>
      </dl>
      <p className="academy-mode-note">{course.scholarshipRecordedOnly ? "Scholarship: pre-recorded learning. Full tuition also offers one-on-one live classes." : "Live group classes for both scholarship and full-tuition learners."}</p>
      <div className="academy-course-actions">
        <button type="button" className="academy-outline-button" onClick={() => onOutline(course)}>View Course Outline <span aria-hidden="true">↗</span></button>
        <a target="_blank" rel="noopener noreferrer" className="academy-button" href={`/scholarship?course=${course.id}`}>Apply for Scholarship</a>
        <a target="_blank" rel="noopener noreferrer" className="academy-button academy-button-secondary" href={fees.fullTuitionPaymentLink}>Register & Pay Full Tuition</a>
      </div>
    </div>
  </article>;
}
