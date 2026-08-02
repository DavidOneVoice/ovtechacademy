export const CERTIFICATE_ORIGIN = "https://ovtechacademy.com";

export const buildVerificationUrl = (certificateId) =>
  `${CERTIFICATE_ORIGIN}/verify/${encodeURIComponent(certificateId)}`;

export const buildShareMessage = (courseOrTrack, verificationUrl) =>
  `I’m pleased to share that I have successfully completed the ${courseOrTrack} programme at OVTech Academy.\n\nView and verify my certificate:\n${verificationUrl}\n\n#OVTechAcademy #ProfessionalDevelopment`;

export const buildXText = (courseOrTrack) => {
  const course = String(courseOrTrack || "my").length > 90
    ? `${String(courseOrTrack).slice(0, 87)}…`
    : courseOrTrack;
  return `I’ve completed the ${course} programme at OVTech Academy.\n\nVerify my certificate:`;
};

export const copyText = async (value) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard is unavailable.");
};

export const openSharePopup = (url, name) => {
  const popup = window.open(url, name, "popup=yes,width=720,height=650,noopener,noreferrer");
  if (!popup) window.open(url, "_blank", "noopener,noreferrer");
};
