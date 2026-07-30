import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getAlumniPage, toDate } from "../services/publicAlumni";
import "./Alumni.css";

const SOCIAL_LABELS = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", twitter: "X", tiktok: "TikTok" };
const PLACEHOLDER = "/ovlogo2.png";

const formatDate = (value) => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date) : "Date unavailable";
};

export default function Alumni() {
  const [alumni, setAlumni] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    document.title = "Alumni Directory | OVTech Academy";
    const meta = document.querySelector('meta[name="description"]');
    const previous = meta?.getAttribute("content");
    meta?.setAttribute("content", "Meet verified OVTech Academy graduates who consented to share their professional profiles and completed programmes.");
    getAlumniPage().then((page) => {
      setAlumni(page.records); setCursor(page.cursor); setHasMore(page.hasMore);
    }).catch(() => setFailed(true)).finally(() => setLoading(false));
    return () => { if (meta && previous) meta.setAttribute("content", previous); };
  }, []);

  const programmes = useMemo(() => [...new Set(alumni.map((person) => person.courseOrTrack).filter(Boolean))].sort(), [alumni]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return alumni.filter((person) => (!term || person.studentName.toLocaleLowerCase().includes(term)) && (programme === "all" || person.courseOrTrack === programme)).sort((a, b) => {
      if (sort === "az" || sort === "za") return a.studentName.localeCompare(b.studentName) * (sort === "az" ? 1 : -1);
      const difference = (toDate(b.completionDate)?.getTime() || 0) - (toDate(a.completionDate)?.getTime() || 0);
      return sort === "oldest" ? -difference : difference;
    });
  }, [alumni, programme, search, sort]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await getAlumniPage(cursor);
      setAlumni((current) => [...current, ...page.records]); setCursor(page.cursor); setHasMore(page.hasMore);
    } catch { setFailed(true); }
    finally { setLoadingMore(false); }
  };

  return <div className="alumni-page">
    <Navbar />
    <main>
      <header className="alumni-hero">
        <img src="/ovlogo2.png" alt="OVTech Academy logo" />
        <p>OVTECH ACADEMY</p><h1>Alumni Directory</h1>
        <span>Meet graduates who have successfully completed professional training programmes at OVTech Academy.</span>
      </header>
      <section className="alumni-directory" aria-labelledby="directory-title">
        <div className="alumni-section-heading"><div><p>Verified professionals</p><h2 id="directory-title">Meet our graduates</h2></div><span>{alumni.length} profiles loaded</span></div>
        <div className="alumni-controls">
          <label>Search by graduate name<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search graduates" /></label>
          <label>Programme<select value={programme} onChange={(event) => setProgramme(event.target.value)}><option value="all">All Programmes</option>{programmes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Sort graduates<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest graduates</option><option value="oldest">Oldest graduates</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select></label>
        </div>
        {loading ? <p className="alumni-state" role="status">Loading alumni...</p> : failed ? <div className="alumni-state" role="alert"><h2>Unable to Load Alumni</h2><p>We could not load the alumni directory. Please try again later.</p></div> : !alumni.length ? <p className="alumni-state">Our alumni directory is being updated. Please check back soon.</p> : !visible.length ? <p className="alumni-state">No graduates match your search or selected programme.</p> : <div className="alumni-grid">{visible.map((person) => <article className="alumni-card" key={person.certificateId}>
          <img className="alumni-photo" src={person.photoUrl || PLACEHOLDER} onError={(event) => { event.currentTarget.src = PLACEHOLDER; }} alt={`Professional portrait of ${person.studentName}`} />
          <div className="alumni-card-body"><span className="verified-badge">✓ OVTech Verified Graduate</span><h3>{person.studentName}</h3><p className="alumni-programme">{person.courseOrTrack}</p><p className="alumni-date">Completed {formatDate(person.completionDate)}</p>
            <div className="alumni-socials" aria-label={`${person.studentName} professional links`}>{Object.entries(SOCIAL_LABELS).map(([key, label]) => person[key] ? <a key={key} href={person[key]} target="_blank" rel="noopener noreferrer" aria-label={`${person.studentName} on ${label}`}>{label}</a> : null)}</div>
            <Link className="certificate-link" to={`/verify/${encodeURIComponent(person.certificateId)}`}>View Certificate</Link>
          </div></article>)}</div>}
        {!failed && hasMore && <button className="load-more" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading alumni..." : "Load More Graduates"}</button>}
      </section>
    </main><Footer />
  </div>;
}
