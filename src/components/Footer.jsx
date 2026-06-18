import "./Footer.css";
import FacebookIcon from "@mui/icons-material/Facebook";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TikTokIcon from "@mui/icons-material/MusicNote";

const Footer = () => {
  return (
    <footer className="ov-footer">
      <div className="ov-footer-top">
        <div className="ov-footer-brand">
          <div className="ov-footer-logo">
            <img src="/ovlogo2.png" alt="OVTech Logo" />
          </div>

          <h3>OVTech Academy</h3>

          <p>
            Practical technology education designed to help learners build
            real-world skills, projects, confidence, and opportunities.
          </p>

          <div className="ov-socials">
            <a
              href="https://web.facebook.com/61559488910917/"
              target="_blank"
              rel="noreferrer"
            >
              <FacebookIcon />
            </a>

            <a
              href="https://www.linkedin.com/in/badrudavid/"
              target="_blank"
              rel="noreferrer"
            >
              <LinkedInIcon />
            </a>

            <a
              href="https://www.youtube.com/@D-OVTech"
              target="_blank"
              rel="noreferrer"
            >
              <YouTubeIcon />
            </a>

            <a
              href="https://www.tiktok.com/@onevoicetech"
              target="_blank"
              rel="noreferrer"
            >
              <TikTokIcon />
            </a>
          </div>
        </div>

        <div className="ov-footer-links">
          <h4>Quick Links</h4>

          <a href="/">Home</a>
          <a href="/#paths">Learning Paths</a>
          <a href="/scholarship">Scholarship</a>
          <a href="/contact">Contact</a>
        </div>

        <div className="ov-footer-links">
          <h4>Programs</h4>

          <a href="/#paths">Data Analytics</a>
          <a href="/#paths">Software Development</a>
          <a href="/#paths">Web Development</a>
        </div>

        <div className="ov-footer-links">
          <h4>Contact</h4>
          <a href="mailto:onevoicetech2023@gmail.com">
            onevoicetech2023@gmail.com
          </a>

          <a href="tel:+2348130624789">+2348130624789</a>
        </div>
      </div>

      <div className="ov-footer-bottom">
        © 2023–2026 OVTech Academy. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
