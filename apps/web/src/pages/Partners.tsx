import {
  Banknote, Calendar, CalendarCheck, CalendarPlus, CircleCheck, CirclePlus, Clock, Coins, Landmark, ShieldCheck, UserPlus, Users, type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { submitLead } from '@/lib/catalog';
import { APPLY_URL } from '@/lib/supabase';
import { Button, Chip, Faq, Heading, PhotoPanel } from '@/ui';

/** "Partner with us" (the design's "P" screens). The partner quote is left out until a real Austin partner says it. */

export const PARTNER_FAQ: [string, string][] = [
  ['What kind of dogs will show up?', 'Dogs with a complete profile: current vaccine records, temperament traits, and notes from past trainers when they have them. Group classes need a Social clearance to book, unless the class is a step on that dog’s training path.'],
  ['Will this undercut my prices?', 'No. Members book with credits, not a discount on your rate. Your public prices stay the same, and you only open the spots you want filled.'],
  ['Do members become my direct clients?', 'Yes, and we hope they do. Anyone can book privates or courses with you directly. PackPass doesn’t restrict it.'],
  ['What does it cost to list?', 'Nothing to list. PackPass pays you a set rate for every credit a member redeems with you.'],
  ['Who sets the credit cost of a session?', 'You propose 1 to 4 credits per session. PackPass reviews it against duration, intensity and group size, the same way for every partner.'],
  ['Can I keep my existing clients?', 'Yes. Members only fill the spots you open to PackPass. Your direct clients and pricing stay yours.'],
  ['When do I get paid?', 'On the 1st of each month, for every credit redeemed the month before, straight to your bank account.'],
  ['What happens when a member no-shows?', 'Late cancellations and no-shows count as redeemed. You’re paid for the spot.'],
  ['How long does approval take?', 'Usually 2 business days once your credentials are uploaded.'],
];

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const UNLOCK = 'packpass-earnings';
const unlockedBefore = () => { try { return localStorage.getItem(UNLOCK) === '1'; } catch { return false; } };

export function Partners() {
  const values: [LucideIcon, string, string][] = [
    [Users, 'Fill the spots you’d leave empty', 'You choose how many spots open to PackPass per session.'],
    [ShieldCheck, 'Vetted dogs only', 'Every dog needs current vaccines, and group classes need a Social clearance. Each one arrives with a profile and any trainer notes.'],
    [Banknote, 'Paid monthly, no chasing', 'A set rate per credit, no-shows included, on the 1st.'],
  ];
  return (
    <>
      <section style={{ padding: '0 16px' }}>
        <PhotoPanel photo="dog_getting_pets_at_park" alt="Dog leaping over a jump" minHeight="min(820px, calc(100vh - 88px))" shade="linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 24%,rgba(0,0,0,.1) 48%,rgba(0,0,0,.8) 100%)">
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 520px', maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span className="pk-wide" style={{ opacity: 0.92 }}>Trainers · Sport clubs · Behavior specialists · Outdoor spaces</span>
              <h1 className="pk-display-2xl" style={{ margin: 0, fontSize: 'clamp(52px,7.4vw,112px)', lineHeight: 0.92 }}>Fill the empty spots in your classes.</h1>
              <p className="pk-body" style={{ margin: 0, maxWidth: 540, fontSize: 18, lineHeight: '26px', color: 'rgba(255,255,255,.9)', textWrap: 'pretty' }}>Vetted local dogs, matched to your classes, for the spots you’d otherwise leave empty. You set the rules. We handle booking and pay you every month.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                <Button href={APPLY_URL} style={{ minWidth: 200 }}>Apply to partner</Button>
                <span className="pk-label" style={{ color: 'rgba(255,255,255,.85)' }}>About 10 minutes. Have your license and insurance ready.</span>
              </div>
            </div>
            <div style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {values.map(([Icon, title, body]) => (
                <div key={title} className="pp-glass" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 20px', borderRadius: 28 }}>
                  <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 9999, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className="pk-heading">{title}</span><span className="pk-label" style={{ color: 'rgba(255,255,255,.85)', textWrap: 'pretty' }}>{body}</span></div>
                </div>
              ))}
            </div>
          </div>
        </PhotoPanel>
      </section>

      <Earnings />

      <section id="control" className="pp-section">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Heading eyebrow="What you control" title="Your space. Your rules." />
          <p className="pk-body pk-muted" style={{ margin: 0, maxWidth: 380, textWrap: 'pretty' }}>Open as many or as few spots to members as you like. Your direct clients and pricing stay yours.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginTop: 40 }}>
          {([
            [ShieldCheck, 'Who can book', 'Require a Herding rating and dogs without it can’t book. Group classes need a Social clearance, except as a step on a dog’s training path. Add level or age notes members see before booking.'],
            [Users, 'Capacity', 'Set spots per session and how many open to members. Waitlists fill cancellations automatically.'],
            [Calendar, 'Schedule', 'Publish recurring classes or one-off sessions. Change them any time and booked members are notified.'],
            [Coins, 'Credits per session', 'Propose 1 to 4 credits based on length and format.'],
            [Clock, 'Cancellation window', 'Members cancel free up to 12 hours before. Later cancels and no-shows are paid to you.'],
            [CalendarCheck, 'Bookings run themselves', 'Rosters, waitlists, reminders and dog profiles in one dashboard.'],
            [UserPlus, 'Your team', 'Add trainers and staff, each with a verified profile.'],
          ] as [LucideIcon, string, string][]).map(([Icon, title, body]) => (
            <div key={title} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 9999, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} /></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><h3 className="pk-heading" style={{ margin: 0 }}>{title}</h3><p className="pk-label pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{body}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="join" className="pp-section">
        <Heading eyebrow="Getting started" title="Apply in 10 minutes. Go live in about 2 business days." />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 40 }}>
          <div style={{ flex: '1 1 440px', background: 'var(--surface-raised)', borderRadius: 28, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              ['Account', 'Name, work email and mobile'], ['Business', 'Name, address and business type'],
              ['Services', 'Sport, scent, play and skills sessions you offer'], ['Credentials', 'License, insurance and trainer certifications'],
              ['Payouts', 'Legal name now; bank and tax details through Stripe once approved'], ['Review', 'Usually 2 business days, then you go live'],
            ].map(([title, body], i) => (
              <div key={title} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 16px', borderRadius: 20 }}>
                <span className="pk-label pk-num" style={{ width: 36, height: 36, flex: 'none', borderRadius: 9999, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{i + 1}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-heading">{title}</span><span className="pk-label pk-muted">{body}</span></div>
              </div>
            ))}
          </div>
          <div id="requirements" style={{ flex: '1 1 440px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Reqs title="Required" icon={CircleCheck} rows={[
              ['Business license or registration', 'State or city registration in your business name.'],
              ['General liability insurance', 'A current certificate covering the space where sessions run.'],
              ['Trainer certification', 'CPDT-KA, KPA CTP, IAABC or equivalent, for each lead trainer. Outdoor-space hosts skip this and add a site photo.'],
            ]} />
            <Reqs title="Optional, shown on your profile" muted icon={CirclePlus} rows={[
              ['Pet first aid and CPR', 'Shown as a badge on your profile and classes.'],
              ['Photos of your space', 'Members book more when they can see where they’re going.'],
            ]} />
          </div>
        </div>
      </section>

      <Faq id="partner-faq" eyebrow="Partner FAQ" rows={PARTNER_FAQ} />

      <section style={{ padding: 'clamp(72px,9vw,120px) 16px 0' }}>
        <PhotoPanel photo="dog_being_patient" minHeight={520} shade="linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.76) 100%)" style={{ alignItems: 'flex-start', gap: 20 }}>
          <h2 className="pk-display-2xl" style={{ position: 'relative', margin: 0, maxWidth: 820, fontSize: 'clamp(44px,6vw,88px)', lineHeight: 0.94 }}>Your next regulars are already nearby.</h2>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Button href={APPLY_URL} style={{ minWidth: 200 }}>Apply to partner</Button>
            <span className="pk-label" style={{ color: 'rgba(255,255,255,.85)' }}>Approval usually takes 2 business days.</span>
          </div>
        </PhotoPanel>
      </section>
    </>
  );
}

const Reqs = ({ title, icon: Icon, rows, muted }: { title: string; icon: LucideIcon; rows: [string, string][]; muted?: boolean }) => (
  <div style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
    <span className={`pk-wide${muted ? ' pk-muted' : ''}`}>{title}</span>
    {rows.map(([t, b]) => (
      <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icon size={20} style={{ flex: 'none', marginTop: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-heading">{t}</span><span className="pk-label pk-muted" style={{ textWrap: 'pretty' }}>{b}</span></div>
      </div>
    ))}
  </div>
);

/** Payouts (always open) and the earnings calculator, which sits behind a short form that saves a lead (P2 "Earnings gate"). */
function Earnings() {
  // Read after the first render, so the prerendered page (always locked) and the browser agree when hydrating.
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => { if (unlockedBefore()) setUnlocked(true); }, []);
  const [sessions, setSessions] = useState(6);
  const [dogs, setDogs] = useState(3);
  const [credits, setCredits] = useState(2);
  const monthly = sessions * (52 / 12) * dogs * credits * 9.5;
  return (
    <>
      <section id="payouts" className="pp-section">
        <Heading eyebrow="How payouts work" title="Found money for spots that earn $0 today." maxWidth={760}>
          <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>$9.50 per credit, so $19 a dog for a typical 2-credit class. No listing fee, no ad spend, and you’re paid for no-shows.</p>
        </Heading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 40 }}>
          {([
            [CalendarPlus, 'A member books', 'They find your session by neighborhood, class type or time.'],
            [Coins, 'Credits are redeemed', 'Each session costs 1 to 4 credits based on length and format.'],
            [Banknote, 'You earn $9.50 each', 'Every credit counts, including late cancels and no-shows.'],
            [Landmark, 'Paid on the 1st', 'Last month’s credits land in your bank account.'],
          ] as [LucideIcon, string, string][]).map(([Icon, title, body], k) => (
            <div key={title} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 44, height: 44, borderRadius: 9999, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} /></span>
                <span className="pk-wide pk-muted">{`0${k + 1}`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><h3 className="pk-title" style={{ margin: 0 }}>{title}</h3><p className="pk-label pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{body}</p></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, background: 'var(--pitch)', color: 'var(--on-pitch)', borderRadius: 28, padding: '24px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span className="pk-heading">Example: Saturday Agility Foundations, 2 credits, 3 PackPass dogs</span>
          <span className="pk-display-md pk-num">2 × 3 × $9.50 = $57</span>
        </div>
      </section>
      {/* Gate and calculator share one grid cell, so the section is as tall as whichever is taller. */}
      <div id="earnings" style={{ display: 'grid' }}>
      {unlocked ? null : <Gate onDone={() => { setUnlocked(true); try { localStorage.setItem(UNLOCK, '1'); } catch { /* private mode */ } }} />}
      <div aria-hidden={!unlocked} inert={!unlocked} style={unlocked ? { gridArea: '1 / 1' } : { gridArea: '1 / 1', filter: 'blur(14px)', pointerEvents: 'none', userSelect: 'none', maxHeight: 900, overflow: 'hidden' }}>
          <section className="pp-section">
            <Heading eyebrow="Earnings calculator" title="See what your schedule could earn." />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 40 }}>
              <div style={{ flex: '3 1 460px', background: 'var(--surface-raised)', borderRadius: 28, padding: 'clamp(24px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 32 }}>
                {([['Sessions per week', sessions, setSessions, 1, 30], ['PackPass dogs per session', dogs, setDogs, 1, 16], ['Credits per session', credits, setCredits, 1, 4]] as const).map(([label, value, set, min, max]) => (
                  <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}><span className="pk-heading">{label}</span><span className="pk-display-md pk-num">{value}</span></div>
                    <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => set(+e.target.value)} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="pk-caption pk-muted">{min}</span><span className="pk-caption pk-muted">{max}</span></div>
                  </label>
                ))}
              </div>
              <div style={{ flex: '2 1 320px', background: 'var(--agility)', color: 'var(--on-agility)', borderRadius: 28, padding: 'clamp(24px,3vw,36px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
                <span className="pk-wide">Estimated monthly payout</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
                  <span className="pk-display-2xl pk-num" style={{ fontSize: 'clamp(56px,6vw,88px)', lineHeight: 1 }}>{usd(monthly)}</span>
                  <span className="pk-heading pk-num">{`${usd(monthly * 12)} a year · ${Math.round(sessions * (52 / 12) * dogs).toLocaleString('en-US')} dog visits a month`}</span>
                </div>
                <p className="pk-caption" style={{ margin: 0, textWrap: 'pretty' }}>Estimate at $9.50 per credit and 4.33 weeks a month. Actual payouts depend on bookings and attendance. On top of what your direct clients already pay you.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
      <section id="clients" className="pp-section">
        <Heading eyebrow="Grow your client list" title="Today’s drop-in. Tomorrow’s private client.">
          <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>Members try your class with zero risk. When their dog needs more, they can book privates or courses with you directly. PackPass never restricts it and never takes a cut of your direct business.</p>
        </Heading>
      </section>
    </>
  );
}

function Gate({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState('Trainer');
  const [f, setF] = useState({ name: '', biz: '', email: '', zip: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setError(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.biz.trim()) return setError('Add your name and business name.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError('Enter a valid work email.');
    if (!/^\d{5}$/.test(f.zip.trim())) return setError('Enter a 5-digit ZIP code.');
    setBusy(true);
    // The estimate opens even if saving fails (offline, say): it's the visitor's, not ours.
    try { await submitLead(type, f.name.trim(), f.biz.trim(), f.email.trim(), f.zip.trim()); } catch { /* opened anyway */ }
    setBusy(false);
    onDone();
  };
  const input = (k: keyof typeof f, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span className="pk-label" style={{ fontWeight: 600 }}>{label}</span><input className="pp-field" value={f[k]} onChange={set(k)} {...extra} /></label>
  );
  return (
    <div style={{ gridArea: '1 / 1', position: 'relative', zIndex: 5, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(72px,9vw,120px) clamp(20px,4vw,40px) 0', boxSizing: 'border-box', background: 'linear-gradient(180deg,rgba(14,15,14,.55) 0%,rgba(14,15,14,.35) 60%,var(--bg) 100%)' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', borderRadius: 32, boxShadow: 'var(--shadow-float)', padding: 'clamp(24px,4vw,40px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">Earnings calculator</span>
          <h2 className="pk-display-xl" style={{ margin: 0, fontSize: 'clamp(32px,3.6vw,44px)', lineHeight: 1 }}>See what your schedule could earn.</h2>
          <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>Tell us about your business and we’ll open the calculator.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="pk-label" style={{ fontWeight: 600 }}>You run a</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{['Trainer', 'Sport club', 'Behavior specialist', 'Outdoor space'].map((t) => <Chip key={t} on={type === t} onClick={() => setType(t)}>{t}</Chip>)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          {input('name', 'Your name', { autoComplete: 'name' })}
          {input('biz', 'Business name', { autoComplete: 'organization' })}
          {input('email', 'Work email', { type: 'email', autoComplete: 'email' })}
          {input('zip', 'ZIP code', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 5 })}
        </div>
        {error ? <span className="pk-label" role="alert" style={{ color: 'var(--kennel-red)' }}>{error}</span> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button type="submit" block disabled={busy}>{busy ? 'Opening…' : 'See my earnings'}</Button>
          <span className="pk-caption pk-muted" style={{ textAlign: 'center' }}>A partner lead may follow up. No commitment to apply.</span>
        </div>
      </form>
    </div>
  );
}
