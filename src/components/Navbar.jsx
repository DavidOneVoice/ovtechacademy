import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import "./Navbar.css";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
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
        <a href="/">Home</a>
        <a href="/courses">Courses</a>
        <a href="/scholarship">Scholarship</a>
        <a href="/lms">Student Portal</a>
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

            <a href="/" onClick={closeMobileMenu}>
              Home
            </a>

            <a href="/courses" onClick={closeMobileMenu}>
              Courses
            </a>

            <a href="/scholarship" onClick={closeMobileMenu}>
              Scholarship
            </a>

            <a href="/lms" onClick={closeMobileMenu}>
              Student Portal
            </a>

            <a href="/about" onClick={closeMobileMenu}>
              About
            </a>

            <a href="/contact" onClick={closeMobileMenu}>
              Contact
            </a>

            <a
              href="/scholarship"
              className="ov-mobile-cta"
              onClick={closeMobileMenu}
            >
              Apply for Scholarship
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
