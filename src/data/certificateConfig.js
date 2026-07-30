export const COURSE_DURATIONS = {
  "Virtual Assistant": "1 Month",
  "Data Analytics": "2 Months",
};

export const DEFAULT_COURSE_DURATION = "3 Months";
export const CERTIFICATE_WIDTH = 1120;
export const CERTIFICATE_HEIGHT = 790;

export const COURSE_SKILLS = {
  "Data Analytics": ["Microsoft Excel", "SQL", "Power BI", "Power Query", "Python", "Data Visualization"],
  "Software Development": ["HTML", "CSS", "JavaScript", "React", "Git", "Responsive Design"],
  Cybersecurity: ["Network Security", "Threat Detection", "Risk Assessment", "Incident Response", "SIEM"],
  "Virtual Assistant": ["Google Workspace", "Administrative Support", "Calendar Management", "Client Communication", "Documentation"],
  "Artificial Intelligence": ["Prompt Engineering", "AI Tools", "Automation", "Model Evaluation", "Responsible AI"],
};

export const CERTIFICATE_FOOTER = {
  division: "A Training Division of ONE VOICE TECH SOLUTIONS",
  registration: "Business Registration No. 9664153",
  website: "www.ovtechacademy.com",
};

export const normalizeCourseName = (course = "") => {
  const normalized = course.trim().toLowerCase();
  if (normalized.includes("software development")) return "Software Development";
  if (normalized.includes("data analytics")) return "Data Analytics";
  if (normalized.includes("cybersecurity") || normalized.includes("cyber security")) return "Cybersecurity";
  if (normalized.includes("virtual assistant")) return "Virtual Assistant";
  if (normalized.includes("artificial intelligence")) return "Artificial Intelligence";
  return course.trim();
};

export const getCourseDuration = (course) => COURSE_DURATIONS[normalizeCourseName(course)] || DEFAULT_COURSE_DURATION;
export const getCourseSkills = (course) => COURSE_SKILLS[normalizeCourseName(course)] || [];
