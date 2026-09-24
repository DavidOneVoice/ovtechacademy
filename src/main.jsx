import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startAnalytics } from './analytics/google.js'

startAnalytics();

const root = document.getElementById('root');
const app = <StrictMode><App /></StrictMode>;
// Query-selected courses, saved drafts, and legacy hash links need their own
// client state instead of hydrating the generic page produced at build time.
if (root.dataset.prerendered === 'true' && !window.location.search && !window.location.hash) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
