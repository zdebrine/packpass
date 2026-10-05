import { ArrowDown, Check, Flame } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useContent } from '@/content/context';
import type { PlanCopy, PlanKey } from '@/content/defaults';
import { icon } from '@/content/icons';
import { AREAS, PARTNER_TYPE, creditsLabel, miles, submitWaitlist, useCatalog, when, type Catalog } from '@/lib/catalog';
import { payoff } from '@/lib/payoffs';
import { photoSrc } from '@/lib/photos';
import { APP_LIVE, FOUNDING_PACK_URL } from '@/lib/supabase';
import { traitLabel, useTraits } from '@/lib/traits';
import { Button, Chip, Faq, Heading, Img, PhotoPanel, StoreButtons, Tag } from '@/ui';

/** For owners (the design's "O" screens). Testimonials are left out until founding members have said something. */

/** 'static' is the launch hero (decision 1, Oct 5); 'rotating' is kept so the two can be tested against each other. */
const HERO_VARIANT: 'static' | 'rotating' = 'static';

/** Copy and photos come from useContent() (src/content). */
type Plan = PlanKey;

export function Owners() {
  const { owners: c } = useContent();
  const cat = useCatalog();
  // The matcher's answers and the picked plan, so the founding signup can carry them.
  const [energy, setEnergy] = useState<Energy>('high');
  const [traits, setTraits] = useState<string[]>(['nervous_dogs']);
  const [plan, setPlan] = useState<Plan | null>(null);
  return (
    <>
      <Hero />
      <Match plans={c.plans.items} cat={cat} energy={energy} setEnergy={setEnergy} traits={traits} setTraits={setTraits} />
      <section id="how" className="pp-section">
        <Heading eyebrow={c.how.eyebrow} title={c.how.title} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 40 }}>
          {c.how.steps.map(({ title, body }, k) => (
            <div key={k} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 240, boxSizing: 'border-box' }}>
              <span className="pk-display-2xl" style={{ fontSize: 64, lineHeight: 1 }}>{String(k + 1).padStart(2, '0')}</span>
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
          <Heading eyebrow={c.classes.eyebrow} title={c.classes.title} />
          <p className="pk-body pk-muted" style={{ margin: 0, maxWidth: 380, textWrap: 'pretty' }}>{c.classes.body}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginTop: 40 }}>
          {c.classes.tiles.map(({ label, photo, sub }) => (
            <div key={label} className="pk-tile" style={{ cursor: 'default' }}><Img photo={photo} alt="" /><span className="pk-tile-label">{label}<span className="pk-tile-sub">{sub}</span></span></div>
          ))}
        </div>
      </section>
      <Partners cat={cat} />
      <Passport />
      <section id="pricing" className="pp-section">
        <Heading eyebrow={c.plans.eyebrow} title={c.plans.title}>
          <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{c.plans.body}</p>
        </Heading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginTop: 40 }}>
          {c.plans.items.map(({ name, price, credits, fit, key, popular }) => {
            return (
              <div key={name} data-theme={popular ? 'dark' : 'light'} style={{ background: 'var(--surface-raised)', color: 'var(--ink)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }}>
                  <span className="pk-wide">{name}</span>
                  {popular ? <Tag tone="signal">{c.plans.popularTag}</Tag> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="pk-display-2xl pk-num" style={{ fontSize: 64, lineHeight: 1 }}>{price}</span><span className="pk-label pk-muted">/ month</span></div>
                  <span className="pk-heading">{`${credits} credits a month`}</span>
                  <span className="pk-label pk-muted">{fit}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {c.plans.perks.map((k) => (
                    <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Check size={18} style={{ flex: 'none', marginTop: 1 }} /><span className="pk-label">{k}</span></div>
                  ))}
                </div>
                <div style={{ marginTop: 'auto' }}><Button block href="#get" onClick={() => setPlan(key)}>{`Choose ${name}`}</Button></div>
              </div>
            );
          })}
        </div>
      </section>
      <Faq id="faq" eyebrow={c.faq.eyebrow} rows={c.faq.rows} />
      <section id="get" style={{ padding: 'clamp(72px,9vw,120px) 16px 0' }}>
        <PhotoPanel photo={c.signup.photo} minHeight={520} shade={APP_LIVE ? 'linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.72) 100%)' : 'linear-gradient(90deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.55) 55%,rgba(0,0,0,.2) 100%)'} style={{ alignItems: 'flex-start', gap: 20 }}>
          {APP_LIVE ? (
            <>
              <h2 className="pk-display-2xl" style={{ position: 'relative', margin: 0, maxWidth: 760, fontSize: 'clamp(44px,6vw,88px)', lineHeight: 0.94 }}>{c.signup.liveTitle}</h2>
              <p className="pk-body" style={{ position: 'relative', margin: 0, fontSize: 18, lineHeight: '26px', color: 'rgba(255,255,255,.9)' }}>{c.signup.liveBody}</p>
              <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap' }}><StoreButtons /></div>
            </>
          ) : <FoundingSignup energy={energy} traits={traits} plan={plan} />}
        </PhotoPanel>
      </section>
    </>
  );
}

function Hero() {
  const { hero } = useContent().owners;
  const HERO = hero.slides;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Both variants keep the photos moving; only 'rotating' animates the words.
    const t = setInterval(() => setI((x) => (x + 1) % HERO.length), 3400);
    return () => clearInterval(t);
  }, []);
  return (
    <section style={{ padding: '0 16px' }}>
      {/* The photos cross-fade inside the panel, so the shade comes after them. */}
      <PhotoPanel minHeight="min(820px, calc(100vh - 88px))" shade="transparent">
        {HERO.map((p, k) => (
          <Img key={k} photo={p} alt={k === i ? p.alt : ''} aria-hidden={k !== i}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, opacity: k === i ? 1 : 0, transform: k === i ? 'scale(1)' : 'scale(1.03)', transition: 'opacity 1100ms cubic-bezier(.2,.8,.2,1), transform 3400ms ease-out' }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.3) 0%,rgba(0,0,0,.04) 24%,rgba(0,0,0,.32) 50%,rgba(0,0,0,.8) 100%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span className="pk-wide" style={{ opacity: 0.92 }}>{hero.eyebrow}</span>
          {HERO_VARIANT === 'static' ? (
            <h1 className="pk-display-2xl" style={{ margin: 0, maxWidth: 1000, fontSize: 'clamp(30px,6.4vw,112px)', lineHeight: 0.94, textWrap: 'balance' }}>{hero.headline}</h1>
          ) : (
            <h1 className="pk-display-2xl" style={{ margin: 0, fontSize: 'clamp(30px,6.4vw,112px)', lineHeight: 0.94 }}>
              <span style={{ display: 'block', whiteSpace: 'nowrap' }}>A dog who’s</span>
              <span key={i} style={{ display: 'block', whiteSpace: 'nowrap', animation: 'ppWordIn 800ms cubic-bezier(.2,.8,.2,1) both' }}>{HERO[i]?.line}</span>
            </h1>
          )}
          <p className="pk-body" style={{ margin: 0, maxWidth: 520, fontSize: 18, lineHeight: '26px', color: 'rgba(255,255,255,.9)', textWrap: 'pretty' }}>{hero.body}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            {APP_LIVE ? <StoreButtons /> : <Button href="#get" style={{ minWidth: 200 }}>{hero.cta}</Button>}
            <a href="#match" className="pp-glass" style={{ flex: 'none', marginLeft: 'auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 8px 0 20px', borderRadius: 9999, color: '#fff', textDecoration: 'none' }}>
              <span className="pk-label" style={{ fontWeight: 600 }}>{hero.matchCta}</span>
              <span style={{ width: 36, height: 36, borderRadius: 9999, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDown size={18} /></span>
            </a>
          </div>
        </div>
      </PhotoPanel>
    </section>
  );
}

/** Energy chips by dogs.energy_level value. */
type Energy = 'couch' | 'medium' | 'high' | 'working';
const ENERGIES: [Energy, string][] = [['couch', 'Couch potato'], ['medium', 'Up for anything'], ['high', 'Needs a job'], ['working', 'Never stops']];
/** Trait ids from the catalog (lib/traits), in chip order. */
const TRAIT_CHIPS = ['nervous_dogs', 'rough_play', 'pulls', 'recall', 'jumps', 'barks_visitors', 'settle_public', 'bored_chewing'];
const BALANCE: Record<string, string> = { sport: 'Physical', play: 'Social', scent: 'Mental', skills: 'Mental' };

/**
 * "Matched to your dog": a sample month from the live catalog. The picks follow the design's rules (energy sets
 * how much, traits add skills work, at most 16 credits); the neighborhood sets the distances shown.
 */
function Match({ plans, cat, energy, setEnergy, traits, setTraits }: {
  plans: PlanCopy[]; cat: Catalog; energy: Energy; setEnergy: (e: Energy) => void; traits: string[]; setTraits: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  useTraits(); // re-render with the live labels once the catalog loads
  const { match } = useContent().owners;
  const [hood, setHood] = useState(AREAS[0].label);
  const area = AREAS.find((a) => a.label === hood)!;
  const toggle = (t: string) => setTraits((x) => (x.includes(t) ? x.filter((y) => y !== t) : x.length >= 3 ? x : [...x, t]));

  const month = useMemo(() => {
    const has = (t: string) => traits.includes(t);
    const nervous = has('nervous_dogs') || has('rough_play');
    let ids: string[];
    if (energy === 'couch') ids = ['sniff-space', 'scent-work', nervous ? 'calm-private' : 'open-field'];
    else {
      ids = ['scent-work', 'agility-drop-in', 'open-field', nervous ? 'calm-private' : 'small-group-play'];
      if (energy !== 'medium') ids.push('agility-drop-in');
      if (energy === 'working') ids.push('lure-sprint', 'herding-assessment', 'scent-work');
    }
    // One Focus and Recall however many traits call for it.
    if (has('pulls') || has('recall') || has('jumps') || has('barks_visitors') || has('settle_public')) ids.push('focus-recall');
    if (has('settle_public')) ids.push('sniff-space');
    if (has('bored_chewing')) ids.push('scent-work');
    const rows = ids.map((id) => cat.classes.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c && c.credits != null)
      .map((c) => ({ c, p: cat.partners.find((p) => p.id === c.partner_id) }));
    while (rows.reduce((a, r) => a + r.c.credits!, 0) > 16) rows.pop();
    return rows;
  }, [cat, energy, traits]);
  const total = month.reduce((a, r) => a + r.c.credits!, 0);
  // The smallest plan that covers the month (plans are listed smallest first).
  const plan = plans.find((p) => total <= p.credits) ?? plans[plans.length - 1];
  const left = Math.max(0, plan.credits - total);

  return (
    <section id="match" className="pp-section">
      <Heading eyebrow={match.eyebrow} title={match.title} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 40 }}>
        <div style={{ flex: '3 1 480px', minWidth: 0, boxSizing: 'border-box', background: 'var(--surface-raised)', borderRadius: 28, padding: 'clamp(24px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <Pick n="01" title="Energy">{ENERGIES.map(([k, label]) => <Chip key={k} on={energy === k} onClick={() => setEnergy(k)}>{label}</Chip>)}</Pick>
          <Pick n="02" title="Traits, up to three" right={`${traits.length} of 3`}>{TRAIT_CHIPS.map((t) => <Chip key={t} on={traits.includes(t)} onClick={() => toggle(t)}>{traitLabel(t)}</Chip>)}</Pick>
          <Pick n="03" title="Neighborhood">{AREAS.map((a) => <Chip key={a.label} on={hood === a.label} onClick={() => setHood(a.label)}>{a.label}</Chip>)}</Pick>
        </div>
        <div data-theme="dark" style={{ flex: '2 1 300px', minWidth: 0, boxSizing: 'border-box', background: 'var(--surface-raised)', color: 'var(--ink)', borderRadius: 28, padding: 'clamp(24px,3vw,32px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="pk-wide pk-muted">{`Sample month · ${hood}`}</span>
            <span className="pk-display-md">{`${total} of ${plan.credits} credits`}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
            {month.map(({ c, p }, i) => {
              const mi = p ? miles(area, p) : null;
              const why = payoff(c.discipline);
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', borderRadius: 20, background: 'var(--bg)' }}>
                  <span className="pk-wide" style={{ width: 44, flex: 'none' }}>{`Wk ${Math.floor((i * 4) / month.length) + 1}`}</span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="pk-heading">{c.title}</span>
                    <span className="pk-caption pk-muted">{[p?.short_name, why ? `“${why}”` : BALANCE[c.category], mi != null ? `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi` : null].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className="pk-label pk-num" style={{ whiteSpace: 'nowrap' }}>{creditsLabel(c.credits)}</span>
                </div>
              );
            })}
          </div>
          <span className="pk-label pk-muted" style={{ textWrap: 'pretty' }}>{`${plan.name} plan covers it${left ? `, with ${left} ${left === 1 ? 'credit' : 'credits'} left for anything.` : '.'}`}</span>
          <div style={{ marginTop: 'auto' }}><Button variant="signal" block href="#get">{APP_LIVE ? 'Book this month in the app' : 'Save this month'}</Button></div>
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
  const copy = useContent().owners.partners;
  return (
    <section id="partners" className="pp-section">
      <Heading eyebrow={copy.eyebrow} title={copy.title}>
        <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{copy.body}</p>
      </Heading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginTop: 40 }}>
        {picks.map(({ p, c, at }) => (
          <article key={p.id} style={{ background: 'var(--surface-raised)', borderRadius: 28, padding: '10px 10px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ position: 'relative', height: 260, borderRadius: 20, overflow: 'hidden' }}>
              <img src={photoSrc(c?.image)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
  const { passport: pp } = useContent().owners;
  const { dog } = pp;
  const balance: [string, number, number, string][] = [['Physical', 3, 4, 'var(--agility)'], ['Mental', 2, 3, 'var(--turf)'], ['Social', 1, 2, 'var(--pitch)']];
  return (
    <section id="passport" className="pp-section">
      <div style={{ background: 'var(--surface-raised)', borderRadius: 32, padding: 'clamp(28px,5vw,64px)', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 420px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Heading eyebrow={pp.eyebrow} title={pp.title}>
            <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{pp.body}</p>
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
            {pp.rows.map(({ icon: name, title, body }) => { const Icon = icon(name); return (
              <div key={title} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 18px', borderRadius: 20, background: 'var(--bg)' }}>
                <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 9999, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-heading">{title}</span><span className="pk-label pk-muted">{body}</span></div>
              </div>
            ); })}
          </div>
        </div>
        <div style={{ flex: '0 0 auto', margin: '0 auto' }}>
          <div className="pk-athlete" role="img" aria-label={`${dog.name}'s Athlete Card: ${dog.stats.map((x) => `${x.value} ${x.label}`).join(', ')}`}>
            <Img className="pk-athlete-img" photo={dog.photo} alt="" />
            <div className="pk-athlete-top"><Tag tone="glass">{dog.since}</Tag><Tag tone="glass"><Flame size={12} /> {dog.streak}</Tag></div>
            <div className="pk-athlete-body">
              <h3 className="pk-athlete-name">{dog.name}</h3>
              <p className="pk-athlete-sub">{dog.sub}</p>
              <dl className="pk-athlete-stats">
                {dog.stats.map(({ value: v, label: l }) => <div key={l} className="pk-stat"><dd>{v}</dd><dt>{l}</dt></div>)}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Austin ZIPs (786xx, 787xx). Others still sign up; they hear when PackPass opens near them. */
const inAustin = (zip: string) => /^78[67]\d\d$/.test(zip);

/**
 * Pre-launch signup in place of the store buttons (phase 7). Saves the matcher's answers with the email; with a
 * Founding Pack Payment Link set, it then opens checkout with the email filled in.
 */
function FoundingSignup({ energy, traits, plan }: { energy: Energy; traits: string[]; plan: Plan | null }) {
  useTraits();
  const { signup } = useContent().owners;
  const [email, setEmail] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const paid = !!FOUNDING_PACK_URL;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim(), z = zip.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setError('Enter a valid email.');
    if (!/^\d{5}$/.test(z)) return setError('Enter a 5-digit ZIP code.');
    setBusy(true);
    let saved = true;
    try { await submitWaitlist(em, z, energy, traits, plan); } catch { saved = false; }
    // Checkout goes ahead even if the row didn't save: Stripe has the email.
    if (paid) { window.location.href = `${FOUNDING_PACK_URL}${FOUNDING_PACK_URL.includes('?') ? '&' : '?'}prefilled_email=${encodeURIComponent(em)}`; return; }
    setBusy(false);
    if (!saved) return setError('That didn’t save. Check your connection and try again.');
    setDone(inAustin(z) ? 'You’re in. We’ll email you when booking opens near you.' : 'You’re on the list. We’ll tell you when PackPass opens near you.');
  };
  const chips = [ENERGIES.find(([k]) => k === energy)?.[1], ...traits.map((t) => traitLabel(t))].filter(Boolean) as string[];
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 className="pk-display-2xl" style={{ margin: 0, maxWidth: 760, fontSize: 'clamp(44px,6vw,88px)', lineHeight: 0.94 }}>{signup.foundingTitle}</h2>
      <p className="pk-body" style={{ margin: 0, maxWidth: 560, fontSize: 18, lineHeight: '26px', color: 'rgba(255,255,255,.9)', textWrap: 'pretty' }}>{signup.foundingBody}</p>
      {done ? (
        <p className="pk-heading" role="status" style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'center' }}><Check size={20} />{done}</p>
      ) : (
        <form onSubmit={submit} noValidate className="pp-glass" style={{ width: '100%', maxWidth: 640, borderRadius: 28, padding: 'clamp(16px,2.4vw,24px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {chips.map((c) => <Tag key={c} tone="glass">{c}</Tag>)}
            <a href="#match" className="pk-label" style={{ color: '#fff', fontWeight: 600 }}>Change</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="pk-label" style={{ fontWeight: 600 }}>Email</span>
              <input className="pp-field" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="pk-label" style={{ fontWeight: 600 }}>ZIP code</span>
              <input className="pp-field" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} onChange={(e) => { setZip(e.target.value); setError(''); }} /></label>
          </div>
          {error ? <span className="pk-label" role="alert" style={{ color: '#fff', fontWeight: 600 }}>{error}</span> : null}
          <Button type="submit" variant="signal" block disabled={busy}>{busy ? 'Saving…' : paid ? 'Claim my founding spot' : 'Join the waitlist'}</Button>
        </form>
      )}
    </div>
  );
}
