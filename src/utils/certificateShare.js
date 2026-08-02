export const CERTIFICATE_ORIGIN = "https://ovtechacademy.com";

export const buildVerificationUrl = (certificateId) =>
  `${CERTIFICATE_ORIGIN}/verify/${encodeURIComponent(certificateId)}`;

export const buildShareMessage = (courseOrTrack) =>
  `I’m excited to share that I have successfully completed the ${courseOrTrack} programme at OVTech Academy.\n\nI’m proud of this achievement and look forward to applying the knowledge and skills gained.\n\n#OVTechAcademy #ProfessionalDevelopment`;

export const buildWhatsAppMessage = (courseOrTrack, certificateUrl) =>
  `I’m excited to share that I have successfully completed the ${courseOrTrack} programme at OVTech Academy. 🎉\n\nI’m proud of this achievement and look forward to applying the knowledge and skills gained.\n\n${certificateUrl}\n\n#OVTechAcademy #ProfessionalDevelopment`;

export const buildXText = (courseOrTrack) => {
  const courseName = String(courseOrTrack || "my");
  const course = courseName.length > 90
    ? `${courseName.slice(0, 87)}…`
    : courseName;
  return `I’m excited to have completed the ${course} programme at OVTech Academy. 🎉\n\nProud of this achievement and ready for the next step.`;
};

export const openSharePopup = (url, name) => {
  const popup = window.open(url, name, "popup=yes,width=720,height=650,noopener,noreferrer");
  if (!popup) window.open(url, "_blank", "noopener,noreferrer");
};
