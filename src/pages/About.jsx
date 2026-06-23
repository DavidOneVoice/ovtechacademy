import "./About.css";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import usePricing from "../hooks/usePricing";

const About = () => {
  const { scholarshipPercent } = usePricing();
  return (
    <main className="about-page">
      <Navbar />

      <section className="about-hero">
        <span>About OVTech Academy</span>
        <h1>Empowering the Next Generation of Digital Talent.</h1>
        <p>
          OVTech Academy exists to help learners gain practical digital skills,
          build real projects, and prepare for meaningful opportunities in tech.
        </p>
      </section>

      <section className="about-story">
        <div>
          <span>Our Story</span>
          <h2>Started in 2023 with a simple mission.</h2>
          <p>
            OVTech Academy began in 2023 from a passion for teaching, mentoring,
            and helping people access practical technology education.
          </p>
          <p>
            Many learners have the desire to grow, but they often lack a clear
            roadmap, proper guidance, and real projects that prepare them for
            today’s digital economy. OVTech was created to bridge that gap.
          </p>
        </div>

        <div className="about-story-card">
          <h3>Our Focus</h3>
          <p>Practical training</p>
          <p>Real-world projects</p>
          <p>Mentorship and career direction</p>
          <p>Scholarship opportunities</p>
        </div>
      </section>

      <section className="about-mission">
        <div>
          <h3>Our Mission</h3>
          <p>
            To equip individuals with practical digital skills that create
            confidence, opportunities, and long-term career growth.
          </p>
        </div>

        <div>
          <h3>Our Vision</h3>
          <p>
            To become one of Africa’s trusted technology learning communities,
            raising skilled professionals who can create impact globally.
          </p>
        </div>
      </section>

      <section className="about-founder">
        <div className="about-founder-image">
          <img src="/founder.jpg" alt="Badru Olumide David" />
        </div>

        <div className="about-founder-content">
          <span>Meet the Founder</span>
          <h2>Badru Olumide David</h2>
          <h4>Frontend Developer • Coding Coach • Digital Skills Trainer</h4>

          <p>
            Behind OVTech Academy is a real passion for helping learners move
            from confusion to clarity. David is a frontend developer, coding
            coach, mentor, and digital skills trainer who enjoys teaching people
            how to build practical solutions with technology.
          </p>

          <p>
            OVTech Academy was created from the belief that many talented people
            only need the right guidance, structure, and encouragement to begin
            building confidently.
          </p>
        </div>
      </section>

      <section className="about-values">
        <div className="about-value-card">
          <h3>Practical Learning</h3>
          <p>Students learn by building, not just by watching.</p>
        </div>

        <div className="about-value-card">
          <h3>Real Projects</h3>
          <p>Every learning path leads to portfolio-ready projects.</p>
        </div>

        <div className="about-value-card">
          <h3>Mentorship</h3>
          <p>Learners get guidance, direction, and support.</p>
        </div>

        <div className="about-value-card">
          <h3>Opportunities</h3>
          <p>We prepare students for jobs, freelance work, and growth.</p>
        </div>
      </section>

      <section className="about-stats">
        <div>
          <h3>2023</h3>
          <p>Founded</p>
        </div>

        <div>
          <h3>3</h3>
          <p>Learning Paths</p>
        </div>

        <div>
          <h3>12</h3>
          <p>Weeks Training</p>
        </div>

        <div>
          <h3>{scholarshipPercent}</h3>
          <p>Scholarship Support</p>
        </div>
      </section>

      <section className="about-cta">
        <h2>Ready to Start Your Tech Journey?</h2>
        <p>
          Choose a learning path, apply for scholarship, and begin building real
          skills with OVTech Academy.
        </p>

        <div>
          <a href="/scholarship">Apply for Scholarship</a>
          <a href="/#paths">Explore Learning Paths</a>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default About;
