export const courseGuidance = {
  "data-analytics": {
    audience: "For beginners who want to understand business data, build reports, and explain findings clearly. The course starts with data fundamentals and spreadsheets before moving to SQL and Python.",
    preparation: "Practise organising files, entering spreadsheet data, and explaining a simple chart. A laptop or desktop will help you complete the spreadsheet, dashboard, and coding projects.",
    question: "Do I need to know programming before studying data analytics?",
    answer: "You can begin with spreadsheets and business questions. The curriculum introduces SQL and Python as you progress, alongside Excel, Power Query, and Power BI.",
    guide: "do-you-need-coding-for-data-analytics",
  },
  "web-development": {
    audience: "For learners who want to build websites, responsive interfaces, and web applications. You will move from HTML and CSS to JavaScript, React, and deploying your work online.",
    preparation: "Get comfortable with files, folders, and your browser. Plan to practise on a laptop or desktop so you can use a code editor, inspect pages, and test different screen sizes.",
    question: "How is this different from Software Development?",
    answer: "Web Development focuses on websites and browser interfaces, including responsive layouts, accessibility, and client handover. Software Development puts more emphasis on programming logic, application structure, testing, and application projects. Both include JavaScript and React.",
    guide: "web-development-vs-software-development",
  },
  "software-development": {
    audience: "For beginners interested in solving problems with code and building applications. The curriculum develops JavaScript foundations, React interfaces, API integration, testing, and deployment.",
    preparation: "A laptop or desktop and time for regular coding practice will help. Start by getting comfortable with files and folders; the course begins with programming fundamentals.",
    question: "What kind of software will I practise building?",
    answer: "The planned projects include a task management application, an API-powered dashboard, a multi-page React application, and a software capstone. You will practise connecting interfaces, application logic, and APIs, then test and deploy your work.",
    guide: "web-development-vs-software-development",
  },
  "virtual-assistance": {
    audience: "For learners who want to support clients and teams with organisation, communication, research, and everyday administrative work. The focus is practical remote support and professional delivery.",
    preparation: "Practise writing clear emails and organising documents. Access to a computer and a reliable internet connection will help you work with calendars, spreadsheets, and collaboration tools.",
    question: "Does virtual assistant training involve coding?",
    answer: "This curriculum focuses on administrative and digital workplace skills: inboxes, calendars, research, customer support, CRM, and client onboarding. Programming is not a listed part of this course.",
    guide: "what-does-a-virtual-assistant-do",
  },
  "cyber-security": {
    audience: "For beginners who want a structured introduction to protecting systems and data. You will cover networking, Linux, access controls, traffic analysis, security logs, and defensive incident response.",
    preparation: "Build familiarity with your computer's settings and basic networking terms. Security exercises belong in your own lab or an environment where you have explicit permission to practise.",
    question: "Is the cybersecurity course focused on practical work?",
    answer: "The curriculum includes authorised defensive exercises, with planned projects such as a home lab network review, log investigation report, and incident response plan. Practice must stay within the scope of the authorised environment.",
    guide: "how-to-start-learning-cybersecurity",
  },
  "ai-automation": {
    audience: "For learners who want to reduce repetitive business work using automation tools and AI. You will map processes, connect apps, test workflows, and add human review where it is needed.",
    preparation: "Think of a repeated task you would like to improve, such as organising enquiries or preparing a report. Use sample information while learning and check outputs before relying on an automated workflow.",
    question: "Which tools and workflows does AI Automation cover?",
    answer: "The curriculum includes AI assistants, Make, n8n, Google Workspace, APIs, and webhooks. Planned projects include lead follow-up, document summaries, reporting, and a business automation capstone.",
    guide: "what-is-ai-automation",
  },
};

export function courseQuestions(course) {
  const guidance = courseGuidance[course.id];
  return [
    { question: guidance.question, answer: guidance.answer },
    { question: "How long does the course take?", answer: `The current ${course.title} learning path runs for ${course.durationWeeks} weeks. The enrolment card shows the current cohort's start date.` },
    { question: "Are the classes live or pre-recorded?", answer: course.scholarshipRecordedOnly
      ? "Scholarship places use self-paced, pre-recorded lessons. Full-tuition learners can choose pre-recorded lessons or one-on-one live classes. Confirm your preferred format when you register."
      : "This course uses live online group classes for both scholarship and full-tuition learners." },
    { question: "How do fees and scholarship payments work?", answer: "The enrolment card displays the fees for your detected region. Scholarship applicants pay the scholarship fee only after approval. Full-tuition registration takes you through a payment review before checkout." },
  ];
}
