import {
  BarChart3,
  BookOpen,
  Building2,
  CloudUpload,
  Film,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import { initials } from '../lib/format';
import { useStore } from '../lib/store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/recordings', label: 'All Recordings', icon: Film },
  { to: '/live', label: 'Live Uploads', icon: CloudUpload },
  { to: '/faculty', label: 'Faculty', icon: GraduationCap },
  { to: '/classrooms', label: 'Classrooms', icon: Building2 },
  { to: '/subjects', label: 'Academics', icon: BookOpen },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const { user, displayName, signOut } = useAuth();
  const { error } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <div className="mobile-bar">
        <button aria-label="Open menu" onClick={() => setOpen((o) => !o)}>
          <Menu size={22} />
        </button>
        <strong>LMS Admin</strong>
      </div>
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>LMS Admin</strong>
            <span>Rayat-Bahra University</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
              <Icon size={18} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar" aria-hidden>
            {initials(displayName || 'Admin')}
          </div>
          <div className="who">
            <strong>{displayName || 'Admin User'}</strong>
            <small>{user?.email}</small>
          </div>
        </div>
        <button className="logout" onClick={() => signOut()}>
          <LogOut size={14} aria-hidden /> Logout
        </button>
      </aside>
      <main className="main">
        {error && <div className="alert" role="alert">{error}</div>}
        <Outlet />
      </main>
    </div>
  );
}

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}
