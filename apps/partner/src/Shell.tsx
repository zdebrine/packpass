import { CalendarDays, CalendarSync, ClipboardCheck, Layers, LayoutDashboard, MapPin, NotebookPen, PhoneCall, ShieldCheck, UserRound, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { loadAssessments, loadIntakeCalls, loadReportCards, signOut } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { Avatar, Ico } from '@/ui/kit';
import { LegalLinks } from '@/ui/LegalLinks';
import { AdminNav } from '@/admin/AdminNav';

const PARTNER_SUB: Record<string, string> = { trainer: 'Independent trainer', facility: 'Facility', sport_club: 'Sport club', behavior_specialist: 'Behavior specialist', outdoor_space: 'Outdoor space' };

/** Sidebar and page frame (v3: 220 px hairline rail, 36 px nav rows, counts for work waiting). Compact density. */
export function Shell() {
  const { partner, staff, trainers, gym, admin } = usePartner();
  const loc = useLocation();
  const owner = staff.role === 'owner';
  const [due, setDue] = useState({ notes: 0, assess: 0, intake: 0 });

  useEffect(() => {
    let live = true;
    Promise.all([loadReportCards(2), loadAssessments(), loadIntakeCalls()]).then(([n, a, i]) => {
      if (live) setDue({
        notes: n.filter((x) => !x.sent_at && x.status !== 'no_show').length,
        assess: a.filter((x) => !x.outcome && new Date(x.starts_at) < new Date()).length,
        // Calls that have happened with no 1:1 offered yet.
        intake: i.filter((x) => x.status === 'booked' && !x.offer_status && x.starts_at && new Date(x.starts_at) < new Date()).length,
      });
    }).catch(() => {});
    return () => { live = false; };
  }, [loc.pathname]);

  const all: [string, string, LucideIcon, number?][] = [
    ['/', 'Overview', LayoutDashboard], ['/schedule', 'Schedule', CalendarDays], ['/classes', 'Classes', Layers],
    ['/roster', 'Roster', ClipboardCheck], ['/notes', 'Report cards', NotebookPen, due.notes], ['/assessments', 'Assessments', ShieldCheck, due.assess],
    ['/intake', 'Intake calls', PhoneCall, due.intake],
    ['/locations', 'Locations', MapPin], ['/calendar', 'Calendar sync', CalendarSync], ['/earnings', 'Earnings', Wallet], ['/trainers', gym ? 'Trainers' : 'Profile', UserRound], ['/team', 'Team', Users],
  ];
  // Earnings and Team are for owners.
  const nav = all.filter(([to]) => owner || (to !== '/earnings' && to !== '/team'));
  const sub = `${PARTNER_SUB[partner.type] ?? 'Partner'}${gym ? ` · ${trainers.length} trainers` : ''}`;

  return (
    <div data-density="compact" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <aside className="pp-sidebar" style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '4px 10px 16px' }}><Wordmark /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, marginBottom: 12, padding: '0 8px', borderRadius: 12, boxShadow: 'inset 0 0 0 1px var(--line)', flex: 'none' }}>
          <Avatar name={partner.name} radius={8} tone="pitch" />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="pp-label ellipsis">{partner.name}</span>
            <span className="pp-caption pp-muted ellipsis">{sub}</span>
          </span>
        </div>
        {nav.map(([to, label, Icon, badge]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => navClass(isActive || (to === '/classes' && loc.pathname.startsWith('/classes')))}>
            <Ico icon={Icon} />
            <span className="pp-nav-label">{label}</span>
            {badge ? <span className={`pp-nav-count${to === '/notes' ? ' pp-nav-count-signal' : ''}`}>{badge}</span> : null}
          </NavLink>
        ))}
        {admin ? <AdminNav /> : null}
        <div className="pp-sidebar-foot">
          <LegalLinks style={{ padding: '0 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 0', boxShadow: 'inset 0 1px 0 var(--line)' }}>
            <Avatar name={staff.name} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span className="pp-label ellipsis">{staff.name}</span>
              <span className="pp-caption pp-muted">{staff.role === 'owner' ? 'Owner' : 'Trainer'} · <button className="link" onClick={() => signOut()}>Sign out</button></span>
            </div>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: '24px 32px 64px', boxSizing: 'border-box' }}>
        <Outlet />
      </main>
    </div>
  );
}

export const Wordmark = () => <span className="pp-eyebrow" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.1em', color: 'var(--ink)' }}>PackPass</span>;

export const navClass = (on: boolean) => `pp-nav${on ? ' pp-nav-on' : ''}`;
