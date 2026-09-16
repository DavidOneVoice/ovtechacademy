import { useEffect, useState } from "react";
import NorthIcon from "@mui/icons-material/North";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import courses from "../data/courses";
import CourseCard from "../components/CourseCard";
import CourseOutline from "../components/CourseOutline";
import { COHORT } from "../data/cohort";
import "./Home.css";

const featuredCourses = courses
  .filter((course) => course.featured)
  .sort((a, b) => a.featuredOrder - b.featuredOrder)
  .slice(0, 3);

const Home = () => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);


  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 700);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="ov-home">
      <Navbar />
      {/* HERO SECTION */}
      <section className="ov-hero" id="home">
        <div className="ov-hero-bg ov-hero-bg-gold"></div>
        <div className="ov-hero-bg ov-hero-bg-navy"></div>

        <div className="ov-hero-content">
          <div className="ov-hero-left">
            <div className="ov-badge">
              🚀 Practical Tech Training for Real-World Opportunities
            </div>

            <h1>
              Build Skills. <br />
              Create Projects. <br />
              <span>Unlock Opportunities.</span>
            </h1>

            <p>
              Explore Data Analytics, Software Development, Web Development, Cybersecurity, Virtual Assistant, and AI Automation. Learn practical skills and turn them into projects you can show.
            </p>

            <div className="ov-hero-actions">
              <a target="_blank" rel="noopener noreferrer" href="/scholarship" className="ov-primary-btn">
                Apply for Scholarship
              </a>

              <a target="_blank" rel="noopener noreferrer" href="#paths" className="ov-secondary-btn">
                Explore Learning Paths
              </a>
            </div>

            <div className="ov-trust-list">
              <span>✓ Project-Based Learning</span>
              <span>✓ Beginner Friendly</span>
              <span>✓ Live & Self-Paced Options</span>
            </div>
          </div>

          <div className="ov-hero-right">
            <div className="ov-hero-visual">
              <img
                src="/images/hero.webp"
                alt="A learner and mentor working together on a practical technology project"
                width="1536" height="1024" fetchPriority="high"
                className="ov-main-hero-image"
              />

              <div className="ov-hero-caption">Six learning paths. One place to begin.</div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY OVTECH EXISTS */}
      <section className="ov-why" id="about">
        <div className="ov-why-container">
          <div className="ov-section-label">Why OVTech Exists</div>

          <h2>
            Talent is everywhere. <br />
            <span>Opportunity should be too.</span>
          </h2>

          <p>
            Many people want better careers, remote opportunities, and valuable
            digital skills, but they often lack a clear path, practical
            guidance, and real projects that prepare them for the real world.
          </p>

          <p>
            OVTech was created to bridge that gap by helping learners gain
            practical skills, build confidence, and create projects they can
            proudly showcase.
          </p>

          <div className="ov-why-grid">
            <div>
              <strong>01</strong>
              <h3>Clear Roadmaps</h3>
              <p>
                Learn with a structured path from beginner level to real
                projects.
              </p>
            </div>

            <div>
              <strong>02</strong>
              <h3>Practical Training</h3>
              <p>
                Focus on what you can actually build, not just what you can
                memorize.
              </p>
            </div>

            <div>
              <strong>03</strong>
              <h3>Career Direction</h3>
              <p>
                Prepare for jobs, remote opportunities, freelancing, or personal
                projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LEARNING PATHS */}
      <section className="ov-paths" id="paths">
        <div className="ov-section-head">
          <span>Learning Paths</span>
          <h2>Choose Your Path. Start Building.</h2>
          <p>
            OVTech gives you clear, practical learning tracks designed to help
            you build real skills and real projects.
          </p>
        </div>

        <div className="ov-paths-grid">
          {featuredCourses.map((course) => <CourseCard key={course.id} course={course} onOutline={setSelectedCourse} />)}
        </div>

        <div className="ov-view-all-wrap">
          <a target="_blank" rel="noopener noreferrer" href="/courses" className="ov-view-all-btn">
            View All Courses
          </a>
        </div>
      </section>

      <section className="ov-cohort-banner">
        <div className="ov-cohort-content">
          <span>{COHORT.label} Cohort · Starts {COHORT.startDateLabel}</span>

          <h2>
            Your next chapter
            <br />
            starts October 5.
          </h2>

          <p>
            Applications are open for all six learning paths. Choose your course, explore scholarship support, and start building practical skills with us.
          </p>

          <div className="ov-cohort-actions">
            <a target="_blank" rel="noopener noreferrer" href="/scholarship" className="ov-primary-btn">
              Apply For Scholarship
            </a>

            <a target="_blank" rel="noopener noreferrer"
              href="/register"
              className="ov-secondary-btn"
            >
              Register & Pay Full Tuition
            </a>
          </div>
        </div>

        <div className="ov-cohort-image">
          <a href="/images/october-cohort.webp" target="_blank" rel="noreferrer noopener" aria-label="Open the October cohort poster"><img src="/images/october-cohort.webp" alt="OVTech Academy October 2026 cohort. Starts October 5, 2026. Six courses and limited scholarships. Apply at ovtechacademy.com." loading="lazy" width="1024" height="1536" /></a>
        </div>
      </section>

      {/* WHAT MAKES OVTECH DIFFERENT */}
      <section className="ov-advantages">
        <div className="ov-section-head">
          <span>Why OVTech?</span>

          <h2>What Makes OVTech Different?</h2>

          <p>
            We designed OVTech Academy to help learners move beyond theory and
            gain practical skills, real-world experience, and career confidence.
          </p>
        </div>

        <div className="ov-advantages-grid">
          <div className="ov-adv-card">
            <div className="ov-adv-icon">🚀</div>
            <h3>Project-Based Learning</h3>
            <p>
              Build real-world projects from day one and create a portfolio you
              can proudly showcase.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">👨‍🏫</div>
            <h3>Industry Mentorship</h3>
            <p>
              Learn directly from professionals actively working in the
              technology industry.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">💼</div>
            <h3>Career Guidance</h3>
            <p>
              Get support with portfolio building, CV improvement, and career
              preparation.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🎓</div>
            <h3>Scholarship Opportunities</h3>
            <p>
              Access periodic scholarship opportunities designed to support
              serious learners.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🎥</div>
            <h3>Class Recordings</h3>
            <p>
              Never miss a lesson. Access recordings to learn at your own pace.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🌍</div>
            <h3>Learn From Anywhere</h3>
            <p>
              Join classes from any location with flexible online learning
              options.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🤝</div>
            <h3>Community Support</h3>
            <p>
              Learn together with like-minded individuals pursuing similar
              goals.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🏅</div>
            <h3>Certification</h3>
            <p>
              Receive a certificate upon successful completion of your training.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🛠️</div>
            <h3>Practical Assignments</h3>
            <p>Reinforce every lesson with hands-on exercises and projects.</p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">📈</div>
            <h3>Growth-Focused Curriculum</h3>
            <p>
              Learn modern tools and technologies currently used in the
              industry.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">⚡</div>
            <h3>Fast-Track Learning</h3>
            <p>
              Follow a structured roadmap designed to accelerate your progress.
            </p>
          </div>

          <div className="ov-adv-card">
            <div className="ov-adv-icon">🌟</div>
            <h3>Portfolio Development</h3>
            <p>
              Graduate with projects that demonstrate your capabilities to
              employers and clients.
            </p>
          </div>
        </div>
      </section>

      {/* STATISTICS SECTION */}
      <section className="ov-stats-section">
        <div className="ov-stats-wrapper">
          <div>
            <h3>{courses.length}</h3>
            <p>Career-Focused Learning Paths</p>
          </div>

          <div>
            <h3>Up to 96%</h3>
            <p>Scholarship Support Available</p>
          </div>

          <div>
            <h3>100%</h3>
            <p>Project-Based Learning</p>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="ov-faq-section">
        <div className="ov-section-head">
          <span>FAQ</span>

          <h2>Frequently Asked Questions</h2>

          <p>
            Answers to some of the most common questions prospective students
            ask.
          </p>
        </div>

        <div className="ov-faq-accordion">
          {[
            {
              q: "Do I need prior experience?",
              a: "No. Our programs are beginner-friendly and designed to guide learners from the fundamentals to practical projects.",
            },
            {
              q: "How long is each course?",
              a: "Data Analytics, Cybersecurity, and AI Automation run for 12 weeks. Web Development and Software Development run for 20 weeks. Virtual Assistant runs for 8 weeks.",
            },
            {
              q: "Will I receive a certificate?",
              a: "Yes. Students who successfully complete their training will receive a certificate of completion.",
            },
            {
              q: "Do you offer scholarships?",
              a: "Yes. Selected applicants pay ₦20,000 for Data Analytics, Cybersecurity, Web Development, Software Development, or AI Automation, and ₦15,000 for Virtual Assistant. This represents 90%–96% scholarship support, depending on the course.",
            },
            {
              q: "Are classes live or self-paced?",
              a: "Scholarships for Data Analytics, Web Development, and Software Development cover pre-recorded learning only. Full-tuition learners in those courses may choose one-on-one live classes or pre-recorded learning. Cybersecurity, Virtual Assistant, and AI Automation use live group classes.",
            },
            {
              q: "When does the next cohort start?",
              a: "The October 2026 cohort starts on October 5, 2026. Applications are open now.",
            },
            {
              q: "How do I register with full tuition?",
              a: "Choose a course and complete your details, pay securely through Paystack, then return to finish registration. We verify your payment before your final submission becomes available.",
            },
            {
              q: "How are classes conducted?",
              a: "Classes are conducted online, allowing students to learn from anywhere with an internet connection.",
            },
          ].map((item, index) => (
            <div
              className={`ov-faq-item ${openFaq === index ? "active" : ""}`}
              key={item.q}
            >
              <button
                type="button"
                className="ov-faq-question"
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <span>{item.q}</span>
                <strong>{openFaq === index ? "−" : "+"}</strong>
              </button>

              {openFaq === index && (
                <div className="ov-faq-answer">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {selectedCourse && <CourseOutline course={selectedCourse} onClose={() => setSelectedCourse(null)} />}

      {/* WHAT YOU'LL BUILD */}
      <section className="ov-build">
        <div className="ov-build-header">
          <span>Real Projects</span>

          <h2>
            Don't Just Learn.
            <br />
            Build.
          </h2>

          <p>
            Every learning path includes practical projects designed to help you
            apply your skills and create a portfolio you can proudly showcase.
          </p>
        </div>

        <div className="ov-project-grid">
          <div className="ov-project-card">
            <div className="ov-project-image">
              <img
                src="/ovtimg2.png"
                alt="Business Analytics Dashboard"
                className="ov-project-img"
              />
            </div>

            <div className="ov-project-content">
              <h3>Executive Business Dashboard</h3>
              <p>
                Create interactive dashboards that help businesses make
                data-driven decisions.
              </p>
            </div>
          </div>

          <div className="ov-project-card">
            <div className="ov-project-image">
              <img
                src="/ovtimg3.png"
                alt="Modern React Application"
                className="ov-project-img"
              />
            </div>

            <div className="ov-project-content">
              <h3>Modern React Dashboard</h3>
              <p>
                Build responsive and interactive applications using modern
                frontend technologies.
              </p>
            </div>
          </div>

          <div className="ov-project-card">
            <div className="ov-project-image">
              <img
                src="/portfolio-website.png"
                alt="Professional Portfolio Website"
                className="ov-project-img"
              />
            </div>

            <div className="ov-project-content">
              <h3>Professional Portfolio Website</h3>

              <p>
                Create a modern portfolio that showcases your skills, projects,
                achievements, and professional brand to potential employers and
                clients.
              </p>
            </div>
          </div>

          <div className="ov-project-card">
            <div className="ov-project-image">
              <img
                src="/gvadminpage.png"
                alt="School Management Platform"
                className="ov-project-img"
              />
            </div>

            <div className="ov-project-content">
              <h3>School Management Platform</h3>
              <p>Learn how real-world applications are structured and built.</p>
            </div>
          </div>

          <div className="ov-project-card">
            <div className="ov-project-image">
              <img
                src="/ecommerce-website.png"
                alt="E-commerce Website"
                className="ov-project-img"
              />
            </div>

            <div className="ov-project-content">
              <h3>E-commerce Website</h3>
              <p>
                Build modern online shopping experiences with professional UI.
              </p>
            </div>
          </div>

          <div className="ov-project-card">
            <div className="ov-project-image">
              <img
                src="/business-website.png"
                alt="Business Website"
                className="ov-project-img"
              />
            </div>

            <div className="ov-project-content">
              <h3>Business Website</h3>
              <p>
                Create professional websites suitable for businesses and
                clients.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SCHOLARSHIP SECTION */}
      <section className="ov-scholarship" id="scholarship">
        <div className="ov-scholarship-content">
          <span>Scholarship Opportunity</span>

          <h2>Apply for an OVTech Scholarship</h2>

          <p>
            We are opening scholarship opportunities for serious learners who
            want to gain practical tech skills, build real projects, and prepare
            for better career opportunities.
          </p>

          <div className="ov-scholarship-box">
            <div>
              <h3>Up to 96%</h3>
              <p>Scholarship support available for selected applicants</p>
            </div>

            <div>
              <h3>{courses.length}</h3>
              <p>Career-focused learning paths to choose from</p>
            </div>

            <div>
              <h3>100%</h3>
              <p>Project-based training with practical learning outcomes</p>
            </div>
          </div>

          <a target="_blank" rel="noopener noreferrer" href="/scholarship" className="ov-scholarship-btn">
            Apply for Scholarship
          </a>
        </div>
      </section>
      {showBackToTop && (
        <button className="ov-back-top" onClick={scrollToTop}>
          <NorthIcon style={{ fontSize: "2rem", color: "#fff" }} />
        </button>
      )}

      <a
        href="https://wa.me/2348130624789"
        target="_blank"
        rel="noreferrer noopener"
        className="ov-whatsapp-float"
      >
        <WhatsAppIcon style={{ fontSize: "2rem", color: "#fff" }} />
      </a>
      <Footer />
    </main>
  );
};

export default Home;
