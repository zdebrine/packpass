import { Building2, ClipboardList, Gauge, Inbox, KeyRound, ShieldCheck, Syringe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { loadApplications, loadReviewQueue, loadVetRecords, signOut } from '@/lib/api';
import { navClass, Wordmark } from '@/Shell';
import { Ico } from '@/ui/kit';

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
    ['/admin/vet-records', 'Vet records', Syringe, waiting.records], ['/admin/clearances', 'Clearances', ShieldCheck],
    ['/admin/partners', 'Partners', Building2], ['/admin/staff', 'Staff', KeyRound], ['/admin/fit', 'Fit', Gauge],
  ];
  return (
    <>
      <div className="pp-sidebar-group">PackPass</div>
      {links.map(([to, label, Icon, badge]) => (
        <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => navClass(isActive)}>
          <Ico icon={Icon} />
          <span className="pp-nav-label">{label}</span>
          {badge ? <span className="pp-nav-count pp-nav-count-signal">{badge}</span> : null}
        </NavLink>
      ))}
    </>
  );
}

/** For a PackPass admin who isn't staff at a partner: only the admin pages. */
export function AdminShell() {
  return (
    <div data-density="compact" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <aside className="pp-sidebar" style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '4px 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Wordmark />
          <span className="pp-caption pp-muted">Admin</span>
        </div>
        <AdminNav />
        <div className="pp-sidebar-foot" style={{ padding: '12px 10px 0', boxShadow: 'inset 0 1px 0 var(--line)' }}><button className="link" onClick={() => signOut()}>Sign out</button></div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: '24px 32px 64px', boxSizing: 'border-box' }}><Outlet /></main>
    </div>
  );
}
