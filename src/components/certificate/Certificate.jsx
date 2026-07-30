import { useRef, useState } from "react";
import CertificateCanvas from "./CertificateCanvas";
import CertificateViewer from "./CertificateViewer";
import { downloadCertificatePdf } from "../../utils/certificatePdf";
import { getCourseSkills } from "../../data/certificateConfig";
import "./Certificate.css";

export default function Certificate({ profile, studentName, courseName }) {
  const certificateRef = useRef(null);
  const [downloadState, setDownloadState] = useState("idle");
  const [downloadError, setDownloadError] = useState("");
  const name = profile.displayName || studentName;
  const course = profile.course || profile.track || courseName;
  const certificateId = profile.certificateId || "Pending";
  const verificationUrl = `https://ovtechacademy.com/verify/${encodeURIComponent(certificateId)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&margin=0&data=${encodeURIComponent(verificationUrl)}`;

  const handleDownload = async () => {
    if (downloadState === "preparing") return;
    setDownloadState("preparing");
    setDownloadError("");
    try {
      await downloadCertificatePdf(certificateRef.current, certificateId);
      setDownloadState("complete");
    } catch (error) {
      console.error("Certificate PDF generation failed:", error);
      setDownloadState("idle");
      setDownloadError("We couldn't prepare your certificate. Please try again.");
    }
  };

  return (
    <div className="certificate-viewer">
      <div className="certificate-toolbar">
        <div><span>Official credential</span><strong>Your digital certificate is ready</strong></div>
        <button type="button" onClick={handleDownload} disabled={downloadState === "preparing"} aria-label="Download certificate as PDF">
          <span aria-hidden="true">↓</span>
          {downloadState === "preparing" ? "Preparing PDF..." : downloadState === "complete" ? "Download PDF again" : "Download PDF"}
        </button>
      </div>
      {downloadError && <p className="certificate-download-error" role="alert">{downloadError}</p>}
      <CertificateViewer>
        <CertificateCanvas
          ref={certificateRef}
          name={name}
          course={course}
          certificateId={certificateId}
          completionDate={profile.completionDate}
          qrCodeUrl={qrCodeUrl}
          skills={getCourseSkills(course)}
        />
      </CertificateViewer>
    </div>
  );
}
