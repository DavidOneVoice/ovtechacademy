import "./Footer.css";
import FacebookIcon from "@mui/icons-material/Facebook";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TikTokIcon from "@mui/icons-material/MusicNote";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

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

          <p className="ov-social-title">Follow us online</p>

          <div className="ov-socials">
            <a
              href="https://web.facebook.com/61559488910917/"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>

            <a
              href="https://www.linkedin.com/in/badrudavid/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
            >
              <LinkedInIcon />
            </a>

            <a
              href="https://www.youtube.com/@D-OVTech"
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
            >
              <YouTubeIcon />
            </a>

            <a
              href="https://www.tiktok.com/@onevoicetech"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
            >
              <TikTokIcon />
            </a>
          </div>
        </div>

        <div className="ov-footer-links">
          <h4>Quick Links</h4>
          <a href="/">Home</a>
          <a href="/courses">Courses</a>
          <a href="/scholarship">Scholarship</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </div>

        <div className="ov-footer-links">
          <h4>Programs</h4>
          <a href="/courses">Data Analytics</a>
          <a href="/courses">Front-End Development</a>
          <a href="/courses">Virtual Assistance</a>
          <a href="/courses">Cyber Security</a>
        </div>

        <div className="ov-footer-links">
          <h4>Contact</h4>

          <a href="mailto:onevoicetech2023@gmail.com">
            onevoicetech2023@gmail.com
          </a>

          <a href="tel:+2348130624789">+234 813 062 4789</a>

          <a
            href="https://wa.me/2348130624789"
            target="_blank"
            rel="noreferrer"
            className="ov-footer-whatsapp"
          >
            <WhatsAppIcon fontSize="small" />
            WhatsApp Chat
          </a>
        </div>
      </div>

      <div className="ov-footer-bottom">
        © 2023–2026 OVTech Academy. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
