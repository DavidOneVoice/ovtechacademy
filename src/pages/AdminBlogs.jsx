import { useEffect, useState } from "react";
import { fetchBlogPosts, removeBlogPost, saveBlogPost } from "../services/blogPosts";
import "./AdminBlogs.css";

const EMPTY = { title: "", category: "Opportunities", excerpt: "", content: "", imageUrl: "", status: "published" };

export default function AdminBlogs() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const load = () => fetchBlogPosts({ includeDrafts: true }).then(setPosts).catch(() => setMessage("Articles could not be loaded.")).finally(() => setLoading(false));
  useEffect(load, []);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try { await saveBlogPost(form); setForm(EMPTY); setMessage(form.id ? "Article updated." : "Article published."); await load(); }
    catch { setMessage("The article could not be saved. Check your connection and try again."); }
    finally { setSaving(false); }
  };
  const edit = (post) => { setForm(post); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (post) => { if (!window.confirm(`Delete “${post.title}”?`)) return; await removeBlogPost(post.id); setMessage("Article deleted."); load(); };

  return <main className="blog-admin-page"><header className="blog-admin-header"><div><span>OVTech Admin</span><h1>News & Opportunities</h1><p>Create polished articles and manage what visitors see on the website.</p></div><div><a href="/blog">View Blog</a><a href="/admin">Admin Dashboard</a></div></header>
    {message && <p className="blog-admin-notice" role="status">{message}</p>}
    <section className="blog-admin-layout"><form className="blog-editor" onSubmit={submit}><div className="blog-editor-title"><div><span>Article editor</span><h2>{form.id ? "Update article" : "Publish a new article"}</h2></div>{form.id && <button type="button" onClick={() => setForm(EMPTY)}>Cancel edit</button>}</div><div className="blog-editor-grid"><label>Article title<input required name="title" value={form.title} onChange={update} placeholder="A clear, engaging headline" /></label><label>Category<input required name="category" value={form.category} onChange={update} placeholder="Scholarships, Academy News…" /></label></div><label>Cover image URL<input required type="url" name="imageUrl" value={form.imageUrl} onChange={update} placeholder="https://…" /></label><label>Short summary<textarea required name="excerpt" value={form.excerpt} onChange={update} rows="3" placeholder="A concise preview shown on the article card" /></label><label>Article content<textarea required name="content" value={form.content} onChange={update} rows="10" placeholder="Write the complete article. Separate paragraphs with a new line." /></label><div className="blog-editor-actions"><label>Visibility<select name="status" value={form.status} onChange={update}><option value="published">Published</option><option value="draft">Draft</option></select></label><button type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Publish article"}</button></div></form>
      <aside className="blog-preview"><span>Live card preview</span><article><div className="blog-preview-image">{form.imageUrl ? <img src={form.imageUrl} alt="" /> : <p>Cover image preview</p>}</div><div className="blog-preview-body"><small>{form.category || "Category"}</small><h3>{form.title || "Your article title will appear here"}</h3><p>{form.excerpt || "Add a short summary so readers know what to expect from this article."}</p><strong>Read article →</strong></div></article></aside></section>
    <section className="blog-admin-list"><div><span>Content library</span><h2>Published articles and drafts</h2></div>{loading ? <p>Loading articles…</p> : posts.length === 0 ? <p>No articles have been created yet.</p> : <div className="blog-admin-grid">{posts.map((post) => <article key={post.id}><img src={post.imageUrl} alt="" /><div><span className={`blog-status ${post.status}`}>{post.status}</span><h3>{post.title}</h3><p>{post.excerpt}</p><div className="blog-item-actions"><button onClick={() => edit(post)}>Edit</button><button className="danger" onClick={() => remove(post)}>Delete</button></div></div></article>)}</div>}</section>
  </main>;
}
