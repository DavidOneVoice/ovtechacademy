import "./Home.css";

const Home = () => {
  return (
    <main className="ov-home">
      {/* NAVBAR */}
      <nav className="ov-navbar">
        <div className="ov-logo">
          {/* Replace this with your actual logo image later */}
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
          <a href="#scholarship">Scholarship</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>

        <a href="/scholarship" className="ov-nav-btn">
          Apply for Scholarship
        </a>
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
          <div className="ov-path-card">
            <div className="ov-path-image ov-data-img">
              <img
                src="/ovtimg2.png"
                alt="Data Analytics Dashboard"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <div className="ov-path-body">
              <small>📊 Learning Path 01</small>
              <h3>Data Analytics</h3>
              <p>
                Learn how to clean, analyze, visualize, and present data using
                tools like Excel, Power BI, SQL, and Python.
              </p>

              <ul>
                <li>Excel & Data Cleaning</li>
                <li>Power BI Dashboards</li>
                <li>SQL & Python Basics</li>
                <li>Portfolio Projects</li>
              </ul>
            </div>
          </div>

          <div className="ov-path-card featured">
            <div className="ov-path-image ov-dev-img">
              <img
                src="/ovtimg3.png"
                alt="Frontend App Dashboard"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <div className="ov-path-body">
              <small>💻 Learning Path 02</small>
              <h3>
                Software Development <span>(Frontend)</span>
              </h3>
              <p>
                Learn how to build responsive, interactive, and modern web
                applications using frontend technologies.
              </p>

              <ul>
                <li>HTML, CSS & JavaScript</li>
                <li>Git & GitHub</li>
                <li>React Development</li>
                <li>AI-Assisted Development</li>
              </ul>
            </div>
          </div>

          <div className="ov-path-card">
            <div className="ov-path-image ov-web-img">
              <img
                src="/ovtimg4.png"
                alt="Modern Website"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <div className="ov-path-body">
              <small>🌐 Learning Path 03</small>
              <h3>Web Development</h3>
              <p>
                Learn how to plan, design, build, deploy, and manage modern
                websites for personal, business, and client use.
              </p>

              <ul>
                <li>Website Structure</li>
                <li>Responsive Layouts</li>
                <li>Hosting & Domains</li>
                <li>Deployment Workflow</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
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
    </main>
  );
};

export default Home;
