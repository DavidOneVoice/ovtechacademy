import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import "./PaymentSuccess.css";

const PaymentSuccess = () => {
  return (
    <main className="payment-success-page">
      <div className="payment-success-card">
        <div className="payment-success-icon">✓</div>

        <h1>Check Your Payment Status</h1>

        <p>
          If you paid through an earlier payment link, please keep your Paystack receipt and reference.
        </p>

        <p>
          This page does not verify a payment. Our admissions team can confirm your earlier payment using its reference. For the October cohort, use the return link provided after the new registration checkout.
        </p>

        <p>
          Once verification is completed, you will receive further information
          regarding onboarding, class schedules, learning resources, and your
          student community access.
        </p>

        <div className="payment-success-note">
          Please keep an eye on your email inbox and WhatsApp number for
          important updates.
        </div>

        <div className="payment-success-actions">
          <Link target="_blank" rel="noopener noreferrer" to="/" className="payment-home-btn">
            Back to Homepage
          </Link>

          <a
            href="https://wa.me/2348130624789"
            target="_blank"
            rel="noreferrer noopener"
            className="payment-whatsapp-btn"
          >
            Chat on WhatsApp
          </a>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default PaymentSuccess;
