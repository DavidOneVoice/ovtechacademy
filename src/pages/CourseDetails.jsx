import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PricingStatus from '../components/PricingStatus';
import { findCourse } from '../data/courses';
import { COHORT } from '../data/cohort';
import usePricing from '../hooks/usePricing';
import './CourseDetails.css';
import { courseGuidance, courseQuestions } from '../data/courseGuidance';
import { findGuide } from '../data/guides';
import { trackEvent } from '../analytics/events';

export default function CourseDetails() {
  const { courseId } = useParams();
  const course = findCourse(courseId);
  const fees = usePricing(course?.id);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (course) trackEvent('view_course', { course_id: course.id });
  }, [course]);
  if (!course) return <main className="ov-course-detail"><Navbar /><section className="course-not-found"><h1>That course could not be found.</h1><p>Choose a learning path from our current course catalogue.</p><a href="/courses" target="_blank" rel="noopener noreferrer" className="academy-button">Explore courses</a></section><Footer /></main>;
  const guidance = courseGuidance[course.id];
  const guide = findGuide(guidance.guide);
  return <main className="ov-course-detail"><Navbar />
    <section className="course-detail-hero">
      <div className="course-detail-intro"><a className="course-back-link" href="/courses" target="_blank" rel="noopener noreferrer">← All courses</a><span className="academy-eyebrow">{COHORT.label} cohort · {course.duration}</span><h1>{course.title}</h1><p>{course.description}</p><div className="course-detail-tools">{course.tools.map((tool) => <span key={tool}>{tool}</span>)}</div><p className="course-start"><span />Classes start {COHORT.startDateLabel}</p></div>
      <img src={course.image} alt={course.alt} width="1536" height="1024" />
    </section>
    <div className="course-detail-layout"><div className="course-detail-content">
      <section className="course-audience"><span className="academy-eyebrow">Who this course is for</span><h2>Start with a practical goal.</h2><p>{guidance.audience}</p><div className="course-preparation"><h3>Prepare for the practical work</h3><p>{guidance.preparation}</p></div>{guide && <a className="course-guide-link" href={`/guides/${guide.slug}`} target="_blank" rel="noopener noreferrer">{guide.title} →</a>}</section>
      <section><span className="academy-eyebrow">The learning experience</span><h2>Build skills you can put to work.</h2><p>Learn through structured lessons and practical projects, then bring your work together in a portfolio you can share.</p><div className="course-format-grid"><article><h3>Scholarship learning</h3><p>{course.scholarshipRecordedOnly ? 'Self-paced, pre-recorded lessons. Scholarship places cover this format.' : 'Live online group classes with other learners.'}</p></article><article><h3>Full-tuition learning</h3><p>{course.scholarshipRecordedOnly ? 'Choose self-paced, pre-recorded lessons or one-on-one live classes.' : 'Live online group classes with other learners.'}</p></article></div></section>
      <section><span className="academy-eyebrow">Course curriculum</span><h2>What you’ll learn.</h2><ol className="course-curriculum">{course.outline.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol></section>
      <section><span className="academy-eyebrow">Put it into practice</span><h2>Projects you’ll build.</h2><div className="course-project-grid">{course.projects.map((item, index) => <article key={item}><span>Project {String(index + 1).padStart(2, '0')}</span><h3>{item}</h3></article>)}</div></section>
      <section className="course-faq"><h2>Questions about this course</h2>{courseQuestions(course).map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
      <section className="course-next-step"><h2>A clear next step.</h2><p>Choose a scholarship application or full-tuition registration. Your chosen course will already be selected in the form.</p></section>
    </div><aside className="course-enrolment-card"><span className="academy-eyebrow">Your place starts here</span><h2>Join the {COHORT.label} cohort.</h2><dl><div><dt>Duration</dt><dd>{course.duration}</dd></div><div><dt>Starts</dt><dd>{COHORT.startDateLabel}</dd></div><div><dt>Full tuition</dt><dd>{fees ? fees.tuition : <PricingStatus />}</dd></div><div><dt>Scholarship fee</dt><dd>{fees?.scholarship || '—'}</dd></div></dl>{fees && <p className="course-support">{fees.scholarshipPercent} scholarship support · You pay {fees.studentPaysPercent} if selected.</p>}<a className="academy-button" href={`/scholarship?course=${course.id}`} target="_blank" rel="noopener noreferrer">Apply for scholarship ↗</a><a className="academy-outline-button" href={`/register?course=${course.id}`} target="_blank" rel="noopener noreferrer">Register with full tuition ↗</a><p className="course-enrolment-note">Scholarship payment is required only after your application is approved.</p><a href="/contact" target="_blank" rel="noopener noreferrer">Have a question? Talk to admissions ↗</a></aside></div>
    <Footer />
  </main>;
}
