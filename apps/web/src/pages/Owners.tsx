import { ArrowDown, Check, Flame, Stamp, TrendingUp, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AREAS, PARTNER_TYPE, creditsLabel, miles, useCatalog, when, type Catalog } from '@/lib/catalog';
import { Button, Chip, Faq, Heading, PhotoPanel, StoreButtons, Tag } from '@/ui';

/** For owners (the design's "O" screens). Testimonials are left out until founding members have said something. */

const HERO: [string, string, string][] = [
  ['an athlete.', 'sprint', 'Dog sprinting across a field'], ['an explorer.', 'leap', 'Dog leaping through a field'],
  ['a good listener.', 'hurdle', 'Dog clearing a jump on cue'], ['a social butterfly.', 'tunnel', 'Dog running through a tunnel'],
  ['a problem solver.', 'weave', 'Dog weaving through poles'], ['a scent detective.', 'grass', 'Dog sniffing through tall grass'],
];

export const OWNER_FAQ: [string, string][] = [
  ['How do credits work?', 'Your plan adds credits on the same day each month. Every session shows its cost before you book, open play is 1, a group drop-in is 2, a 1:1 with a specialist is 3 to 4.'],
  ['Do unused credits roll over?', 'Unused credits roll into the next month, capped at one month of credits.'],
  ['Can I cancel a booking?', 'Cancel at least 12 hours before the start and the credits go back to your balance. Late cancellations and no-shows use the credits.'],
  ['What does my dog need to join?', 'Current rabies, DHPP and Bordetella records, uploaded once to your dog’s profile. Some classes list extra requirements like a level or minimum age.'],
  ['Can I pause or cancel my plan?', 'Pause for up to 2 months or cancel anytime in the app. Your plan runs to the end of the billing period.'],
  ['My dog is reactive. Can we still join?', 'Yes. Reactive-dog drop-ins and 1:1 specialists are filtered by your dog’s profile, so you only see sessions that fit.'],
  ['Is PackPass outside Austin?', 'Not yet. Join the waitlist with your ZIP code and we’ll tell you when PackPass opens near you.'],
];

export const PLANS: [string, string, number, string][] = [
  ['Starter', '$79', 6, '3 group drop-ins a month'],
  ['Regular', '$129', 10, 'A drop-in most weeks plus a skills session'],
  ['Working Dog', '$189', 16, 'High-energy dogs out about twice a week'],
];

export function Owners() {
  const cat = useCatalog();
  return (
    <>
      <Hero />
      <Match cat={cat} />
      <section id="how" className="pp-section">
        <Heading eyebrow="How it works" title="One membership. A full month of enrichment for your dog." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 40 }}>
          {[
            ['01', 'Tell us about your dog', 'Energy, play style and traits. We match the classes and specialists that fit.'],
            ['02', 'Book a balanced month', 'Drop in to agility, scent work, open fields and skills. No 6-week commitment.'],
            ['03', 'Watch the Passport fill', 'Every session stamps the Passport and counts toward a month that’s physical, mental and social.'],
          ].map(([n, title, body]) => (
            <div key={n} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 240, boxSizing: 'border-box' }}>
              <span className="pk-display-2xl" style={{ fontSize: 64, lineHeight: 1 }}>{n}</span>
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 className="pk-title" style={{ margin: 0 }}>{title}</h3>
                <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section id="classes" className="pp-section">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Heading eyebrow="Classes" title="Train for anything." />
          <p className="pk-body pk-muted" style={{ margin: 0, maxWidth: 380, textWrap: 'pretty' }}>Mix disciplines week to week. Every session lists its level, spots left and credit cost before you book.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginTop: 40 }}>
          {[['Agility', 'weave'], ['Scent work', 'grass'], ['Sprint and lure', 'sprint'], ['Herding', 'collie'], ['Open field', 'leap'], ['Sniff spaces', 'wall'], ['Recall and focus', 'hurdle'], ['Reactive dog drop-ins', 'rail']].map(([label, p]) => (
            <div key={label} className="pk-tile" style={{ cursor: 'default' }}><img src={`/photos/${p}.jpg`} alt="" /><span className="pk-tile-label">{label}</span></div>
          ))}
        </div>
      </section>
      <Partners cat={cat} />
      <Passport />
      <section id="pricing" className="pp-section">
        <Heading eyebrow="Plans" title="Pick a plan. Change it any month.">
          <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>Most sessions cost 1 to 4 credits depending on length and format. A typical group class is 2.</p>
        </Heading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginTop: 40 }}>
          {PLANS.map(([name, price, credits, fit]) => {
            const popular = name === 'Regular';
            return (
              <div key={name} data-theme={popular ? 'dark' : 'light'} style={{ background: 'var(--surface-raised)', color: 'var(--ink)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }}>
                  <span className="pk-wide">{name}</span>
                  {popular ? <Tag tone="signal">Most popular</Tag> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="pk-display-2xl pk-num" style={{ fontSize: 64, lineHeight: 1 }}>{price}</span><span className="pk-label pk-muted">/ month</span></div>
                  <span className="pk-heading">{`${credits} credits a month`}</span>
                  <span className="pk-label pk-muted">{fit}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Any partner, any discipline', 'Free cancel up to 12 hours before', 'One month rollover'].map((k) => (
                    <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Check size={18} style={{ flex: 'none', marginTop: 1 }} /><span className="pk-label">{k}</span></div>
                  ))}
                </div>
                <div style={{ marginTop: 'auto' }}><Button block href="#get">{`Choose ${name}`}</Button></div>
              </div>
            );
          })}
        </div>
      </section>
      <Faq id="faq" eyebrow="FAQ" rows={OWNER_FAQ} />
      <section id="get" style={{ padding: 'clamp(72px,9vw,120px) 16px 0' }}>
        <PhotoPanel photo="tunnel" minHeight={520} shade="linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.72) 100%)" style={{ alignItems: 'flex-start', gap: 20 }}>
          <h2 className="pk-display-2xl" style={{ position: 'relative', margin: 0, maxWidth: 760, fontSize: 'clamp(44px,6vw,88px)', lineHeight: 0.94 }}>Book your dog’s first drop-in this week.</h2>
          <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap' }}><StoreButtons /></div>
        </PhotoPanel>
      </section>
    </>
  );
}

function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % HERO.length), 3400);
    return () => clearInterval(t);
  }, []);
  return (
    <section style={{ padding: '0 16px' }}>
      {/* The photos cross-fade inside the panel, so the shade comes after them. */}
      <PhotoPanel minHeight="min(820px, calc(100vh - 88px))" shade="transparent">
        {HERO.map(([, p, alt], k) => (
          <img key={p} src={`/photos/${p}.jpg`} alt={k === i ? alt : ''} aria-hidden={k !== i}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, opacity: k === i ? 1 : 0, transform: k === i ? 'scale(1)' : 'scale(1.03)', transition: 'opacity 1100ms cubic-bezier(.2,.8,.2,1), transform 3400ms ease-out' }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.3) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,.08) 50%,rgba(0,0,0,.74) 100%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span className="pk-wide" style={{ opacity: 0.92 }}>Sport · Scent · Play · Skills · Austin</span>
          <h1 className="pk-display-2xl" style={{ margin: 0, fontSize: 'clamp(30px,6.4vw,112px)', lineHeight: 0.94 }}>
            <span style={{ display: 'block', whiteSpace: 'nowrap' }}>Every dog is</span>
            <span key={i} style={{ display: 'block', whiteSpace: 'nowrap', animation: 'ppWordIn 800ms cubic-bezier(.2,.8,.2,1) both' }}>{HERO[i][0]}</span>
          </h1>
          <p className="pk-body" style={{ margin: 0, maxWidth: 520, fontSize: 18, lineHeight: '26px', color: 'rgba(255,255,255,.9)', textWrap: 'pretty' }}>Drop-in agility, scent work, open fields and skill classes across Austin. Tell us about your dog and we’ll build their month.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <StoreButtons />
            <a href="#match" className="pp-glass" style={{ flex: 'none', marginLeft: 'auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 8px 0 20px', borderRadius: 9999, color: '#fff', textDecoration: 'none' }}>
              <span className="pk-label" style={{ fontWeight: 600 }}>Build my dog’s month</span>
              <span style={{ width: 36, height: 36, borderRadius: 9999, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDown size={18} /></span>
            </a>
          </div>
        </div>
      </PhotoPanel>
    </section>
  );
}

const ENERGIES = ['Couch', 'Medium', 'High', 'Working dog'];
const TRAITS = ['Nervous with new dogs', 'Plays too rough', 'Pulls on the leash', 'Slow to come when called', 'Jumps up on people', 'Barks at visitors'];
const BALANCE: Record<string, string> = { sport: 'Physical', play: 'Social', scent: 'Mental', skills: 'Mental' };

/**
 * "Matched to your dog": a sample month from the live catalog. The picks follow the design's rules (energy sets
 * how much, traits add skills work, at most 16 credits); the neighborhood sets the distances shown.
 */
function Match({ cat }: { cat: Catalog }) {
  const [energy, setEnergy] = useState('High');
  const [traits, setTraits] = useState<string[]>(['Nervous with new dogs']);
  const [hood, setHood] = useState(AREAS[0].label);
  const area = AREAS.find((a) => a.label === hood)!;
  const toggle = (t: string) => setTraits((x) => (x.includes(t) ? x.filter((y) => y !== t) : x.length >= 3 ? x : [...x, t]));

  const month = useMemo(() => {
    const has = (t: string) => traits.includes(t);
    const nervous = has('Nervous with new dogs') || has('Plays too rough');
    let ids: string[];
    if (energy === 'Couch') ids = ['sniff-space', 'scent-work', nervous ? 'calm-private' : 'open-field'];
    else {
      ids = ['scent-work', 'agility-drop-in', 'open-field', nervous ? 'calm-private' : 'small-group-play'];
      if (energy !== 'Medium') ids.push('agility-drop-in');
      if (energy === 'Working dog') ids.push('lure-sprint', 'herding-assessment', 'scent-work');
    }
    if (has('Slow to come when called') || has('Pulls on the leash') || has('Jumps up on people') || has('Barks at visitors')) ids.push('focus-recall');
    const rows = ids.map((id) => cat.classes.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c && c.credits != null)
      .map((c) => ({ c, p: cat.partners.find((p) => p.id === c.partner_id) }));
    while (rows.reduce((a, r) => a + r.c.credits!, 0) > 16) rows.pop();
    return rows;
  }, [cat, energy, traits]);
  const total = month.reduce((a, r) => a + r.c.credits!, 0);
  const plan = total <= 6 ? PLANS[0] : total <= 10 ? PLANS[1] : PLANS[2];
  const left = plan[2] - total;

  return (
    <section id="match" className="pp-section">
      <Heading eyebrow="Matched to your dog" title="Describe your dog once. Get the right month." />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 40 }}>
        <div style={{ flex: '3 1 480px', minWidth: 0, boxSizing: 'border-box', background: 'var(--surface-raised)', borderRadius: 28, padding: 'clamp(24px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <Pick n="01" title="Energy">{ENERGIES.map((e) => <Chip key={e} on={energy === e} onClick={() => setEnergy(e)}>{e}</Chip>)}</Pick>
          <Pick n="02" title="Traits, up to three" right={`${traits.length} of 3`}>{TRAITS.map((t) => <Chip key={t} on={traits.includes(t)} onClick={() => toggle(t)}>{t}</Chip>)}</Pick>
          <Pick n="03" title="Neighborhood">{AREAS.map((a) => <Chip key={a.label} on={hood === a.label} onClick={() => setHood(a.label)}>{a.label}</Chip>)}</Pick>
        </div>
        <div data-theme="dark" style={{ flex: '2 1 300px', minWidth: 0, boxSizing: 'border-box', background: 'var(--surface-raised)', color: 'var(--ink)', borderRadius: 28, padding: 'clamp(24px,3vw,32px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="pk-wide pk-muted">{`Sample month · ${hood}`}</span>
            <span className="pk-display-md">{`${total} of ${plan[2]} credits`}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
            {month.map(({ c, p }, i) => {
              const mi = p ? miles(area, p) : null;
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', borderRadius: 20, background: 'var(--bg)' }}>
                  <span className="pk-wide" style={{ width: 44, flex: 'none' }}>{`Wk ${Math.floor((i * 4) / month.length) + 1}`}</span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="pk-heading">{c.title}</span>
                    <span className="pk-caption pk-muted">{[p?.short_name, BALANCE[c.category], mi != null ? `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi` : null].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className="pk-label pk-num" style={{ whiteSpace: 'nowrap' }}>{creditsLabel(c.credits)}</span>
                </div>
              );
            })}
          </div>
          <span className="pk-label pk-muted" style={{ textWrap: 'pretty' }}>{`${plan[0]} plan covers it${left ? `, with ${left} ${left === 1 ? 'credit' : 'credits'} left for anything.` : '.'}`}</span>
          <div style={{ marginTop: 'auto' }}><Button variant="signal" block href="#get">Get the app to book it</Button></div>
        </div>
      </div>
    </section>
  );
}

const Pick = ({ n, title, right, children }: { n: string; title: string; right?: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}><span className="pk-wide pk-muted">{n}</span><span className="pk-heading" style={{ flex: 1 }}>{title}</span>{right ? <span className="pk-caption pk-muted">{right}</span> : null}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
  </div>
);

/** Three partners with the soonest open sessions (live), else the first three. */
function Partners({ cat }: { cat: Catalog }) {
  const picks = useMemo(() => {
    const seen = new Set<string>();
    const out: { p: Catalog['partners'][number]; c?: Catalog['classes'][number]; at?: string }[] = [];
    for (const s of cat.sessions) {
      const c = cat.classes.find((x) => x.id === s.class_id);
      const p = c && cat.partners.find((x) => x.id === c.partner_id);
      if (!p || seen.has(p.id) || c.session_type === 'assessment') continue;
      seen.add(p.id); out.push({ p, c, at: s.starts_at });
      if (out.length === 3) break;
    }
    for (const p of cat.partners) {
      if (out.length >= 3) break;
      if (!seen.has(p.id)) { seen.add(p.id); out.push({ p, c: cat.classes.find((x) => x.partner_id === p.id) }); }
    }
    return out;
  }, [cat]);
  return (
    <section id="partners" className="pp-section">
      <Heading eyebrow="Partners near you" title="Verified trainers, sport clubs and open spaces." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginTop: 40 }}>
        {picks.map(({ p, c, at }) => (
          <article key={p.id} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: '10px 10px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ position: 'relative', height: 260, borderRadius: 20, overflow: 'hidden' }}>
              <img src={`/photos/${c?.image || 'grass'}.jpg`} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim-top)' }} />
              <div style={{ position: 'absolute', top: 14, left: 14 }}><Tag tone="glass">Verified</Tag></div>
            </div>
            <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3 className="pk-display-md" style={{ margin: 0 }}>{p.name}</h3>
              <span className="pk-label pk-muted">{`${PARTNER_TYPE[p.type] ?? 'Partner'} · ${p.street}`}</span>
            </div>
            {c ? (
              <div style={{ margin: '0 14px', padding: '14px 16px', borderRadius: 20, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="pk-caption pk-muted">{at ? 'Next session' : 'Classes'}</span>
                  <span className="pk-label" style={{ fontWeight: 600 }}>{at ? `${when(at)} · ${c.title}` : c.title}</span>
                </div>
                <span className="pk-label pk-num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{creditsLabel(c.credits)}</span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Passport() {
  const rows: [LucideIcon, string, string][] = [
    [Stamp, 'Stamps for every class', '38 classes across 6 disciplines'],
    [TrendingUp, 'Levels set by trainers', 'Agility Level 3, Scent Work Level 1'],
    [Flame, 'Weekly streaks', 'Book once a week to keep it going'],
  ];
  const balance: [string, number, number, string][] = [['Physical', 3, 4, 'var(--agility)'], ['Mental', 2, 3, 'var(--turf)'], ['Social', 1, 2, 'var(--pitch)']];
  return (
    <section id="passport" className="pp-section">
      <div style={{ background: 'var(--surface-raised)', borderRadius: 32, padding: 'clamp(28px,5vw,64px)', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 420px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Heading eyebrow="Dog Passport" title="Juno’s record, class by class.">
            <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>Every session stamps your dog’s Passport. Trainers log levels and notes, so the next coach knows where to start.</p>
          </Heading>
          <div style={{ background: 'var(--bg)', borderRadius: 20, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="pk-heading">This month’s balance</span><span className="pk-caption pk-muted">Resets on the 1st</span></div>
            {balance.map(([label, n, of, c]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr) 48px', gap: 12, alignItems: 'center' }}>
                <span className="pk-label">{label}</span>
                <span style={{ height: 8, borderRadius: 9999, background: 'var(--surface-sunken)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(n / of) * 100}%`, background: c, borderRadius: 9999 }} /></span>
                <span className="pk-caption pk-muted pk-num" style={{ textAlign: 'right' }}>{`${n} of ${of}`}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(([Icon, title, body]) => (
              <div key={title} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 18px', borderRadius: 20, background: 'var(--bg)' }}>
                <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 9999, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-heading">{title}</span><span className="pk-label pk-muted">{body}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '0 0 auto', margin: '0 auto' }}>
          <div className="pk-athlete" role="img" aria-label="Juno's Athlete Card: 38 classes, 6 disciplines, Agility level 3">
            <img className="pk-athlete-img" src="/photos/juno.jpg" alt="" />
            <div className="pk-athlete-top"><Tag tone="glass">Since Mar 2026</Tag><Tag tone="glass"><Flame size={12} /> 12 wk streak</Tag></div>
            <div className="pk-athlete-body">
              <h3 className="pk-athlete-name">Juno</h3>
              <p className="pk-athlete-sub">Border Collie · 3 yrs</p>
              <dl className="pk-athlete-stats">
                {[['38', 'Classes'], ['6', 'Disciplines'], ['L3', 'Agility']].map(([v, l]) => <div key={l} className="pk-stat"><dd>{v}</dd><dt>{l}</dt></div>)}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
