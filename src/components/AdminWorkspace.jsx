import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../src/firebase';
import { clearStoredAdminRole } from '../auth/adminRoles';
import { COHORT, cohortLink } from '../data/cohort';
import './AdminWorkspace.css';

const admissions = [
  ['/admin', 'Applications', 'applications'],
  ['/enrolled-students', 'Enrolled students', 'students'],
  ['/admin/graduated-students', 'Graduates', 'graduates'],
];
const learning = [
  ['/admin/lms', 'Learning content', 'content'],
  ['/admin/live-sessions', 'Live sessions', 'sessions'],
];
const iconPaths = {
  applications: ['M8 5H5v15h14V5h-3', 'M8 3h8v4H8z', 'M8 12h8M8 16h5'],
  students: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'],
  graduates: ['M2 9l10-5 10 5-10 5z', 'M6 11v6c4 3 8 3 12 0v-6M22 9v7'],
  content: ['M12 6v15M3 3h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z'],
  sessions: ['M3 5h13v14H3z', 'M16 10l5-3v10l-5-3'],
};
function NavigationIcon({ kind }) {
  return <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[kind].map((path) => <path key={path} d={path} />)}</svg>;
}

export default function AdminWorkspace({ children, cohort, title, description, onLogout, assistant = false, cohortDescription }) {
  const location = useLocation();
  const selectedId = cohort?.selectedId || new URLSearchParams(location.search).get('cohort') || COHORT.id;
  const logout = onLogout || (async () => {
    clearStoredAdminRole();
    if (auth) await signOut(auth);
    window.location.href = '/admin-login';
  });
  const destinations = assistant ? [['/admin/assistant', 'Applications', 'applications']] : admissions;
  const navigation = (items) => items.map(([path, label, icon]) => <Link key={path} to={cohortLink(path, selectedId)} aria-current={location.pathname === path ? 'page' : undefined}><NavigationIcon kind={icon} /><span>{label}</span></Link>);

  return <div className="admin-workspace">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/" target="_blank" rel="noopener noreferrer"><img src="/ovlogo2.png" alt="" /><span>OVTech Academy<small>{assistant ? 'Assistant workspace' : 'Administration'}</small></span></a>
      <div className="admin-navigation">
        <p className="admin-nav-label">Admissions</p>
        <nav aria-label="Admissions navigation">{navigation(destinations)}</nav>
        {!assistant && <><p className="admin-nav-label">Learning & community</p><nav aria-label="Learning management">{navigation(learning)}<a href="/alumni" target="_blank" rel="noopener noreferrer"><NavigationIcon kind="graduates" /><span>Public alumni</span><span className="admin-external-arrow" aria-hidden="true">↗</span></a></nav></>}
      </div>
      <div className="admin-sidebar-bottom">
        <div className="admin-sidebar-note"><span className="admin-online-dot" />{cohort?.selected?.label || 'Academy learning content'}<p>{cohort ? cohortDescription || 'Applications and student lists follow your selected cohort.' : 'Curriculum lessons and resources are shared across cohorts.'}</p></div>
        <div className="admin-sidebar-actions"><a className="admin-site-link" href="/" target="_blank" rel="noopener noreferrer">Visit website <span aria-hidden="true">↗</span></a><button type="button" className="admin-sidebar-logout" onClick={logout}>Sign out</button></div>
      </div>
    </aside>
    <div className="admin-workspace-content">
      <header className="admin-workspace-header">
        <div><span className="admin-workspace-eyebrow">{assistant ? 'Assistant workspace' : cohort ? 'Academy administration' : 'Learning management'}</span><h1>{title}</h1><p>{description}</p></div>
        {cohort ? <label className="admin-cohort-picker"><span>Viewing cohort</span><select aria-label="Select cohort" value={cohort.selectedId} onChange={(event) => cohort.setSelectedId(event.target.value)}>{cohort.cohorts.map((item, index) => <option key={item.id} value={item.id}>{item.label}{index === 0 ? ' · Latest' : ''}</option>)}</select></label> : <div className="admin-shared-content-note"><span>Shared content</span><small>Available across academy cohorts</small></div>}
      </header>
      {cohort?.catalogueError && <p className="admin-catalogue-note" role="status">The cohort catalogue could not be refreshed. Showing known cohorts from your records.</p>}
      {children}
      <footer className="admin-workspace-footer"><span>OVTech Academy · {assistant ? 'Assistant' : 'Admin'} workspace</span><span>{cohort?.selected?.label || 'Learning & community'}</span></footer>
    </div>
  </div>;
}
