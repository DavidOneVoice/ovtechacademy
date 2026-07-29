import { useRef, useState } from "react";
import logo from "../../assets/certificate/OV logo 2.png";
import signature from "../../assets/certificate/my signature.png";
import {
  CERTIFICATE_FOOTER,
  getCourseDuration,
  getCourseSkills,
} from "../../data/certificateConfig";
import "./Certificate.css";

const formatCompletionDate = (value) => {
  const date = value?.toDate
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : value
        ? new Date(value)
        : null;

  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "Processing";
};

export default function Certificate({ profile, studentName, courseName }) {
  const certificateRef = useRef(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const name = profile.displayName || studentName;
  const course = profile.course || profile.track || courseName;
  const certificateId = profile.certificateId || "Pending";
  const verificationUrl = `https://ovtechacademy.com/verify/${encodeURIComponent(certificateId)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&margin=0&data=${encodeURIComponent(verificationUrl)}`;
  const skills = getCourseSkills(course);

  const downloadPdf = () => {
    setIsPreparing(true);
    const previousTitle = document.title;
    document.title = `OVTech-Certificate-${certificateId}`;
    requestAnimationFrame(() => {
      window.print();
      document.title = previousTitle;
      setIsPreparing(false);
    });
  };

  return (
    <div className="certificate-viewer">
      <div className="certificate-toolbar">
        <div><span>Official credential</span><strong>Your digital certificate is ready</strong></div>
        <button type="button" onClick={downloadPdf} disabled={isPreparing}>
          <span aria-hidden="true">↓</span> {isPreparing ? "Preparing…" : "Download PDF"}
        </button>
      </div>
      <div className="certificate-scroll-area">
        <article className="digital-certificate" ref={certificateRef} aria-label={`Certificate of completion for ${name}`}>
          <div className="certificate-corner certificate-corner-top" aria-hidden="true" />
          <div className="certificate-corner certificate-corner-bottom" aria-hidden="true" />
          <header className="digital-certificate-header">
            <img src={logo} alt="OVTech logo" />
            <strong>OVTECH ACADEMY</strong>
            <span>Certificate of Completion</span>
          </header>

          <section className="digital-certificate-body">
            <p>This certifies that</p>
            <h1>{name}</h1>
            <div className="certificate-name-rule" aria-hidden="true" />
            <p>has successfully completed the</p>
            <h2>{course}</h2>
            <p className="certificate-statement">training programme at OVTech Academy and has demonstrated competency in the required learning outcomes.</p>
          </section>

          <dl className="certificate-facts">
            <div><dt>Course / Track</dt><dd>{course}</dd></div>
            <div><dt>Duration</dt><dd>{getCourseDuration(course)}</dd></div>
            <div><dt>Completion Date</dt><dd>{formatCompletionDate(profile.completionDate)}</dd></div>
            <div><dt>Certificate ID</dt><dd>{certificateId}</dd></div>
          </dl>

          <section className="certificate-skills">
            <h3>Skills demonstrated</h3>
            <div>{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          </section>

          <section className="certificate-validation">
            <div className="certificate-signature">
              <img src={signature} alt="Signature of Badru Olumide David" />
              <strong>Badru Olumide David</strong>
              <span>Founder &amp; Academic Director</span>
            </div>
            <div className="certificate-verified-badge">
              <span aria-hidden="true">✓</span>
              <div><small>OVTech</small><strong>Verified Graduate</strong></div>
            </div>
            <div className="certificate-qr">
              <img src={qrCodeUrl} alt={`QR code to verify certificate ${certificateId}`} crossOrigin="anonymous" />
              <span>Scan to verify</span>
            </div>
          </section>

          <footer className="digital-certificate-footer">
            <strong>{CERTIFICATE_FOOTER.division}</strong>
            <span>{CERTIFICATE_FOOTER.registration}</span>
            <span>{CERTIFICATE_FOOTER.website}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
