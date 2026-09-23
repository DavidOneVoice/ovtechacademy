import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { guides, findGuide } from "../data/guides.js";
import { findCourse } from "../data/courses.js";
import NotFound from "./NotFound";
import "./LearningGuides.css";

export function LearningGuides() {
  return <main className="learning-guides"><Navbar /><header className="guide-heading"><span className="academy-eyebrow">OVTech learning guides</span><h1>Choose your next skill with a clearer picture.</h1><p>Understand the work, try a small project, and explore the course that fits your goal.</p></header><section className="guide-grid" aria-label="Learning guides">{guides.map((guide) => <article className="guide-card" key={guide.slug}><span>{guide.category}</span><h2><a href={`/guides/${guide.slug}`} target="_blank" rel="noopener noreferrer">{guide.title}</a></h2><p>{guide.description}</p><a href={`/guides/${guide.slug}`} target="_blank" rel="noopener noreferrer">Read the guide →</a></article>)}</section><Footer /></main>;
}

export function LearningGuide() {
  const { slug } = useParams();
  const guide = findGuide(slug);
  if (!guide) return <NotFound />;
  return <main className="learning-guides"><Navbar /><article className="guide-article"><nav aria-label="Breadcrumb" className="guide-breadcrumb"><a href="/" target="_blank" rel="noopener noreferrer">Home</a><span>/</span><a href="/guides" target="_blank" rel="noopener noreferrer">Learning guides</a></nav><header><span className="academy-eyebrow">{guide.category}</span><h1>{guide.title}</h1><p className="guide-byline">By OVTech Academy · <time dateTime={guide.published}>23 September 2026</time></p><p className="guide-lead">{guide.introduction}</p></header>{guide.sections.map((section, i) => <section key={section.heading} id={`section-${i + 1}`}><h2>{section.heading}</h2>{section.items && <ol>{section.items.map((item) => <li key={item}>{item}</li>)}</ol>}{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}<aside className="guide-next"><h2>Explore the learning path</h2><p>Compare the curriculum, current fees, projects, and available class formats.</p>{guide.courseIds.map((id) => <a className="academy-button" key={id} href={`/courses/${id}`} target="_blank" rel="noopener noreferrer">{findCourse(id).title} course →</a>)}</aside></article><section className="guide-related"><h2>More learning guides</h2>{guides.filter((item) => item.slug !== slug).map((item) => <a key={item.slug} href={`/guides/${item.slug}`} target="_blank" rel="noopener noreferrer">{item.title}</a>)}</section><Footer /></main>;
}
