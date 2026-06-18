// src/pages/Scholarship.jsx
import { useState } from "react";
import "./Scholarship.css";
import { db } from "../src/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import emailjs from "@emailjs/browser";
import Footer from "../components/Footer";
const Scholarship = () => {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    whatsapp: "",
    location: "",
    ageRange: "",
    learningMethod: "",
    track: "",
    reason: "",
    referral: "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const phoneRegex = /^(07|08|09)\d{9}$/;

    if (!phoneRegex.test(formData.whatsapp)) {
      setShowError(true);
      return;
    }

    setShowModal(true);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const confirmSubmit = async () => {
    try {
      setIsSubmitting(true);

      await addDoc(collection(db, "scholarshipApplications"), {
        ...formData,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          email: formData.email,
          to_name: formData.fullName,

          subjectTitle: "Your OVTech Scholarship Application Has Been Received",

          mainMessage:
            "Thank you for applying for the OVTech Scholarship Program. Your application has been received successfully and is now under review by our admissions team.",

          extraMessage:
            "If shortlisted, our team will contact you through your email address or WhatsApp number with the next steps.",

          ctaText: "",
          ctaLink: "",
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );

      setShowModal(false);
      setShowSuccess(true);

      setFormData({
        fullName: "",
        email: "",
        whatsapp: "",
        location: "",
        ageRange: "",
        learningMethod: "",
        track: "",
        reason: "",
        referral: "",
      });
    } catch (error) {
      console.log(error);
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="sch-page">
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
          <a href="#about">About</a>
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

              <a href="#home" onClick={closeMobileMenu}>
                Home
              </a>
              <a href="#paths" onClick={closeMobileMenu}>
                Learning Paths
              </a>
              <a href="#scholarship" onClick={closeMobileMenu}>
                Scholarship
              </a>
              <a href="/#about" onClick={closeMobileMenu}>
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
      <section className="sch-hero">
        <span>OVTech Scholarship Application</span>

        <h1>Take the First Step Toward Your Tech Journey.</h1>

        <p>
          Complete the form below to apply for an OVTech scholarship. Selected
          applicants will receive support toward their training fee.
        </p>
      </section>

      <form className="sch-form" onSubmit={handleSubmit}>
        <div className="sch-grid">
          <label>
            Full Name
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
            />
          </label>

          <label>
            Email Address
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
            />
          </label>

          <label>
            WhatsApp Number
            <input
              type="tel"
              name="whatsapp"
              required
              value={formData.whatsapp}
              onChange={(e) => {
                const numbersOnly = e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 11);

                setFormData((prev) => ({
                  ...prev,
                  whatsapp: numbersOnly,
                }));
              }}
              minLength={11}
              maxLength={11}
              pattern="[0-9]{11}"
              inputMode="numeric"
              placeholder="Example: 08012345678"
              title="Enter exactly 11 digits, starting with 07, 08, or 09"
            />
          </label>

          <label>
            Location
            <input
              type="text"
              name="location"
              required
              value={formData.location}
              onChange={handleChange}
              placeholder="City, State, Country"
            />
          </label>

          <label>
            Age Range
            <select
              name="ageRange"
              required
              value={formData.ageRange}
              onChange={handleChange}
            >
              <option value="" disabled>
                Select age range
              </option>
              <option value="Below 18">Below 18</option>
              <option value="18 - 24">18 - 24</option>
              <option value="25 - 34">25 - 34</option>
              <option value="35 - 44">35 - 44</option>
              <option value="45+">45+</option>
            </select>
          </label>

          <label>
            Preferred Learning Method
            <select
              name="learningMethod"
              required
              value={formData.learningMethod}
              onChange={handleChange}
            >
              <option value="" disabled>
                Select learning method
              </option>
              <option value="Live Online Classes">Live Online Classes</option>
              <option value="Self-Paced Pre-recorded Videos">
                Self-Paced Pre-recorded Videos
              </option>
            </select>
          </label>
        </div>

        <div className="sch-radio-group">
          <p>Preferred Track</p>

          <label>
            <input
              type="radio"
              name="track"
              required
              value="Data Analytics"
              checked={formData.track === "Data Analytics"}
              onChange={handleChange}
            />
            Data Analytics
          </label>

          <label>
            <input
              type="radio"
              name="track"
              value="Software Development (Frontend)"
              checked={formData.track === "Software Development (Frontend)"}
              onChange={handleChange}
            />
            Software Development (Frontend)
          </label>

          <label>
            <input
              type="radio"
              name="track"
              value="Web Development"
              checked={formData.track === "Web Development"}
              onChange={handleChange}
            />
            Web Development
          </label>
        </div>

        <label className="sch-full">
          Why do you want this scholarship?
          <textarea
            name="reason"
            required
            value={formData.reason}
            onChange={handleChange}
            placeholder="Tell us briefly why you are applying"
          ></textarea>
        </label>

        <label className="sch-full">
          How did you hear about OVTech?
          <select
            name="referral"
            required
            value={formData.referral}
            onChange={handleChange}
          >
            <option value="" disabled>
              Select an option
            </option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Friend / Referral">Friend / Referral</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <button type="submit" className="sch-submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </button>
      </form>

      {showModal && (
        <div className="sch-modal-overlay">
          <div className="sch-modal">
            <h2>Scholarship Commitment</h2>
            <p>
              Selected applicants will receive a 90% scholarship. This means you
              will only be required to pay the remaining 10%, which is ₦10,000,
              as a registration fee to secure your slot.
            </p>

            <p>
              Are you willing and able to pay this amount if your scholarship
              application is approved?
            </p>

            <div className="sch-modal-actions">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="sch-cancel"
                disabled={isSubmitting}
              >
                No, Cancel
              </button>

              <button
                type="button"
                onClick={confirmSubmit}
                className="sch-confirm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Yes, I Understand & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSuccess && (
        <div className="sch-modal-overlay">
          <div className="sch-success-modal">
            <div className="sch-success-icon">✓</div>

            <h2>Application Received</h2>

            <p>
              Thank you for applying for the OVTech Scholarship Program. Your
              application has been received successfully and is now under
              review.
            </p>

            <p>
              If shortlisted, our admissions team will contact you through your
              email address or WhatsApp number with the next steps.
            </p>

            <button
              onClick={() => {
                setShowSuccess(false);
                navigate("/");
              }}
              className="sch-success-btn"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      )}
      {showError && (
        <div className="sch-modal-overlay">
          <div className="sch-error-modal">
            <div className="sch-error-icon">!</div>

            <h2>Invalid Submission</h2>

            <p>Please check your form details and try again.</p>

            <p>
              Your WhatsApp number must be exactly 11 digits and should start
              with 07, 08, or 09.
            </p>

            <button
              onClick={() => {
                setShowError(false);
                setShowModal(false);
              }}
              className="sch-error-btn"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      <Footer />
    </main>
  );
};

export default Scholarship;
