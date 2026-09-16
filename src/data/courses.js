export const RECORDED_METHOD = "Self-Paced Pre-recorded Videos";
export const LIVE_METHOD = "Live Online Classes";
export const ONE_TO_ONE_METHOD = "One-on-One Live Classes";

const courses = [
  {
    id: "data-analytics", title: "Data Analytics", durationWeeks: 12,
    tuitionAmount: 300000, scholarshipAmount: 20000, scholarshipRecordedOnly: true,
    image: "/images/data-analytics.webp", alt: "A practical data analysis workspace",
    featured: true, featuredOrder: 1,
    description: "Turn raw data into useful answers. Build confidence with Excel, Power Query, Power BI, SQL, and Python through practical business projects.",
    tools: ["Excel", "Power Query", "Power BI", "SQL", "Python"],
    projects: ["Sales Performance Dashboard", "SQL Business Analysis", "Python Data Exploration", "Portfolio Analytics Project"],
    outline: ["Data fundamentals and asking useful business questions", "Excel formulas, tables, PivotTables, and data cleaning", "Power Query: combine, transform, and prepare data", "Power BI: data models, DAX, and interactive dashboards", "SQL: filtering, joins, aggregations, and business queries", "Python: pandas, exploratory analysis, and visualization", "Communicating insights and presenting a capstone project", "Portfolio preparation and career direction"],
  },
  {
    id: "web-development", title: "Web Development", durationWeeks: 20,
    tuitionAmount: 500000, scholarshipAmount: 20000, scholarshipRecordedOnly: true,
    image: "/images/web-development.webp", alt: "Planning a responsive website across laptop and mobile",
    description: "Create accessible, responsive websites from your first page to a complete client project. Learn HTML, CSS, JavaScript, React, and deployment.",
    tools: ["HTML", "CSS", "JavaScript", "React", "Git", "GitHub"],
    projects: ["Responsive Business Website", "Personal Portfolio", "API-Powered Web App", "Client Website Capstone"],
    outline: ["How the web works and setting up your tools", "Semantic HTML and accessible page structure", "CSS layouts, responsive design, and mobile navigation", "JavaScript, the DOM, forms, and browser events", "Git, GitHub, and collaborative workflows", "Working with APIs and asynchronous JavaScript", "React components, state, and routing", "Testing, debugging, performance, and accessibility", "Domains, hosting, deployment, and client handover", "Portfolio and capstone presentation"],
  },
  {
    id: "software-development", title: "Software Development", durationWeeks: 20,
    tuitionAmount: 500000, scholarshipAmount: 20000, scholarshipRecordedOnly: true,
    image: "/images/software-development.webp", alt: "A developer building a software project",
    featured: true, featuredOrder: 3,
    description: "Learn to solve problems with code and build reliable applications. Develop strong JavaScript and React foundations, connect APIs, and ship practical projects.",
    tools: ["JavaScript", "React", "Git", "GitHub", "APIs", "Testing Tools"],
    projects: ["Task Management Application", "API-Powered Dashboard", "Multi-Page React Application", "Software Capstone Project"],
    outline: ["Programming fundamentals and computational thinking", "JavaScript functions, objects, arrays, and data structures", "HTML, CSS, and accessible application interfaces", "Version control and working with GitHub", "React components, state, and application architecture", "Routing, forms, validation, and error handling", "APIs, asynchronous code, and data integration", "Testing, debugging, and maintainable code", "Responsible AI-assisted development and code review", "Deployment, documentation, and capstone delivery"],
  },
  {
    id: "virtual-assistance", title: "Virtual Assistant", durationWeeks: 8,
    tuitionAmount: 150000, scholarshipAmount: 15000,
    image: "/images/virtual-assistant.webp", alt: "A virtual assistant working from a bright home office",
    description: "Build the organization, communication, and digital skills to support busy teams and clients remotely. Practise real administrative workflows and client-ready delivery.",
    tools: ["Google Workspace", "Calendar Tools", "CRM", "Spreadsheets", "Project Management"],
    projects: ["Inbox and Calendar Workflow", "Client Onboarding Pack", "Research and Travel Plan", "Virtual Assistant Portfolio"],
    outline: ["The virtual assistant role and professional communication", "Inbox, calendar, and meeting management", "Documents, spreadsheets, and online collaboration", "Internet research and clear reporting", "Customer support and CRM fundamentals", "Task tracking, travel planning, and productivity systems", "Client onboarding, boundaries, and confidentiality", "Portfolio development and finding client opportunities"],
  },
  {
    id: "cyber-security", title: "Cybersecurity", durationWeeks: 12,
    tuitionAmount: 400000, scholarshipAmount: 20000,
    image: "/images/cybersecurity.webp", alt: "A cybersecurity professional reviewing a network",
    featured: true, featuredOrder: 2,
    description: "Understand how to protect systems, networks, and data. Learn defensive security through authorized practice, risk assessment, and incident-response exercises.",
    tools: ["Networking", "Linux", "Wireshark", "Security Logs", "Risk Assessment"],
    projects: ["Security Awareness Guide", "Home Lab Network Review", "Log Investigation Report", "Incident Response Plan"],
    outline: ["Cybersecurity principles, ethics, and authorized practice", "Networking fundamentals and common protocols", "Operating systems, Linux, and access controls", "Threats, phishing awareness, and secure configurations", "Network traffic analysis and monitoring", "Security logs and introductory incident detection", "Risk assessment, vulnerability management, and remediation", "Incident response, documentation, and a defensive capstone"],
  },
  {
    id: "ai-automation", title: "AI Automation", durationWeeks: 12,
    tuitionAmount: 400000, scholarshipAmount: 20000,
    image: "/images/ai-automation.webp", alt: "Building an automated workflow on a laptop",
    description: "Turn repetitive work into useful automated workflows. Connect everyday tools, use AI thoughtfully, and build practical systems for business tasks.",
    tools: ["AI Assistants", "Make", "n8n", "Google Workspace", "APIs & Webhooks"],
    projects: ["Lead Capture and Follow-Up Workflow", "Document-to-Summary Assistant", "Automated Reporting Workflow", "Business Automation Capstone"],
    outline: ["AI fundamentals, limitations, and responsible use", "Mapping processes and spotting automation opportunities", "Prompt design, structured outputs, and quality checks", "Triggers, actions, conditions, and workflow tools", "Connecting apps with APIs and webhooks", "Automating forms, spreadsheets, and communications", "Human approvals, privacy, monitoring, and error recovery", "Testing and documenting a business automation capstone"],
  },
].map((course, index) => ({
  ...course,
  label: `Learning Path ${String(index + 1).padStart(2, "0")}`,
  duration: `${course.durationWeeks} Weeks`,
  scholarshipMethod: course.scholarshipRecordedOnly ? RECORDED_METHOD : LIVE_METHOD,
  tuitionMethods: course.scholarshipRecordedOnly ? [ONE_TO_ONE_METHOD, RECORDED_METHOD] : [LIVE_METHOD],
}));
export const findCourse = (value) => courses.find((course) => course.id === value || course.title === value);
export default courses;
