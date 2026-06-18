import { useEffect, useState } from "react";
import NorthIcon from "@mui/icons-material/North";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Footer from "../components/Footer";
import CloseIcon from "@mui/icons-material/Close";
import "./Home.css";

const courseData = [
  {
    id: 1,
    label: "📊 Learning Path 01",
    title: "Data Analytics",
    image: "/ovtimg2.png",
    alt: "Data Analytics Dashboard",
    imageClass: "ov-data-img",
    description:
      "Learn how to clean, analyze, visualize, and present data using tools like Excel, Power BI, SQL, and Python.",
    tools: ["Excel", "Power BI", "SQL", "Python"],
    projects: [
      "Sales Analytics Dashboard",
      "Executive Business Dashboard",
      "Business Insight Report",
      "Portfolio Analytics Project",
    ],
    outline: [
      "Excel Fundamentals",
      "Data Cleaning & Preparation",
      "Formulas, Functions & Pivot Tables",
      "Power BI Dashboard Design",
      "SQL for Data Analysis",
      "Python for Data Analytics",
      "Portfolio Project",
      "Career Preparation",
    ],
  },
  {
    id: 2,
    label: "💻 Learning Path 02",
    title: "Software Development (Frontend)",
    image: "/ovtimg3.png",
    alt: "Frontend App Dashboard",
    imageClass: "ov-dev-img",
    featured: true,
    description:
      "Learn how to build responsive, interactive, and modern web applications using frontend technologies.",
    tools: ["HTML", "CSS", "JavaScript", "React", "Git", "GitHub"],
    projects: [
      "Portfolio Website",
      "Modern React Dashboard",
      "Business Website",
      "Frontend Web Application",
    ],
    outline: [
      "HTML Fundamentals",
      "CSS Styling & Layout",
      "Responsive Design",
      "JavaScript Fundamentals",
      "Git & GitHub",
      "React Development",
      "API Integration",
      "AI-Assisted Development",
      "Deployment & Portfolio Projects",
    ],
  },
  {
    id: 3,
    label: "🌐 Learning Path 03",
    title: "Web Development",
    image: "/ovtimg4.png",
    alt: "Modern Website",
    imageClass: "ov-web-img",
    description:
      "Learn how to plan, design, build, deploy, and manage modern websites for personal, business, and client use.",
    tools: ["HTML", "CSS", "JavaScript", "Hosting", "Domains", "Deployment"],
    projects: [
      "Business Website",
      "Landing Page",
      "Portfolio Website",
      "Client Website Project",
    ],
    outline: [
      "Website Planning",
      "Website Structure",
      "HTML & CSS",
      "Responsive Layouts",
      "JavaScript Basics",
      "Hosting & Domain Setup",
      "Deployment Workflow",
      "Website Optimization",
      "Client Project",
    ],
  },
];

const Home = () => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 700);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="ov-home">
      <nav className="ov-navbar">
        <div className="ov-logo">
          <div className="ov-logo-mark">
            <img
              src="/ovlogo2.png"
              alt="OVTech Logo"
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <div>
            <h3>OVTech</h3>
            <span>One Voice Tech</span>
          </div>
        </div>

        <div className="ov-nav-links">
          <a href="#home">Home</a>
          <a href="#paths">Learning Paths</a>
          <a href="/scholarship">Scholarship</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </div>

        <a href="/scholarship" className="ov-nav-btn">
          Apply for Scholarship
        </a>

        <button
          className="ov-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>

        {mobileMenuOpen && (
          <div className="ov-mobile-menu-overlay">
            <div className="ov-mobile-menu">
              <button
                className="ov-mobile-close"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>

              <a href="#home" onClick={closeMobileMenu}>
                Home
              </a>
              <a href="#paths" onClick={closeMobileMenu}>
                Learning Paths
              </a>
              <a href="#scholarship" onClick={closeMobileMenu}>
                Scholarship
              </a>
              <a href="/about" onClick={closeMobileMenu}>
                About
              </a>
              <a href="/contact" onClick={closeMobileMenu}>
                Contact
              </a>

              <a href="/scholarship" className="ov-mobile-cta">
                Apply for Scholarship
              </a>
            </div>
          </div>
        )}
      </nav>

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
              Master Data Analytics, Software Development (Frontend), and Web
              Development through practical training, real-world projects, and
              hands-on learning.
            </p>

            <div className="ov-hero-actions">
              <a href="/scholarship" className="ov-primary-btn">
                Apply for Scholarship
              </a>

              <a href="#paths" className="ov-secondary-btn">
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
                src="/ovtimg4.png"
                alt="OVTech learning experience"
                className="ov-main-hero-image"
              />

              <div className="ov-floating-card ov-card-analytics">
                📊 Data Analytics
              </div>

              <div className="ov-floating-card ov-card-software">
                💻 Software Development
              </div>

              <div className="ov-floating-card ov-card-web">
                🌐 Web Development
              </div>
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
          {courseData.map((course) => (
            <div
              className={`ov-path-card ${course.featured ? "featured" : ""}`}
              key={course.id}
            >
              <div className={`ov-path-image ${course.imageClass}`}>
                <img
                  src={course.image}
                  alt={course.alt}
                  className="ov-path-img"
                />
              </div>

              <div className="ov-path-body">
                <small>{course.label}</small>
                <h3>{course.title}</h3>

                <p>{course.description}</p>

                <div className="ov-course-meta">
                  <div>
                    <strong>Duration</strong>
                    <span>12 Weeks</span>
                  </div>

                  <div>
                    <strong>Course Fee</strong>
                    <span>₦100,000</span>
                  </div>

                  <div>
                    <strong>Certification</strong>
                    <span>Certificate upon completion</span>
                  </div>
                </div>

                <button
                  className="ov-outline-btn"
                  onClick={() => setSelectedCourse(course)}
                >
                  View Course Outline
                </button>

                <div className="ov-course-actions">
                  <a href="/scholarship" className="ov-course-scholarship">
                    Apply for Scholarship
                  </a>

                  <a
                    href="https://paystack.shop/pay/ovtech-tuition"
                    target="_blank"
                    rel="noreferrer"
                    className="ov-course-pay"
                  >
                    Pay Full Tuition
                  </a>
                </div>
              </div>
            </div>
          ))}
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
            <h3>3</h3>
            <p>Career-Focused Learning Paths</p>
          </div>

          <div>
            <h3>12</h3>
            <p>Weeks of Practical Training</p>
          </div>

          <div>
            <h3>90%</h3>
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
              a: "Each learning path runs for approximately 12 weeks with practical assignments and projects.",
            },
            {
              q: "Will I receive a certificate?",
              a: "Yes. Students who successfully complete their training will receive a certificate of completion.",
            },
            {
              q: "Do you offer scholarships?",
              a: "Yes. OVTech periodically provides scholarship opportunities for qualified applicants.",
            },
            {
              q: "Are classes live or self-paced?",
              a: "Depending on the program, learners may choose live instructor-led sessions or self-paced study options.",
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

      {/* COURSE OUTLINE MODAL */}
      {selectedCourse && (
        <div className="ov-course-modal-overlay">
          <div className="ov-course-modal">
            <button
              className="ov-course-modal-close"
              onClick={() => setSelectedCourse(null)}
            >
              ×
            </button>

            <span>{selectedCourse.label}</span>
            <h2>{selectedCourse.title}</h2>

            <div className="ov-modal-summary">
              <div>
                <strong>Duration</strong>
                <p>12 Weeks</p>
              </div>

              <div>
                <strong>Course Fee</strong>
                <p>₦100,000</p>
              </div>

              <div>
                <strong>Certification</strong>
                <p>Certificate issued upon completion</p>
              </div>
            </div>

            <div className="ov-modal-section">
              <h3>Course Outline</h3>
              <ul>
                {selectedCourse.outline.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="ov-modal-section">
              <h3>Tools You’ll Learn</h3>
              <div className="ov-tool-tags">
                {selectedCourse.tools.map((tool) => (
                  <span key={tool}>{tool}</span>
                ))}
              </div>
            </div>

            <div className="ov-modal-section">
              <h3>Projects You’ll Build</h3>
              <ul>
                {selectedCourse.projects.map((project) => (
                  <li key={project}>{project}</li>
                ))}
              </ul>
            </div>

            <div className="ov-modal-actions">
              <a href="/scholarship" className="ov-course-scholarship">
                Apply for Scholarship
              </a>

              <a
                href="https://paystack.shop/pay/ovtech-tuition"
                target="_blank"
                rel="noreferrer"
                className="ov-course-pay"
              >
                Pay Full Tuition
              </a>
            </div>
          </div>
        </div>
      )}

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
              <h3>90%</h3>
              <p>Scholarship support available for selected applicants</p>
            </div>

            <div>
              <h3>3</h3>
              <p>Career-focused learning paths to choose from</p>
            </div>

            <div>
              <h3>100%</h3>
              <p>Project-based training with practical learning outcomes</p>
            </div>
          </div>

          <a href="/scholarship" className="ov-scholarship-btn">
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
        rel="noreferrer"
        className="ov-whatsapp-float"
      >
        <WhatsAppIcon style={{ fontSize: "2rem", color: "#fff" }} />
      </a>
      <Footer />
    </main>
  );
};

export default Home;
