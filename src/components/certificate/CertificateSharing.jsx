import { useRef, useState } from "react";
import { createCertificatePdf, createCertificatePng, downloadBlob } from "../../utils/certificatePdf";
import { buildShareMessage, buildVerificationUrl, buildXText, copyText, openSharePopup } from "../../utils/certificateShare";

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const cancelled = (error) => error?.name === "AbortError";

export default function CertificateSharing({ certificateElement, certificateId, course, pdfBlobRef }) {
  const [message, setMessage] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const feedbackTimer = useRef(null);
  const url = buildVerificationUrl(certificateId);
  const shareText = buildShareMessage(course, url);
  const filename = `OVTech-Certificate-${certificateId}.pdf`;

  const feedback = (text) => {
    setMessage(text);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setMessage(""), 6000);
  };
  const getPdf = async () => {
    if (!pdfBlobRef.current) pdfBlobRef.current = await createCertificatePdf(certificateElement());
    return pdfBlobRef.current;
  };
  const getPdfFile = async () => new File([await getPdf()], filename, { type: "application/pdf" });
  const nativeShare = async (preferFile = false) => {
    if (!navigator.share) { setMoreOpen(true); feedback("Choose a sharing option below."); return false; }
    try {
      let files;
      if (preferFile) {
        feedback("Preparing certificate...");
        const file = await getPdfFile();
        if (navigator.canShare?.({ files: [file] })) files = [file];
      }
      await navigator.share({ title: "OVTech Academy Certificate", text: shareText, url, ...(files && { files }) });
      return true;
    } catch (error) {
      feedback(cancelled(error) ? "Share cancelled" : "Unable to share. Please try again.");
      return false;
    }
  };
  const platform = (kind) => {
    const destinations = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildXText(course))}&url=${encodeURIComponent(url)}&hashtags=OVTechAcademy`,
    };
    feedback(`Opening ${kind === "x" ? "X" : kind[0].toUpperCase() + kind.slice(1)}...`);
    openSharePopup(destinations[kind], `ovtech-${kind}`);
  };
  const socialUpload = async (network) => {
    if (isMobile() && navigator.share) {
      await nativeShare(true);
      return;
    }
    try {
      feedback("Preparing certificate...");
      const pdf = await getPdf();
      await copyText(shareText);
      downloadBlob(pdf, filename);
      feedback(`Your certificate has been downloaded and the caption copied. Open ${network} to ${network === "Instagram" ? "upload and share it" : "create your post"}.`);
    } catch { feedback("Unable to share. Please try again."); }
  };
  const copyLink = async () => {
    try { await copyText(url); feedback("Verification link copied."); }
    catch { feedback("Unable to copy the link. Please try again."); }
  };
  const shareImage = async () => {
    try {
      feedback("Preparing certificate...");
      const blob = await createCertificatePng(certificateElement());
      const imageName = `OVTech-Certificate-${certificateId}.png`;
      const file = new File([blob], imageName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "OVTech Academy Certificate", text: shareText, url, files: [file] });
      } else {
        downloadBlob(blob, imageName);
        feedback("Certificate downloaded");
      }
    } catch (error) { feedback(cancelled(error) ? "Share cancelled" : "Unable to share. Please try again."); }
  };

  return <section className="certificate-sharing" aria-labelledby="share-achievement-title">
    <div className="certificate-sharing-heading"><div><p>Verified credential</p><h2 id="share-achievement-title">Share Your Achievement</h2></div>
      <span>Celebrate your achievement and share your verified OVTech Academy certificate with your network.</span></div>
    <div className="certificate-share-actions">
      <button className="share-primary" type="button" onClick={() => nativeShare(true)}><b aria-hidden="true">↗</b> Share</button>
      <button type="button" onClick={() => platform("whatsapp")}><b aria-hidden="true">WA</b> WhatsApp</button>
      <button type="button" onClick={() => platform("linkedin")}><b aria-hidden="true">in</b> LinkedIn</button>
      <button type="button" onClick={copyLink}><b aria-hidden="true">⧉</b> Copy Verification Link</button>
      <button className="share-more-toggle" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>••• More Sharing Options</button>
      <div className={`certificate-share-more ${moreOpen ? "open" : ""}`}>
        <button type="button" onClick={() => platform("facebook")}><b aria-hidden="true">f</b> Facebook</button>
        <button type="button" onClick={() => platform("x")}><b aria-hidden="true">𝕏</b> X</button>
        <button type="button" onClick={() => socialUpload("Instagram")}><b aria-hidden="true">◎</b> Instagram</button>
        <button type="button" onClick={() => socialUpload("TikTok")}><b aria-hidden="true">♪</b> TikTok</button>
        <button type="button" onClick={shareImage}><b aria-hidden="true">▧</b> Share as Image</button>
      </div>
    </div>
    <p className="certificate-share-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
