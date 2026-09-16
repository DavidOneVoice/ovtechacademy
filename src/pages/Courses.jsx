import { useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import CourseCard from "../components/CourseCard";
import CourseOutline from "../components/CourseOutline";
import courses from "../data/courses";
import { COHORT } from "../data/cohort";
import "./Courses.css";

export default function Courses() {
  const [selectedCourse, setSelectedCourse] = useState(null);
  return <main className="ov-courses-page"><Navbar />
    <section className="ov-courses-hero"><div className="ov-courses-hero-content">
      <span>{COHORT.label} cohort · Starts {COHORT.startDateLabel}</span>
      <h1>Find your direction.<br />Build your skills.</h1>
      <p>Six practical learning paths. Clear course fees, hands-on projects, and a next step you can take with confidence.</p>
      <div className="ov-courses-hero-actions"><a target="_blank" rel="noopener noreferrer" href="#all-courses">Explore Courses</a><a target="_blank" rel="noopener noreferrer" href="/scholarship" className="secondary">Apply for Scholarship</a></div>
    </div></section>
    <section className="ov-courses-intro" id="all-courses"><div className="ov-courses-section-head"><span>All six courses</span><h2>Choose what you want to build next.</h2><p>Fees are shown in Nigerian naira. Scholarship fees and class formats depend on your chosen course.</p></div>
      <div className="ov-courses-grid">{courses.map((course) => <CourseCard key={course.id} course={course} onOutline={setSelectedCourse} />)}</div>
    </section>
    {selectedCourse && <CourseOutline course={selectedCourse} onClose={() => setSelectedCourse(null)} />}
    <Footer />
  </main>;
}
