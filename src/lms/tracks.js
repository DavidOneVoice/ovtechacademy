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
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

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
