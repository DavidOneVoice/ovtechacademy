import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import VerificationLayout from "./verification/VerificationLayout";
import VerificationStatus from "./verification/VerificationStatus";
import { formatPublicCertificateDate } from "../utils/formatPublicCertificateDate";
import { getPublicCertificate, normalizeCertificateId } from "../services/publicCertificates";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const [result, setResult] = useState({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setResult({ kind: "loading" });
    getPublicCertificate(certificateId).then((next) => active && setResult(next)).catch((error) => {
      if (import.meta.env.DEV) console.error("Certificate verification failed", error);
      if (active) setResult({ kind: "error" });
    });
    return () => { active = false; };
  }, [certificateId]);

  const certificate = result.certificate;
  const details = certificate ? [
    ["Certificate holder", certificate.studentName],
    ["Course / Track", certificate.courseOrTrack],
    ["Completion date", formatPublicCertificateDate(certificate.completionDate)],
    ["Certificate ID", normalizeCertificateId(certificate.certificateId)],
    ["Issued by", certificate.issuerName || "OVTech Academy"],
    ["Registration number", certificate.registrationNumber || "9664153"],
  ].filter(([, value]) => value) : [];

  return <VerificationLayout>
    {result.kind !== "verified" ? <VerificationStatus status={result.kind} /> : <section className="verification-card verified">
      <div className="verified-icon" aria-hidden="true">✓</div>
      <p className="eyebrow">OVTech Verified Graduate</p><h1>Certificate Verified</h1>
      <p>This certificate was issued by OVTech Academy and matches an official certificate record.</p>
      <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="issuer"><strong>OVTech Academy</strong><span>A Training Division of ONE VOICE TECH SOLUTIONS</span><span>Business Registration No. 9664153</span><span>www.ovtechacademy.com</span></div>
    </section>}
    <nav className="verification-actions"><a href="https://ovtechacademy.com/">View OVTech Academy Website</a><Link to="/verify">Verify Another Certificate</Link></nav>
  </VerificationLayout>;
}
