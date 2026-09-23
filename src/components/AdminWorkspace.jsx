import { useLocation } from 'react-router-dom';
import { cohortLink } from '../data/cohort';
import './AdminWorkspace.css';

const destinations = [
  ['/admin', 'Applications', '01'],
  ['/enrolled-students', 'Enrolled students', '02'],
  ['/admin/graduated-students', 'Graduates', '03'],
];
export default function AdminWorkspace({ children, cohort, title, description, onLogout, assistant = false }) {
  const location = useLocation();
  return <div className="admin-workspace">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/" target="_blank" rel="noopener noreferrer"><img src="/ovlogo2.png" alt="OVTech Academy" /><span>Academy workspace<small>People. Progress. Possibility.</small></span></a>
      <p className="admin-nav-label">Admissions</p>
      <nav aria-label="Admin navigation">{(assistant ? [['/admin/assistant', 'Applications', '01']] : destinations).map(([path, label, number]) => <a key={path} href={cohortLink(path, cohort.selectedId)} target="_blank" rel="noopener noreferrer" aria-current={location.pathname === path ? 'page' : undefined}><span aria-hidden="true">{number}</span>{label}<span aria-hidden="true">↗</span></a>)}</nav>
      {!assistant && <><p className="admin-nav-label">Learning & community</p><nav aria-label="Learning management"><a href="/admin/lms" target="_blank" rel="noopener noreferrer">Learning content <span aria-hidden="true">↗</span></a><a href="/admin/live-sessions" target="_blank" rel="noopener noreferrer">Live sessions <span aria-hidden="true">↗</span></a><a href="/alumni" target="_blank" rel="noopener noreferrer">Public alumni <span aria-hidden="true">↗</span></a></nav></>}
      <div className="admin-sidebar-note"><span className="admin-online-dot" />{cohort.selected?.label}<p>Your applications and student lists follow the selected cohort.</p></div>
      <a className="admin-site-link" href="/" target="_blank" rel="noopener noreferrer">Visit website ↗</a>
      {onLogout && <button className="admin-sidebar-logout" onClick={onLogout}>Sign out</button>}
    </aside>
    <div className="admin-workspace-content">
      <header className="admin-workspace-header">
        <div><span className="admin-workspace-eyebrow">OVTech / Admissions</span><h1>{title}</h1><p>{description}</p></div>
        <label className="admin-cohort-picker"><span>Viewing cohort</span><select aria-label="Select cohort" value={cohort.selectedId} onChange={(event) => cohort.setSelectedId(event.target.value)}>{cohort.cohorts.map((item, index) => <option key={item.id} value={item.id}>{item.label}{index === 0 ? ' · Latest' : ''}</option>)}</select></label>
      </header>
      {cohort.catalogueError && <p className="admin-catalogue-note" role="status">The cohort catalogue could not be refreshed. Showing known cohorts from your records.</p>}
      {children}
      <footer className="admin-workspace-footer"><span>OVTech Academy · Admissions workspace</span><span>{cohort.selected?.label} cohort</span></footer>
    </div>
  </div>;
}
