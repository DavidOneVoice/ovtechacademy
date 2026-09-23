import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export default function NotFound() {
  return <main className="ov-course-detail"><Navbar /><section className="course-not-found"><h1>We couldn’t find that page.</h1><p>The link may have changed. Explore our current courses or contact admissions for help.</p><a className="academy-button" href="/courses" target="_blank" rel="noopener noreferrer">Explore courses</a></section><Footer /></main>;
}
