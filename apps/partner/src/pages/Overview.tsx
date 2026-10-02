import { NotebookPen, ShieldCheck, Syringe, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { loadAssessments, loadEarnings, loadNotes, loadRoster, loadSessions } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { credits, fillLabel, statusOf, withClasses, type SessionView } from '@/lib/sessions';
import { addDays, austin, mondayOf, money, monthDay, monthName, time, weekday, ymd } from '@/lib/time';
import { Button, Tag, photoUrl } from '@/ui/kit';

/** 01 Overview: today's sessions, the week in numbers, and what needs attention. */
export function Overview() {
  const { classById, trainerName, gym, partner, trainers } = usePartner();
  const nav = useNavigate();
  const now = new Date();
  const today = ymd(now);
  const mon = mondayOf(now);
  const { data } = useData(async () => {
    const [week, notes, assess, earnings] = await Promise.all([
      loadSessions(austin(mon, 0), austin(addDays(mon, 7), 0)), loadNotes(2), loadAssessments(), loadEarnings(2),
    ]);
    const todays = withClasses(week, classById).filter((s) => ymd(s.start) === today && !s.cancelled_at);
    // Vaccine problems among dogs booked today.
    const rosters = await Promise.all(todays.filter((s) => s.booked > 0 && s.end > now).map(async (s) => ({ s, dogs: await loadRoster(s.id) })));
    return { week: withClasses(week, classById), todays, notes, assess, earnings, rosters };
  }, [mon]);

  if (!data) return <Loading />;
  const { week, todays, notes, assess, earnings, rosters } = data;
  const live = week.filter((s) => !s.cancelled_at);
  const dogsToday = todays.reduce((a, s) => a + s.booked, 0);
  const next = todays.find((s) => s.start > now) ?? todays.find((s) => s.end > now);
  const meta = (s: SessionView) => [gym ? trainerName(s.cls.trainer_id) : null, `${s.cls.duration_min} min`, credits(s.cls.credits)].filter(Boolean).join(' · ');
  const opened = live.reduce((a, s) => a + s.packpass_spots, 0);
  const filled = live.reduce((a, s) => a + (s.packpass_spots - s.spots_left), 0);
  const thisMonth = earnings[0];
  const ratings = trainers.map((t) => Number(t.rating)).filter(Boolean);

  const notesDue = notes.filter((n) => !n.note);
  const assessDue = assess.filter((a) => !a.outcome && new Date(a.starts_at) < now);
  const attention: { icon: ReactNode; text: string; action: string; go: () => void }[] = [];
  if (notesDue.length) attention.push({ icon: <NotebookPen size={20} />, text: `${notesDue.length} session note${notesDue.length > 1 ? 's' : ''} due${new Set(notesDue.map((n) => n.session_id)).size === 1 ? ` from ${notesDue[0].class_title}` : ` from ${new Set(notesDue.map((n) => n.session_id)).size} sessions`}.`, action: 'Write notes', go: () => nav('/notes') });
  if (assessDue.length) attention.push({ icon: <ShieldCheck size={20} />, text: `${assessDue.length} assessment result${assessDue.length > 1 ? 's' : ''} to record. ${listNames(assessDue.map((a) => a.dog_name))}${assessDue.length > 1 ? '’s owners are' : '’s owner is'} waiting.`, action: 'Record results', go: () => nav('/assessments') });
  for (const s of live.filter((x) => x.spots_left <= 0 && !x.waitlist_open && x.start > now).slice(0, 2))
    attention.push({ icon: <Users size={20} />, text: `${s.cls.title} on ${weekday(s.start)} is full. The waitlist is closed.`, action: 'Adjust capacity', go: () => nav(`/schedule?s=${s.id}`) });
  for (const { s, dogs } of rosters)
    for (const d of dogs.filter((x) => /expire|missing/i.test(x.vaccine_line)).slice(0, 2))
      attention.push({ icon: <Syringe size={20} color="var(--kennel-red)" />, text: `${d.dog_name}: ${d.vaccine_line.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}. ${d.dog_name} is booked for ${s.cls.title} today.`, action: 'View roster', go: () => nav(`/roster?s=${s.id}`) });

  const stats = [
    { label: 'Dogs booked this week', value: String(live.reduce((a, s) => a + s.booked, 0)), sub: `${live.length} sessions` },
    { label: 'PackPass spots filled', value: opened ? `${Math.round((filled / opened) * 100)}%` : '–', sub: `${filled} of ${opened} opened this week` },
    { label: `Earned in ${monthName(now)}`, value: money(thisMonth?.amount_cents ?? 0), sub: `${thisMonth?.credits ?? 0} credits so far` },
    { label: gym ? 'Average rating' : 'Your rating', value: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '–', sub: gym ? `${trainers.length} trainers` : partner.name },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1240 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">{`${weekday(now)} · ${monthDay(now)} · ${time(now)}`}</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>{todays.length ? `${todays.length} session${todays.length > 1 ? 's' : ''} today. ${dogsToday} dog${dogsToday === 1 ? '' : 's'} booked.` : 'No sessions today.'}</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pk-caption pk-muted">{s.label}</span>
            <span className="pk-display-lg pk-num">{s.value}</span>
            <span className="pk-caption pk-muted">{s.sub}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <section style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="pk-title" style={{ margin: 0 }}>Today</h2>
          {todays.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todays.map((s) => (
                <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'center', padding: '18px 20px', borderRadius: 20, background: 'var(--surface-raised)' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontStretch: '112%', fontSize: 20, letterSpacing: '-.02em', width: 92, flex: 'none' }}>{time(s.start)}</span>
                  <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="pk-heading">{s.cls.title}</span>{s.cls.premium ? <Tag tone="premium">Premium</Tag> : null}</div>
                    <span className="pk-caption pk-muted">{meta(s)}</span>
                  </div>
                  <FillBar s={s} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', marginLeft: 'auto' }}>
                    <Tag>{statusOf(s, now) === 'Upcoming' && s === next ? 'Next up' : statusOf(s, now)}</Tag>
                    <Button variant="quiet" size="sm" onClick={() => nav(`/roster?s=${s.id}`)}>Roster</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty>Nothing on the schedule today. Add a session from Schedule.</Empty>}
        </section>
        <aside style={{ flex: '1 1 300px', maxWidth: 420, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {next ? (
            <div style={{ position: 'relative', height: 340, borderRadius: 28, overflow: 'hidden', color: '#fff' }}>
              <img src={photoUrl(next.cls.image)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
              <div style={{ position: 'absolute', top: 18, left: 18, display: 'flex', gap: 6 }}><Tag tone="glass">{`Next up · ${time(next.start)}`}</Tag></div>
              <div style={{ position: 'absolute', left: 22, right: 22, bottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h2 className="pk-display-lg" style={{ margin: 0 }}>{next.cls.title}</h2>
                  <span className="pk-label" style={{ opacity: 0.92 }}>{`${meta(next)} · ${next.booked} of ${next.packpass_spots} booked`}</span>
                </div>
                <Button variant="glass" onClick={() => nav(`/roster?s=${next.id}`)} style={{ alignSelf: 'flex-start' }}>Open roster</Button>
              </div>
            </div>
          ) : null}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="pk-title" style={{ margin: 0 }}>Needs attention</h2>
            {attention.length ? attention.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 20, background: 'var(--surface-raised)' }}>
                <span style={{ flex: 'none', display: 'flex' }}>{a.icon}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="pk-label" style={{ textWrap: 'pretty' }}>{a.text}</span>
                  <button className="link" onClick={a.go}>{a.action}</button>
                </div>
              </div>
            )) : <Empty>All caught up.</Empty>}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function FillBar({ s, width = 150 }: { s: SessionView; width?: number }) {
  return (
    <div style={{ width, flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="pk-caption" style={{ fontWeight: 600 }}>{fillLabel(s)}</span>
      <span style={{ height: 6, borderRadius: 9999, background: 'var(--surface-sunken)', overflow: 'hidden', display: 'block' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.min(100, (s.booked / Math.max(1, s.packpass_spots)) * 100)}%`, background: 'var(--turf)', borderRadius: 9999 }} />
      </span>
    </div>
  );
}

const listNames = (n: string[]) => (n.length <= 2 ? n.join(' and ') : `${n.slice(0, 2).join(', ')} and ${n.length - 2} more`);
export const Loading = () => <span className="pk-label pk-muted">Loading…</span>;
export const Empty = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: '18px 20px', borderRadius: 20, background: 'var(--surface-raised)' }}><span className="pk-label pk-muted">{children}</span></div>
);
