import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { fetchBlogPosts } from "../services/blogPosts";
import "./Blog.css";

const FALLBACK_IMAGE = "/business-website.png";
const postDate = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date)
    : "Recently published";
};

export default function Blog() {
  const { slug } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = "News & Opportunities | OVTech Academy";
    fetchBlogPosts().then(setPosts).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => posts.find((post) => post.id === slug), [posts, slug]);
  if (slug && selected) return <div className="blog-page"><Navbar /><main className="blog-article"><Link to="/blog" className="blog-back">← All articles</Link><img src={selected.imageUrl || FALLBACK_IMAGE} alt="" /><div className="blog-article-copy"><span className="blog-category">{selected.category}</span><h1>{selected.title}</h1><p className="blog-date">Published {postDate(selected.createdAt)}</p><div className="blog-content">{selected.content.split("\n").map((paragraph, index) => paragraph && <p key={index}>{paragraph}</p>)}</div></div></main><Footer /></div>;

  return <div className="blog-page"><Navbar /><main><header className="blog-hero"><p>OVTECH ACADEMY INSIGHTS</p><h1>News & Opportunities</h1><span>Practical insights, academy updates, scholarships, and opportunities selected to help you move forward.</span></header><section className="blog-directory"><div className="blog-heading"><div><p>Latest stories</p><h2>Explore what is new</h2></div><span>Fresh ideas for your next step</span></div>
    {loading ? <p className="blog-state">Loading articles…</p> : failed ? <div className="blog-state"><h3>Unable to load articles</h3><p>Please check back shortly.</p></div> : posts.length === 0 ? <div className="blog-state"><h3>New stories are on the way</h3><p>Our team is preparing useful updates and opportunities for you.</p></div> : <div className="blog-grid">{posts.map((post) => <article className="blog-card" key={post.id}><Link className="blog-image-link" to={`/blog/${post.id}`}><img src={post.imageUrl || FALLBACK_IMAGE} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} alt="" /></Link><div className="blog-card-body"><div className="blog-meta"><span>{post.category}</span><time>{postDate(post.createdAt)}</time></div><h3><Link to={`/blog/${post.id}`}>{post.title}</Link></h3><p>{post.excerpt}</p><Link className="blog-read" to={`/blog/${post.id}`}>Read article <span aria-hidden="true">→</span></Link></div></article>)}</div>}
  </section></main><Footer /></div>;
}
