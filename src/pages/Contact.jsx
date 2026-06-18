import "./Contact.css";
import NorthIcon from "@mui/icons-material/North";
import { useState, useEffect } from "react";
import emailjs from "@emailjs/browser";
import Footer from "../components/Footer";

const Contact = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    whatsapp: "",
    message: "",
  });

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

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();

    try {
      setSending(true);
      setSuccess(false);
      setError(false);

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          email: "onevoicetech2023@gmail.com",
          to_name: "OVTech Admin",
          subjectTitle: "New Contact Message From OVTech Website",
          mainMessage: `New message received from OVTech Academy contact page.

Name: ${formData.fullName}
Email: ${formData.email}
WhatsApp: ${formData.whatsapp}`,
          extraMessage: `Message:
${formData.message}`,
          ctaText: "Reply Email",
          ctaLink: formData.email,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );

      setSuccess(true);

      setFormData({
        fullName: "",
        email: "",
        whatsapp: "",
        message: "",
      });
    } catch (err) {
      console.log(err);
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="contact-page">
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
          <a href="/#paths">Learning Paths</a>
          <a href="/#scholarship">Scholarship</a>
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
                ×
              </button>

              <a href="/" onClick={closeMobileMenu}>
                Home
              </a>
              <a href="/#paths" onClick={closeMobileMenu}>
                Learning Paths
              </a>
              <a href="/#scholarship" onClick={closeMobileMenu}>
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

      <section className="contact-hero">
        <div className="contact-left">
          <span>Contact OVTech Academy</span>

          <h1>
            Let's Help You Begin Your
            <br />
            Tech Journey.
          </h1>

          <p>
            Whether you're applying for a scholarship, enrolling directly, or
            simply have questions, we're here to help.
          </p>

          <div className="contact-cards">
            <div className="contact-card">
              <h3>Email</h3>
              <p>onevoicetech@gmail.com</p>
            </div>

            <div className="contact-card">
              <h3>WhatsApp</h3>
              <p>+234 813 062 4789</p>
            </div>

            <div className="contact-card">
              <h3>Office Hours</h3>
              <p>Monday - Friday</p>
              <p>9:00 AM - 5:00 PM</p>
            </div>
          </div>
        </div>

        <div className="contact-right">
          <div className="contact-image">
            <img
              src="/contact-illustration.png"
              alt="OVTech Support Team"
              className="contact-image"
            />
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="contact-form-card">
          <h2>Send Us a Message</h2>

          {success && (
            <div className="contact-success">
              Your message has been sent successfully. We’ll get back to you
              soon.
            </div>
          )}

          {error && (
            <div className="contact-error">
              Something went wrong. Please try again.
            </div>
          )}

          <form onSubmit={handleContactSubmit}>
            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              required
              value={formData.fullName}
              onChange={handleChange}
            />

            <input
              type="email"
              name="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={handleChange}
            />

            <input
              type="tel"
              name="whatsapp"
              placeholder="WhatsApp Number"
              required
              value={formData.whatsapp}
              onChange={handleChange}
            />

            <textarea
              name="message"
              rows="6"
              placeholder="How can we help you?"
              required
              value={formData.message}
              onChange={handleChange}
            ></textarea>

            <button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </section>

      <section className="contact-cta">
        <h2>Need Immediate Assistance?</h2>

        <p>Chat directly with our admissions team on WhatsApp.</p>

        <a href="https://wa.me/2348130624789" target="_blank" rel="noreferrer">
          Chat With Us On WhatsApp
        </a>
      </section>

      {showBackToTop && (
        <button className="ov-back-top" onClick={scrollToTop}>
          <NorthIcon style={{ fontSize: "2rem", color: "#fff" }} />
        </button>
      )}
      <Footer />
    </main>
  );
};

export default Contact;
