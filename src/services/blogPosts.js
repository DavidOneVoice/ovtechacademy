import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../src/firebase";

const posts = () => collection(db, "blogPosts");

export const createSlug = (title) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const fetchBlogPosts = async ({ includeDrafts = false } = {}) => {
  if (!isFirebaseConfigured || !db) return [];
  const snapshot = await getDocs(query(posts(), orderBy("createdAt", "desc")));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => includeDrafts || item.status === "published");
};

export const saveBlogPost = async (post) => {
  const id = post.id || createSlug(post.title);
  await setDoc(doc(db, "blogPosts", id), {
    title: post.title.trim(),
    excerpt: post.excerpt.trim(),
    content: post.content.trim(),
    imageUrl: post.imageUrl.trim(),
    category: post.category.trim() || "News",
    status: post.status,
    createdAt: post.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
};

export const removeBlogPost = (id) => deleteDoc(doc(db, "blogPosts", id));
