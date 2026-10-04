import { CalendarDays, ClipboardCheck, Layers, LayoutDashboard, MapPin, NotebookPen, ShieldCheck, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { loadAssessments, loadNotes, signOut } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { Avatar } from '@/ui/kit';
import { AdminNav } from '@/admin/AdminNav';

const PARTNER_SUB: Record<string, string> = { trainer: 'Independent trainer', facility: 'Facility', sport_club: 'Sport club', behavior_specialist: 'Behavior specialist', outdoor_space: 'Outdoor space' };

/** Sidebar and page frame from the prototype (248 px rail, pill nav, badges for work waiting). */
export function Shell() {
  const { partner, staff, trainers, gym, admin } = usePartner();
  const loc = useLocation();
  const [due, setDue] = useState({ notes: 0, assess: 0 });

  useEffect(() => {
    let live = true;
    Promise.all([loadNotes(2), loadAssessments()]).then(([n, a]) => {
      if (live) setDue({ notes: n.filter((x) => !x.note).length, assess: a.filter((x) => !x.outcome && new Date(x.starts_at) < new Date()).length });
    }).catch(() => {});
    return () => { live = false; };
  }, [loc.pathname]);

  const nav: [string, string, LucideIcon, number?][] = [
    ['/', 'Overview', LayoutDashboard], ['/schedule', 'Schedule', CalendarDays], ['/classes', 'Classes', Layers],
    ['/roster', 'Roster', ClipboardCheck], ['/notes', 'Session notes', NotebookPen, due.notes], ['/assessments', 'Assessments', ShieldCheck, due.assess],
    ['/locations', 'Locations', MapPin], ['/earnings', 'Earnings', Wallet], ['/trainers', gym ? 'Trainers' : 'Profile', UserRound],
  ];
  const sub = `${PARTNER_SUB[partner.type] ?? 'Partner'}${gym ? ` · ${trainers.length} trainers` : ''}`;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <aside style={{ width: 248, flex: 'none', boxSizing: 'border-box', padding: '28px 16px 20px', display: 'flex', flexDirection: 'column', gap: 28, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', background: 'var(--surface-raised)' }}>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="pk-wide" style={{ fontSize: 15, fontWeight: 700 }}>PackPass</span>
          <span className="pk-caption pk-muted">Partner</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, background: 'var(--bg)' }}>
          <Avatar name={partner.name} radius={12} tone="pitch" />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="pk-label" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partner.name}</span>
            <span className="pk-caption pk-muted">{sub}</span>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nav.map(([to, label, Icon, badge]) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => navStyle(isActive || (to === '/classes' && loc.pathname.startsWith('/classes')))}>
              <Icon size={18} />
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {badge ? (
                <span style={{ minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', borderRadius: 9999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: to === '/notes' ? 'var(--agility)' : 'var(--surface-sunken)', color: to === '/notes' ? 'var(--on-agility)' : 'var(--ink)' }}>{badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        {admin ? <AdminNav /> : null}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px' }}>
          <Avatar name={staff.name} size={36} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="pk-label" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{staff.name}</span>
            <span className="pk-caption pk-muted">{staff.role === 'owner' ? 'Owner' : 'Trainer'} · <button className="link" style={{ fontSize: 12 }} onClick={() => signOut()}>Sign out</button></span>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: '36px 48px 64px', boxSizing: 'border-box' }}>
        <Outlet />
      </main>
    </div>
  );
}

export const navStyle = (on: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px', borderRadius: 9999, textDecoration: 'none', fontSize: 14,
  fontWeight: on ? 600 : 500, background: on ? 'var(--inverse)' : 'transparent', color: on ? 'var(--on-inverse)' : 'var(--ink)', transition: 'background 140ms cubic-bezier(.2,.8,.2,1)',
});
