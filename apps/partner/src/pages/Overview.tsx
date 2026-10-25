import { CalendarDays, CalendarSync, NotebookPen, Plus, QrCode, ShieldCheck, Syringe, Users, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { loadAssessments, loadCalendar, loadEarnings, loadReportCards, loadRoster, loadSessions } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { credits, fillLabel, statusOf, withClasses, type SessionView } from '@/lib/sessions';
import { addDays, austin, mondayOf, money, monthDay, monthName, time, weekday, ymd } from '@/lib/time';
import { Badge, Button, Ico, Page, PageHead, ProgressBar, StatGroup, photoUrl, type BadgeTone } from '@/ui/kit';

/** 01 Overview: today's sessions, the week in numbers, and what needs attention. */
export function Overview() {
  const { classById, trainerName, gym, partner, trainers, staff } = usePartner();
  const owner = staff.role === 'owner';
  const nav = useNavigate();
  const now = new Date();
  const today = ymd(now);
  const mon = mondayOf(now);
  const { data } = useData(async () => {
    const [week, notes, assess, earnings, feeds] = await Promise.all([
      loadSessions(austin(mon, 0), austin(addDays(mon, 7), 0)), loadReportCards(2), loadAssessments(), owner ? loadEarnings(2) : Promise.resolve([]),
      loadCalendar().catch(() => null),
    ]);
    const todays = withClasses(week, classById).filter((s) => ymd(s.start) === today && !s.cancelled_at);
    // Vaccine problems among dogs booked today.
    const rosters = await Promise.all(todays.filter((s) => s.booked > 0 && s.end > now).map(async (s) => ({ s, dogs: await loadRoster(s.id) })));
    return { week: withClasses(week, classById), todays, notes, assess, earnings, rosters, feeds };
  }, [mon, owner]);

  if (!data) return <Loading />;
  const { week, todays, notes, assess, earnings, rosters, feeds } = data;
  const live = week.filter((s) => !s.cancelled_at);
  const dogsToday = todays.reduce((a, s) => a + s.booked, 0);
  const next = todays.find((s) => s.start > now) ?? todays.find((s) => s.end > now);
  const meta = (s: SessionView) => [gym ? trainerName(s.cls.trainer_id) : null, `${s.cls.duration_min} min`, credits(s.cls.credits)].filter(Boolean).join(' · ');
  const opened = live.reduce((a, s) => a + s.packpass_spots, 0);
  const filled = live.reduce((a, s) => a + (s.packpass_spots - s.spots_left), 0);
  const thisMonth = earnings[0];
  const ratings = trainers.map((t) => Number(t.rating)).filter(Boolean);

  const notesDue = notes.filter((n) => !n.sent_at && n.status !== 'no_show');
  const assessDue = assess.filter((a) => !a.outcome && new Date(a.starts_at) < now);
  const attention: { icon: LucideIcon; warn?: boolean; text: string; action: string; go: () => void }[] = [];
  if (notesDue.length) attention.push({ icon: NotebookPen, text: `${notesDue.length} report card${notesDue.length > 1 ? 's' : ''} due${new Set(notesDue.map((n) => n.session_id)).size === 1 ? ` from ${notesDue[0].class_title}` : ` from ${new Set(notesDue.map((n) => n.session_id)).size} sessions`}.`, action: 'Write report cards', go: () => nav(new Set(notesDue.map((n) => n.session_id)).size === 1 ? `/notes?s=${notesDue[0].session_id}` : '/notes') });
  if (assessDue.length) attention.push({ icon: ShieldCheck, text: `${assessDue.length} assessment result${assessDue.length > 1 ? 's' : ''} to record. ${listNames(assessDue.map((a) => a.dog_name))}${assessDue.length > 1 ? '’s owners are' : '’s owner is'} waiting.`, action: 'Record results', go: () => nav('/assessments') });
  // Calendar sync (P6): a feed that stopped answering, or the setup prompt until one is connected.
  for (const f of (feeds ?? []).filter((x) => x.id && x.status === 'error'))
    attention.push({ icon: CalendarSync, warn: true, text: `${f.name} stopped sharing your busy times. PackPass keeps the ones it last read until it can read the feed again.`, action: 'Fix calendar sync', go: () => nav('/calendar') });
  if (feeds && !feeds.some((x) => x.id))
    attention.push({ icon: CalendarSync, text: 'Connect the calendar you book clients in, and PackPass hides your spots when you\'re busy.', action: 'Connect your calendar', go: () => nav('/calendar') });
  for (const s of live.filter((x) => x.spots_left <= 0 && !x.waitlist_open && x.start > now).slice(0, 2))
    attention.push({ icon: Users, text: `${s.cls.title} on ${weekday(s.start)} is full. The waitlist is closed.`, action: 'Adjust capacity', go: () => nav(`/schedule?s=${s.id}`) });
  for (const { s, dogs } of rosters)
    for (const d of dogs.filter((x) => /expire|missing/i.test(x.vaccine_line)).slice(0, 2))
      attention.push({ icon: Syringe, warn: true, text: `${d.dog_name}: ${d.vaccine_line.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}. ${d.dog_name} is booked for ${s.cls.title} today.`, action: 'View roster', go: () => nav(`/roster?s=${s.id}`) });

  const stats = [
    { label: 'Dogs booked this week', value: String(live.reduce((a, s) => a + s.booked, 0)), sub: `${live.length} sessions` },
    { label: 'PackPass spots filled', value: opened ? `${Math.round((filled / opened) * 100)}%` : '–', sub: `${filled} of ${opened} opened this week` },
    owner
      ? { label: `Earned in ${monthName(now)}`, value: money(thisMonth?.amount_cents ?? 0), sub: `${thisMonth?.credits ?? 0} credits so far` }
      : { label: 'Checked in this week', value: String(live.reduce((a, s) => a + s.checked_in, 0)), sub: `of ${live.reduce((a, s) => a + s.booked, 0)} dogs booked` },
    { label: gym ? 'Average rating' : 'Your rating', value: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '–', sub: gym ? `${trainers.length} trainers` : partner.name },
  ];

  const status = (s: SessionView) => (statusOf(s, now) === 'Upcoming' && s === next ? 'Next up' : statusOf(s, now));
  const minsTo = next ? Math.round((+next.start - +now) / 60_000) : 0;
  const nextWhen = next ? `${time(next.start)} · ${next.start <= now ? 'in session' : minsTo < 60 ? `in ${minsTo} min` : `in ${Math.round(minsTo / 60)} hr`}` : '';

  return (
    <Page>
      <PageHead title="Overview" sub={`${weekday(now)} · ${monthDay(now)} · ${time(now)} · ${todays.length ? `${todays.length} session${todays.length > 1 ? 's' : ''} today · ${dogsToday} dog${dogsToday === 1 ? '' : 's'} booked` : 'No sessions today'}`}>
        <Button variant="outline" icon={CalendarDays} onClick={() => nav('/schedule')}>Schedule</Button>
        <Button icon={Plus} onClick={() => nav('/schedule?add=1')}>Add session</Button>
      </PageHead>
      <StatGroup columns={4} stats={stats.map((s) => ({ label: s.label, value: s.value, caption: s.sub }))} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <section style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="pp-title">Today's sessions</h2>
          {todays.length ? (
            <div className="tbl">
              <div className="tbl-head" style={{ gridTemplateColumns: TODAY_COLS, minWidth: 680 }}>
                <span>Time</span><span>Class</span><span>Booked</span><span className="r">Credits</span><span>Status</span><span />
              </div>
              {todays.map((s) => (
                <div key={s.id} className="tbl-row" style={{ gridTemplateColumns: TODAY_COLS, minWidth: 680 }}>
                  <span className="pp-label pp-num">{time(s.start)}</span>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span className="pp-heading ellipsis">{s.cls.title}</span>{s.cls.premium ? <Badge tone="cleared">Premium</Badge> : null}</div>
                    <span className="pp-caption pp-muted ellipsis">{meta(s)}</span>
                  </div>
                  <FillBar s={s} />
                  <span className="pp-label pp-num r">{s.cls.credits ?? '–'}</span>
                  <div><Badge tone={STATUS_TONE[status(s)] ?? 'neutral'}>{status(s)}</Badge></div>
                  <Button variant="outline" size="sm" onClick={() => nav(`/roster?s=${s.id}`)}>Roster</Button>
                </div>
              ))}
            </div>
          ) : <Empty>Nothing on the schedule today. Add a session from Schedule.</Empty>}
        </section>
        <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {next ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="pp-title">Next up</h2>
              <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <img src={photoUrl(next.cls.image)} alt="" style={{ width: 56, height: 56, borderRadius: 12, flex: 'none', objectFit: 'cover', background: 'var(--surface-raised)' }} />
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="pp-caption pp-muted">{nextWhen}</span>
                    <span className="pp-title">{next.cls.title}</span>
                  </div>
                </div>
                <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>{`${meta(next)} · ${next.booked} of ${next.packpass_spots} booked`}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={() => nav(`/roster?s=${next.id}`)}>Open roster</Button>
                  <Button variant="outline" size="sm" icon={QrCode} onClick={() => nav('/locations?qr=1')}>Check-in QR</Button>
                </div>
              </div>
            </section>
          ) : null}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 className="pp-title" style={{ marginBottom: 8 }}>Needs attention</h2>
            {attention.length ? attention.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', boxShadow: 'inset 0 -1px 0 var(--line)' }}>
                <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: a.warn ? 'var(--kennel-red-soft)' : 'var(--surface-raised)', color: a.warn ? 'var(--kennel-red)' : 'var(--ink)' }}><Ico icon={a.icon} /></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="pp-body" style={{ textWrap: 'pretty' }}>{a.text}</span>
                  <button className="link" onClick={a.go}>{a.action}</button>
                </div>
              </div>
            )) : <Empty>All caught up.</Empty>}
          </section>
        </aside>
      </div>
    </Page>
  );
}

const TODAY_COLS = '72px minmax(180px,1fr) 150px 56px 92px 76px';
const STATUS_TONE: Record<string, BadgeTone> = { 'In session': 'signal', 'Next up': 'neutral', Upcoming: 'needs', Done: 'neutral', Cancelled: 'warning' };

export function FillBar({ s, width }: { s: SessionView; width?: number }) {
  return (
    <div style={{ width, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="pp-caption pp-num">{fillLabel(s)}</span>
      <ProgressBar value={s.booked} max={Math.max(1, s.packpass_spots)} tone="turf" />
    </div>
  );
}

const listNames = (n: string[]) => (n.length <= 2 ? n.join(' and ') : `${n.slice(0, 2).join(', ')} and ${n.length - 2} more`);
export const Loading = () => <span className="pp-label pp-muted">Loading…</span>;
export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="card" style={{ padding: '14px 16px' }}><span className="pp-label pp-muted">{children}</span></div>
);
