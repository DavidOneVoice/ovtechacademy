import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import courses from "../data/courses";
import "./Courses.css";

const Courses = () => {
  return (
    <main className="ov-courses-page">
      <Navbar />

      <section className="ov-courses-hero">
        <div className="ov-courses-hero-content">
          <span>OVTech Academy Courses</span>
          <h1>Practical courses for real-world tech opportunities.</h1>
          <p>
            Explore every OVTech Academy learning path from one place. Each
            course is designed around hands-on projects, career readiness, and
            practical skills you can apply immediately.
          </p>
          <div className="ov-courses-hero-actions">
            <a href="#all-courses">Explore Courses</a>
            <a href="/scholarship" className="secondary">
              Apply for Scholarship
            </a>
          </div>
        </div>
      </section>

      <section className="ov-courses-intro" id="all-courses">
        <div className="ov-courses-section-head">
          <span>All Courses</span>
          <h2>Choose a course that matches your next goal.</h2>
          <p>
            From analytics and software skills to cybersecurity and virtual
            assistance, OVTech courses combine clear instruction with practical
            learning outcomes.
          </p>
        </div>

        <div className="ov-courses-grid">
          {courses.map((course) => (
            <article className="ov-courses-card" key={course.id}>
              <div className={`ov-courses-media ${course.imageClass || ""}`}>
                {course.image ? (
                  <img src={course.image} alt={course.alt} />
                ) : (
                  <div className="ov-courses-icon" aria-hidden="true">
                    {course.icon}
                  </div>
                )}
              </div>

              <div className="ov-courses-body">
                <small>{course.label}</small>
                <h3>{course.title}</h3>
                <p>{course.description}</p>

                <div className="ov-courses-meta">
                  <div>
                    <strong>Duration</strong>
                    <span>{course.duration}</span>
                  </div>
                  <div>
                    <strong>Course Fee</strong>
                    <span>{course.tuitionFee}</span>
                  </div>
                  <div>
                    <strong>Scholarship</strong>
                    <span>{course.scholarshipFee}</span>
                  </div>
                </div>

                <div className="ov-courses-actions">
                  <a href="/scholarship">Apply for Scholarship</a>
                  <a
                    href="https://paystack.shop/pay/ovtech-tuition"
                    target="_blank"
                    rel="noreferrer"
                    className="pay"
                  >
                    Pay Full Tuition
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Courses;
