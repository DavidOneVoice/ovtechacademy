import Home from "../pages/Home";
import Courses from "../pages/Courses";
import CourseDetails from "../pages/CourseDetails";
import About from "../pages/About";
import Contact from "../pages/Contact";
import Scholarship from "../pages/Scholarship";
import Alumni from "../pages/Alumni";
import { LearningGuide, LearningGuides } from "../pages/LearningGuides";

export const publicPages = [
  { path: "/", Component: Home }, { path: "/courses", Component: Courses },
  { path: "/courses/:courseId", Component: CourseDetails }, { path: "/about", Component: About },
  { path: "/contact", Component: Contact }, { path: "/scholarship", Component: Scholarship },
  { path: "/alumni", Component: Alumni }, { path: "/guides", Component: LearningGuides },
  { path: "/guides/:slug", Component: LearningGuide },
];
