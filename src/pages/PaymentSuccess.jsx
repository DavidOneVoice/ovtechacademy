import { Link } from "react-router-dom";
import "./PaymentSuccess.css";

const PaymentSuccess = () => {
  return (
    <main className="payment-success-page">
      <div className="payment-success-card">
        <div className="payment-success-icon">✓</div>

        <h1>Payment Submitted Successfully</h1>

        <p>
          Thank you for completing your OVTech Academy registration payment.
        </p>

        <p>
          Your payment details have been received and are currently being
          verified by our admissions team.
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
          <Link to="/" className="payment-home-btn">
            Back to Homepage
          </Link>

          <a
            href="https://wa.me/2348130624789"
            target="_blank"
            rel="noreferrer"
            className="payment-whatsapp-btn"
          >
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
};

export default PaymentSuccess;
