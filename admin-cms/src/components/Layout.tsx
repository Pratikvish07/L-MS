import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bell, Blocks, BookOpen, ChevronDown, ClipboardList, DoorOpen, Film, GraduationCap, Images, LayoutDashboard, LogOut, Menu,
  MonitorSmartphone, Search, Settings, ShieldCheck, TicketPercent, TrendingUp, UserCog, Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import { ADMIN_MODULES } from '../lib/admin-modules';
import { firestore } from '../lib/firebase';
import { initials } from '../lib/format';
import { useStore } from '../lib/store';

export const BRAND = 'Finetution';

/** Main navigation, in the order admins use it most. */
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users?role=student', label: 'Students', icon: Users, match: '/users' },
  { to: '/faculty', label: 'Instructors', icon: GraduationCap },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/lectures', label: 'Lectures', icon: ClipboardList },
  { to: '/live', label: 'Recorder Devices', icon: MonitorSmartphone },
  { to: '/recordings', label: 'Video Library', icon: Film },
  { to: '/coupons', label: 'Coupons', icon: TicketPercent },
  { to: '/reports', label: 'Reports & Analytics', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Master data: everything else (batches, subjects, enrolment) hangs off these. */
const MASTERS = [
  { to: '/modules/classrooms', label: 'Classroom Master', icon: DoorOpen },
  { to: '/modules/roles', label: 'Role Master', icon: ShieldCheck },
  { to: '/users', label: 'User Manager', icon: UserCog },
  { to: '/media', label: 'Media Manager', icon: Images },
];

// Pages already linked above are not repeated in the module groups.
const LINKED = new Set(['users', 'roles', 'classrooms', 'courses', 'coupons']);
const SIDEBAR_MODULES = ADMIN_MODULES.filter((module) => !LINKED.has(module.id) && module.group !== 'Education');
const moduleLink = (id: string) => `/modules/${id}`;

export function Layout() {
  const { error, videoApiError } = useStore();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => { try { return localStorage.getItem('admin-more-open') === '1'; } catch { return false; } });
  const location = useLocation();
  const groups = [...new Set(SIDEBAR_MODULES.map((module) => module.group))];
  const inModule = SIDEBAR_MODULES.some((module) => location.pathname.startsWith(moduleLink(module.id)));
  useEffect(() => { try { localStorage.setItem('admin-more-open', moreOpen ? '1' : '0'); } catch { /* ignore */ } }, [moreOpen]);
  const isActive = (to: string, match?: string, end?: boolean) => {
    const path = match ?? to.split('?')[0];
    return end ? location.pathname === path : location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return <div className="shell">
    <div className="mobile-bar"><button aria-label="Open menu" onClick={() => setOpen((value) => !value)}><Menu size={22} /></button><strong>{BRAND} Admin</strong></div>
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
      <Link to="/" className="brand" onClick={() => setOpen(false)}>
        <span className="brand-mark" aria-hidden><GraduationCap size={22} /></span>
        <div><strong>{BRAND}</strong><span>Admin Portal</span></div>
      </Link>
      <nav className="nav">
        {NAV.map(({ to, label, icon: Icon, end, match }) => (
          <Link key={to} to={to} className={isActive(to, match, end) ? 'active' : undefined} aria-current={isActive(to, match, end) ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={18} aria-hidden />{label}</Link>
        ))}
        <div className="nav-label">Masters</div>
        {MASTERS.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end onClick={() => setOpen(false)}><Icon size={18} aria-hidden />{label}</NavLink>)}
        <button className={`nav-group-toggle${inModule ? ' active' : ''}`} aria-expanded={moreOpen || inModule} onClick={() => setMoreOpen((value) => !value)}><Blocks size={17} aria-hidden /><span>More modules</span><ChevronDown size={16} className="nav-group-chevron" style={{ transform: moreOpen || inModule ? 'rotate(180deg)' : undefined }} /></button>
        {(moreOpen || inModule) && groups.map((group) => (
          <div key={group} className="nav-subitems">
            <span className="nav-sublabel">{group}</span>
            {SIDEBAR_MODULES.filter((module) => module.group === group).map((module) => <NavLink key={module.id} to={moduleLink(module.id)} onClick={() => setOpen(false)}><span>{module.title}</span></NavLink>)}
          </div>
        ))}
      </nav>
      <div className="sidebar-promo">
        <GraduationCap size={34} aria-hidden />
        <strong>Grow your learning platform</strong>
        <span>Manage, teach, record and scale with {BRAND}.</span>
      </div>
    </aside>
    <div className="main-wrap">
      <TopBar />
      <main className="main">{error && <div className="alert" role="alert">{error}</div>}{videoApiError && <div className="notice" role="status">{videoApiError}</div>}<Outlet /></main>
    </div>
  </div>;
}

/** Search (people, lectures, subjects), notifications (things waiting for the admin), and the admin menu. */
function TopBar() {
  const { user, displayName, signOut } = useAuth();
  const { users, recordings, subjects } = useStore();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState<'bell' | 'me' | null>(null);
  const [requests, setRequests] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => onSnapshot(query(collection(firestore, 'enrollmentRequests'), where('status', '==', 'pending')), (s) => setRequests(s.size), () => setRequests(0)), []);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) { setPanel(null); setFocus(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pendingStudents = users.filter((u) => u.role === 'student' && !u.active && u.approvalStatus === 'pending').length;
  const failedUploads = recordings.filter((r) => r.status === 'failed').length;
  const alerts = [
    pendingStudents && { text: `${pendingStudents} student registration${pendingStudents === 1 ? '' : 's'} to approve`, to: '/users?role=student' },
    requests && { text: `${requests} enrolment request${requests === 1 ? '' : 's'} waiting`, to: '/courses' },
    failedUploads && { text: `${failedUploads} lecture upload${failedUploads === 1 ? '' : 's'} failed`, to: '/lectures' },
  ].filter(Boolean) as { text: string; to: string }[];

  const results = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (t.length < 2) return [];
    const people = users.filter((u) => `${u.displayName} ${u.email}`.toLowerCase().includes(t)).slice(0, 5)
      .map((u) => ({ key: `u${u.uid}`, label: u.displayName, sub: `${u.role === 'faculty' ? 'Instructor' : u.role} · ${u.email}`, to: u.role === 'student' ? `/students/${u.uid}` : '/users' }));
    const lectures = recordings.filter((r) => `${r.topic} ${r.subjectName} ${r.facultyName}`.toLowerCase().includes(t)).slice(0, 5)
      .map((r) => ({ key: `r${r.id}`, label: r.topic, sub: `Lecture · ${[r.subjectName, r.facultyName].filter(Boolean).join(' · ')}`, to: `/recordings/${r.id}` }));
    const subs = subjects.filter((s) => s.name.toLowerCase().includes(t)).slice(0, 3)
      .map((s) => ({ key: `s${s.id}`, label: s.name, sub: 'Subject', to: (s as { courseId?: string }).courseId ? `/courses/${(s as { courseId?: string }).courseId}/subjects/${s.id}` : '/courses' }));
    return [...people, ...lectures, ...subs];
  }, [term, users, recordings, subjects]);
  const go = (to: string) => { navigate(to); setTerm(''); setFocus(false); };

  return (
    <header className="topbar" ref={ref}>
      <div className="topbar-search">
        <Search size={17} aria-hidden />
        <input className="input" aria-label="Search students, instructors, lectures" placeholder="Search students, instructors, lectures…" value={term}
          onFocus={() => setFocus(true)} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].to); if (e.key === 'Escape') setFocus(false); }} />
        {focus && term.trim().length >= 2 && (
          <div className="dropdown" role="listbox">
            {results.map((r) => <button key={r.key} role="option" aria-selected={false} className="dropdown-item" onClick={() => go(r.to)}><strong>{r.label}</strong><small>{r.sub}</small></button>)}
            {!results.length && <div className="dropdown-empty">No matches for “{term.trim()}”</div>}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <div className="topbar-pop">
          <button className="icon-btn bell" aria-label={`Notifications (${alerts.length})`} aria-expanded={panel === 'bell'} onClick={() => setPanel(panel === 'bell' ? null : 'bell')}>
            <Bell size={18} />{alerts.length > 0 && <span className="bell-dot" aria-hidden>{alerts.length}</span>}
          </button>
          {panel === 'bell' && (
            <div className="dropdown right">
              <div className="dropdown-head">Needs your attention</div>
              {alerts.map((a) => <button key={a.text} className="dropdown-item" onClick={() => { setPanel(null); navigate(a.to); }}><strong>{a.text}</strong></button>)}
              {!alerts.length && <div className="dropdown-empty">All caught up.</div>}
            </div>
          )}
        </div>
        <div className="topbar-pop">
          <button className="me" aria-expanded={panel === 'me'} onClick={() => setPanel(panel === 'me' ? null : 'me')}>
            <span className="avatar" aria-hidden>{initials(displayName || 'Admin')}</span>
            <span className="me-text"><strong>{displayName || 'Admin'}</strong><small>Administrator</small></span>
            <ChevronDown size={16} aria-hidden />
          </button>
          {panel === 'me' && (
            <div className="dropdown right">
              <div className="dropdown-head">{user?.email}</div>
              <button className="dropdown-item" onClick={() => { setPanel(null); navigate('/settings'); }}><strong>Settings</strong></button>
              <button className="dropdown-item" onClick={() => void signOut()}><strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogOut size={14} aria-hidden /> Log out</strong></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}</div>;
}
