import { useRef, useState } from "react";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import ShareIcon from "@mui/icons-material/Share";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import XIcon from "@mui/icons-material/X";
import {
  buildShareMessage,
  buildVerificationUrl,
  buildWhatsAppMessage,
  buildXText,
  openSharePopup,
} from "../../utils/certificateShare";

const cancelled = (error) => error?.name === "AbortError";

export default function CertificateSharing({ certificateId, course, pdfBlobRef }) {
  const [message, setMessage] = useState("");
  const feedbackTimer = useRef(null);
  const url = buildVerificationUrl(certificateId);
  const shareText = buildShareMessage(course);

  const feedback = (text) => {
    setMessage(text);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setMessage(""), 6000);
  };

  const shareData = (includeExistingPdf = false) => {
    const data = { title: "OVTech Academy Certificate", text: shareText, url };
    if (!includeExistingPdf || !pdfBlobRef.current) return data;

    const file = new File(
      [pdfBlobRef.current],
      `OVTech-Certificate-${certificateId}.pdf`,
      { type: "application/pdf" },
    );
    return navigator.canShare?.({ files: [file] }) ? { ...data, files: [file] } : data;
  };

  const nativeShare = async ({ network, includeExistingPdf = false } = {}) => {
    if (!navigator.share) {
      feedback(network
        ? `${network} sharing is available through the Share button on supported mobile devices.`
        : "Sharing is not supported on this browser.");
      return;
    }

    if (network) feedback(`Select ${network} from your device’s share options.`);
    try {
      await navigator.share(shareData(includeExistingPdf));
    } catch (error) {
      if (!cancelled(error)) feedback("Unable to share. Please try again.");
    }
  };

  const platform = (kind) => {
    const destinations = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(course, url))}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildXText(course))}&url=${encodeURIComponent(url)}&hashtags=OVTechAcademy`,
    };
    const label = kind === "x" ? "X" : kind[0].toUpperCase() + kind.slice(1);
    feedback(`Opening ${label}...`);
    openSharePopup(destinations[kind], `ovtech-${kind}`);
  };

  const socialActions = [
    { key: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
    { key: "linkedin", label: "LinkedIn", icon: LinkedInIcon },
    { key: "facebook", label: "Facebook", icon: FacebookIcon },
    { key: "x", label: "X", icon: XIcon },
    { key: "instagram", label: "Instagram", icon: InstagramIcon, native: true },
    { key: "tiktok", label: "TikTok", icon: MusicNoteIcon, native: true },
  ];

  return <section className="certificate-sharing" aria-labelledby="share-achievement-title">
    <div className="certificate-sharing-heading">
      <span className="certificate-sharing-accent" aria-hidden="true" />
      <h2 id="share-achievement-title">Share Your Achievement</h2>
      <p>Celebrate this milestone with your network.</p>
    </div>

    <button
      className="share-primary"
      type="button"
      aria-label="Share achievement"
      onClick={() => nativeShare()}
    >
      <ShareIcon aria-hidden="true" />
      Share achievement
    </button>

    <div className="certificate-share-divider"><span>Share on</span></div>
    <div className="certificate-social-actions">
      {socialActions.map(({ key, label, icon: Icon, native }) => <button
        className={`social-${key}`}
        key={key}
        type="button"
        aria-label={`Share certificate on ${label}`}
        onClick={() => native
          ? nativeShare({ network: label, includeExistingPdf: true })
          : platform(key)}
      >
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </button>)}
    </div>
    <p className="certificate-share-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
