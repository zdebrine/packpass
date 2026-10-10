import { Building2, ClipboardList, Inbox, KeyRound, Syringe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { loadApplications, loadReviewQueue, loadVetRecords, signOut } from '@/lib/api';
import { navStyle } from '@/Shell';

/** The PackPass section of the sidebar: admin pages, with badges for classes, applications and vet records waiting. */
export function AdminNav() {
  const loc = useLocation();
  const [waiting, setWaiting] = useState({ classes: 0, applications: 0, records: 0 });
  useEffect(() => {
    let live = true;
    Promise.all([loadReviewQueue(), loadApplications(), loadVetRecords()])
      .then(([q, a, v]) => live && setWaiting({ classes: q.length, applications: a.filter((x) => x.status === 'submitted').length, records: v.filter((x) => x.status === 'pending').length })).catch(() => {});
    return () => { live = false; };
  }, [loc.pathname]);
  const links: [string, string, typeof ClipboardList, number?][] = [
    ['/admin', 'Review', ClipboardList, waiting.classes], ['/admin/applications', 'Applications', Inbox, waiting.applications],
    ['/admin/vet-records', 'Vet records', Syringe, waiting.records],
    ['/admin/partners', 'Partners', Building2], ['/admin/staff', 'Staff', KeyRound],
  ];
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="pk-wide pk-muted" style={{ padding: '0 14px 6px', fontSize: 11 }}>PackPass</span>
      {links.map(([to, label, Icon, badge]) => (
        <NavLink key={to} to={to} end={to === '/admin'} style={({ isActive }) => navStyle(isActive)}>
          <Icon size={18} />
          <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
          {badge ? (
            <span style={{ minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', borderRadius: 9999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--agility)', color: 'var(--on-agility)' }}>{badge}</span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}

/** For a PackPass admin who isn't staff at a partner: only the admin pages. */
export function AdminShell() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <aside style={{ width: 248, flex: 'none', boxSizing: 'border-box', padding: '28px 16px 20px', display: 'flex', flexDirection: 'column', gap: 28, position: 'sticky', top: 0, height: '100vh', background: 'var(--surface-raised)' }}>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pk-wide" style={{ fontSize: 15, fontWeight: 700 }}>PackPass</span>
          <span className="pk-caption pk-muted">Admin</span>
        </div>
        <AdminNav />
        <div style={{ marginTop: 'auto', padding: '0 10px' }}><button className="link" onClick={() => signOut()}>Sign out</button></div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: '36px 48px 64px', boxSizing: 'border-box' }}><Outlet /></main>
    </div>
  );
}
