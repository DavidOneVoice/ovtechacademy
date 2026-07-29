export const COURSE_DURATIONS = {
  "Virtual Assistant": "1 Month",
  "Data Analytics": "2 Months",
};

export const DEFAULT_COURSE_DURATION = "3 Months";

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

export const getCourseDuration = (course) => COURSE_DURATIONS[course] || DEFAULT_COURSE_DURATION;
export const getCourseSkills = (course) => COURSE_SKILLS[course] || [];
