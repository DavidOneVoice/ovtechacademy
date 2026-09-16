import courses from "./courses.js";

export const CANONICAL_PROGRAMMES = courses.map((course) => course.title);

const LEGACY_PROGRAMME_ALIASES = {
  "software development frontend": "Software Development",
  "software development front end": "Software Development",
  "frontend development": "Software Development",
  "front end development": "Software Development",
  frontend: "Software Development",
  "frontend software development": "Software Development",
  "front end software development": "Software Development",
  "virtual assistance": "Virtual Assistant",
  "cyber security": "Cybersecurity",
  "ai automation": "AI Automation",
};

export const normalizeProgrammeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const CANONICAL_BY_KEY = Object.fromEntries(
  CANONICAL_PROGRAMMES.map((programme) => [
    normalizeProgrammeKey(programme),
    programme,
  ]),
);

export const normalizeProgrammeName = (value) => {
  const original = String(value || "").trim();
  const key = normalizeProgrammeKey(original);
  return LEGACY_PROGRAMME_ALIASES[key] || CANONICAL_BY_KEY[key] || original;
};

export const getCanonicalProgrammeOptions = (values = []) => [
  ...new Set([
    ...CANONICAL_PROGRAMMES,
    ...values.map(normalizeProgrammeName).filter((value) =>
      CANONICAL_PROGRAMMES.includes(value),
    ),
  ]),
];

export const programmeMatches = (value, canonicalProgramme) =>
  normalizeProgrammeName(value) === canonicalProgramme;
