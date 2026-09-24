import { lazy } from "react";

const Home = lazy(() => import("../pages/Home"));
const Courses = lazy(() => import("../pages/Courses"));
const CourseDetails = lazy(() => import("../pages/CourseDetails"));
const About = lazy(() => import("../pages/About"));
const Contact = lazy(() => import("../pages/Contact"));
const Scholarship = lazy(() => import("../pages/Scholarship"));
const Alumni = lazy(() => import("../pages/Alumni"));
const AnalyticsPrivacy = lazy(() => import("../pages/AnalyticsPrivacy"));
const LearningGuides = lazy(() => import("../pages/LearningGuides").then((page) => ({ default: page.LearningGuides })));
const LearningGuide = lazy(() => import("../pages/LearningGuides").then((page) => ({ default: page.LearningGuide })));

export const publicPages = [
  { path: "/analytics-and-cookies", Component: AnalyticsPrivacy, module: "src/pages/AnalyticsPrivacy.jsx" },
  { path: "/", Component: Home, module: "src/pages/Home.jsx" },
  { path: "/courses", Component: Courses, module: "src/pages/Courses.jsx" },
  { path: "/courses/:courseId", Component: CourseDetails, module: "src/pages/CourseDetails.jsx" },
  { path: "/about", Component: About, module: "src/pages/About.jsx" },
  { path: "/contact", Component: Contact, module: "src/pages/Contact.jsx" },
  { path: "/scholarship", Component: Scholarship, module: "src/pages/Scholarship.jsx" },
  { path: "/alumni", Component: Alumni, module: "src/pages/Alumni.jsx" },
  { path: "/guides", Component: LearningGuides, module: "src/pages/LearningGuides.jsx" },
  { path: "/guides/:slug", Component: LearningGuide, module: "src/pages/LearningGuides.jsx" },
];
