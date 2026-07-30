import { forwardRef } from "react";
import logo from "../../assets/certificate/OV logo 2.png";
import signature from "../../assets/certificate/my signature.png";
import { CERTIFICATE_FOOTER, getCourseDuration } from "../../data/certificateConfig";
import CertificateQrCode from "./CertificateQrCode";

const formatCompletionDate = (value) => {
  const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "Processing";
};

const nameClass = (name) => name.length > 52 ? "certificate-name certificate-name-long" : name.length > 34 ? "certificate-name certificate-name-medium" : "certificate-name";

const CertificateCanvas = forwardRef(function CertificateCanvas({ name, course, certificateId, completionDate, verificationUrl, skills }, ref) {
  return (
    <article className="digital-certificate" ref={ref} aria-label={`Certificate of completion for ${name}`}>
      <div className="certificate-corner certificate-corner-top" aria-hidden="true" />
      <div className="certificate-corner certificate-corner-bottom" aria-hidden="true" />
      <header className="digital-certificate-header">
        <img src={logo} alt="OVTech Academy logo" />
        <strong>OVTECH ACADEMY</strong><span>Certificate of Completion</span>
      </header>
      <section className="digital-certificate-body">
        <p>This certifies that</p><h1 className={nameClass(name)}>{name}</h1>
        <div className="certificate-name-rule" aria-hidden="true" />
        <p>has successfully completed the</p><h2>{course}</h2>
        <p className="certificate-statement">training programme at OVTech Academy and has demonstrated competency in the required learning outcomes.</p>
      </section>
      <dl className="certificate-facts">
        <div><dt>Course / Track</dt><dd>{course}</dd></div><div><dt>Duration</dt><dd>{getCourseDuration(course)}</dd></div>
        <div><dt>Completion Date</dt><dd>{formatCompletionDate(completionDate)}</dd></div><div><dt>Certificate ID</dt><dd>{certificateId}</dd></div>
      </dl>
      <section className="certificate-skills"><h3>Skills demonstrated</h3><div>{skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
      <section className="certificate-validation">
        <div className="certificate-signature"><img src={signature} alt="Signature of Badru Olumide David" /><strong>Badru Olumide David</strong><span>Founder &amp; Academic Director</span></div>
        <div className="certificate-verified-badge"><span aria-hidden="true">✓</span><div><small>OVTech</small><strong>Verified Graduate</strong></div></div>
        <div className="certificate-qr"><CertificateQrCode value={verificationUrl} label={`QR code to verify certificate ${certificateId}`} /><span>Scan to verify</span></div>
      </section>
      <footer className="digital-certificate-footer"><strong>{CERTIFICATE_FOOTER.division}</strong><span>{CERTIFICATE_FOOTER.registration}</span><span>{CERTIFICATE_FOOTER.website}</span></footer>
    </article>
  );
});

export default CertificateCanvas;
