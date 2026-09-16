import { normalizeProgrammeKey } from "../data/programmes.js";

const DATA_ANALYTICS_COURSES = [
  "Data Fundamentals",
  "Microsoft Excel",
  "Power Query",
  "Power BI",
  "SQL",
  "Python",
];

const TRACK_COURSE_MAP = {
  "data analytics": DATA_ANALYTICS_COURSES,
};

export const CURRICULUM_GROUPS = {
  DATA_ANALYTICS: "data-analytics",
  COMPUTER_PROGRAMMING: "computer-programming",
  CYBERSECURITY: "cyber-security",
  VIRTUAL_ASSISTANT: "virtual-assistance",
  AI_AUTOMATION: "ai-automation",
};

export const CURRICULUM_PROGRAMMES = [
  { value: CURRICULUM_GROUPS.CYBERSECURITY, label: "Cybersecurity" },
  { value: CURRICULUM_GROUPS.VIRTUAL_ASSISTANT, label: "Virtual Assistant" },
  { value: CURRICULUM_GROUPS.AI_AUTOMATION, label: "AI Automation" },
  { value: CURRICULUM_GROUPS.DATA_ANALYTICS, label: "Data Analytics" },
  {
    value: CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
    label: "Computer Programming",
  },
];

const DIRECT_TRACK_COURSE_ALIASES = {
  "software development frontend": [
    "Software Development (Frontend)",
    "Software Development",
    "Frontend",
    "Frontend Development",
  ],
  "software development": ["Software Development"],
  frontend: ["Frontend", "Frontend Development"],
  "frontend development": ["Frontend", "Frontend Development"],
  "front end": ["Frontend", "Frontend Development"],
  "front end development": ["Frontend", "Frontend Development"],
  "web development": ["Web Development"],
};

export const normalizeTrackName = (value) =>
  normalizeProgrammeKey(value);

const TRACK_CURRICULUM_GROUP_MAP = {
  "cybersecurity": CURRICULUM_GROUPS.CYBERSECURITY,
  "virtual assistant": CURRICULUM_GROUPS.VIRTUAL_ASSISTANT,
  "ai automation": CURRICULUM_GROUPS.AI_AUTOMATION,
  "data analytics": CURRICULUM_GROUPS.DATA_ANALYTICS,
  "software development": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "software development frontend": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "software development front end": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "frontend development": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "front end development": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "frontend software development": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "front end software development": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  frontend: CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
  "web development": CURRICULUM_GROUPS.COMPUTER_PROGRAMMING,
};

export const resolveCurriculumGroup = (programme) =>
  TRACK_CURRICULUM_GROUP_MAP[normalizeTrackName(programme)] || null;

const getStudentTrackValues = (student) =>
  [
    student?.track,
    student?.course,
    student?.courseName,
    student?.program,
    ...(Array.isArray(student?.tracks) ? student.tracks : []),
    ...(Array.isArray(student?.courses) ? student.courses : []),
    ...(Array.isArray(student?.enrolledCourses) ? student.enrolledCourses : []),
  ].filter(Boolean);

export const resolveStudentCurriculumGroup = (student) => {
  const track = getStudentTrackValues(student)
    .find((value) => resolveCurriculumGroup(value));

  return track ? resolveCurriculumGroup(track) : null;
};

export const getCurriculumItemGroup = (item) =>
  item?.curriculumGroup || CURRICULUM_GROUPS.DATA_ANALYTICS;

export const curriculumItemMatchesGroup = (item, curriculumGroup) =>
  getCurriculumItemGroup(item) === curriculumGroup;

export const getAllowedCurriculumCoursesForStudent = (student) => {
  const normalizedTracks = getStudentTrackValues(student).map(normalizeTrackName);
  const allowedCourses = new Set();

  normalizedTracks.forEach((track) => {
    const mappedCourses = TRACK_COURSE_MAP[track];
    const directAliases = DIRECT_TRACK_COURSE_ALIASES[track] || [];

    if (mappedCourses) {
      mappedCourses.forEach((course) => allowedCourses.add(normalizeTrackName(course)));
      return;
    }

    allowedCourses.add(track);
    directAliases.forEach((course) => allowedCourses.add(normalizeTrackName(course)));
  });

  return allowedCourses;
};

export const curriculumItemMatchesStudentTrack = (item, student) => {
  const allowedCourses = getAllowedCurriculumCoursesForStudent(student);
  if (!allowedCourses.size) return false;

  return allowedCourses.has(normalizeTrackName(item?.course || item?.courseName));
};
