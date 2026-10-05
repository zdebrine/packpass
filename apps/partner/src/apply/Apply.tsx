import { Banknote, CalendarPlus, Check, ChevronLeft, FileText, FileUp, Loader, Rocket, ShieldCheck, Upload, Users, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  accountName, errorCopy, loadMyApplication, removeApplicationDoc, saveApplication, signOut, submitApplication, uploadApplicationDoc,
  type Application, type DocKind, type PartnerType,
} from '@/lib/api';
import { Button, Chip, ErrorLine, Tag } from '@/ui/kit';

/**
 * Partner application (project/Pack Partner Onboarding.dc.html). Step 1, the account, happens on the sign-in
 * page (Create an account); this is steps 2 to 5 and the in-review screen, for a signed-in account that isn't
 * on a partner's team. Each Continue saves, so "Save and finish later" just signs out. The design's bank
 * connection and tax ID wait for Stripe Connect, which collects them itself after approval.
 */

const INTENT = 'packpass-apply';
/** Set before creating an account to apply, so the flow opens at Business instead of the welcome screen. */
export const markApplying = () => { try { sessionStorage.setItem(INTENT, '1'); } catch { /* private mode */ } };
const applying = () => { try { return sessionStorage.getItem(INTENT) === '1'; } catch { return false; } };

const STEPS = ['Account', 'Business', 'Services', 'Credentials', 'Payouts'];
const PHOTOS = ['leap', 'weave', 'rail', 'grass', 'hurdle', 'lab', 'sprint'];
const SIDE = ['', 'PackPass members book with monthly credits. You get paid for every one they spend with you.',
  'Members search by neighborhood. Your address puts you on their map.',
  'Dogs come to PackPass for sport, scent, play and skills. Show up for all of it.',
  'Verified partners carry a badge on every class and profile.',
  'Paid on the 1st of every month. No invoices to chase.',
  'Most partners publish their first class the week they’re approved.'];
const TYPES: [PartnerType, string][] = [['trainer', 'Independent trainer'], ['facility', 'Training facility'], ['sport_club', 'Dog sport club'], ['behavior_specialist', 'Behavior specialist'], ['outdoor_space', 'Outdoor space']];
const WHERES = ['At my facility', 'Outdoors', 'At members’ homes'];
const OFFERS = ['Agility', 'Scent work', 'Sprint and lure', 'Herding', 'Dock diving', 'Open play', 'Fitness and conditioning', 'Recall', 'Reactivity', 'Puppy foundations', 'Behavior consult'];
const FORMATS = ['Group drop-in', 'Small group', 'Private', 'Open session'];
const SIZES = ['1 to 4', '5 to 8', '9 to 12', '13 or more'];
const DOCS: { kind: DocKind; name: string; desc: string; multi: boolean }[] = [
  { kind: 'license', name: 'Business license or registration', desc: 'State or city registration in your business name.', multi: false },
  { kind: 'insurance', name: 'Liability insurance certificate', desc: 'Current general liability policy with your business as the named insured.', multi: false },
  { kind: 'certs', name: 'Trainer certifications', desc: 'CPDT-KA, IAABC, KPA-CTP, AKC CGC Evaluator, NDGAA or equivalent. One per trainer.', multi: true },
  { kind: 'firstaid', name: 'Pet first aid and CPR', desc: 'Shown on your profile once verified.', multi: false },
  { kind: 'photos', name: 'Photos of your space', desc: 'Shown on your classes so members know where they’re going.', multi: true },
];
const docsFor = (type: PartnerType | null) => DOCS.filter((d) => !(type === 'outdoor_space' && d.kind === 'certs')).map((d) =>
  type === 'outdoor_space' && d.kind === 'photos' ? { ...d, req: true, desc: 'Required for outdoor spaces. Members see the site before they book.' }
    : { ...d, req: d.kind === 'license' || d.kind === 'insurance' || d.kind === 'certs' });

const glass = { background: 'var(--glass)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' } as const;
const inputStyle = { height: 52, border: 0, borderRadius: 9999, background: 'var(--surface-raised)', padding: '0 20px', fontSize: 16, boxSizing: 'border-box', width: '100%', color: 'var(--ink)' } as const;
const kb = (n: number | null) => (n == null ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The full-photo welcome: shown signed out (from the sign-in page) and to a signed-in account with no application. */
export function ApplyWelcome({ onStart, onSignIn, signedIn }: { onStart: () => void; onSignIn: () => void; signedIn: boolean }) {
  const values: [LucideIcon, string, string][] = [
    // Cards 1 and 2 match the website's partner hero (apps/web/src/pages/Partners.tsx).
    [Users, 'Fill the spots you’d leave empty', 'You choose how many spots open to PackPass per session.'],
    [ShieldCheck, 'Vetted dogs only', 'Every dog needs current vaccines, and group classes need a Social clearance. Each one arrives with a profile and any trainer notes.'],
    [Banknote, '$9.50 per credit', 'No-shows included, paid on the 1st. On top of what your direct clients pay you.'],
  ];
  return (
    <div data-theme="dark" style={{ minHeight: '100vh', padding: 16, boxSizing: 'border-box', display: 'flex', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 640, borderRadius: 32, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32, padding: '32px 40px 40px', boxSizing: 'border-box', color: '#fff' }}>
        <img src="/photos/leap.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,.1) 45%,rgba(0,0,0,.8) 100%)' }} />
        <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Brand />
          <Button variant="glass" size="sm" onClick={onSignIn}>{signedIn ? 'Sign out' : 'Sign in'}</Button>
        </header>
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 520px', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="pk-wide" style={{ opacity: 0.9 }}>Trainers · Sport clubs · Behavior specialists · Outdoor spaces</span>
            <h1 className="pk-display-2xl" style={{ margin: 0, fontSize: 'clamp(48px, 7vw, 84px)', lineHeight: 0.94, textWrap: 'balance' }}>Fill the empty spots in your classes.</h1>
            <p className="pk-body" style={{ margin: 0, maxWidth: 520, color: 'rgba(255,255,255,.88)', textWrap: 'pretty' }}>Vetted local dogs, matched to your classes, for the spots you’d otherwise leave empty. You set the rules. We handle booking and pay you every month.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              <Button onClick={onStart} style={{ minWidth: 220 }}>Apply to partner</Button>
              <span className="pk-label" style={{ color: 'rgba(255,255,255,.82)' }}>About 10 minutes. Have your license and insurance ready.</span>
            </div>
            {signedIn ? <span className="pk-caption" style={{ color: 'rgba(255,255,255,.75)' }}>Added to a team instead? This account isn’t on it yet. Ask the owner to check they used this account’s email.</span> : null}
          </div>
          <div style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {values.map(([Icon, title, body]) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 20px', borderRadius: 28, ...glass }}>
                <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 9999, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className="pk-heading">{title}</span><span className="pk-label" style={{ color: 'rgba(255,255,255,.82)', textWrap: 'pretty' }}>{body}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Brand = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
    <span className="pk-wide" style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>PackPass</span>
    <span className="pk-wide" style={{ height: 28, padding: '0 12px', borderRadius: 9999, ...glass, display: 'flex', alignItems: 'center', fontSize: 11, whiteSpace: 'nowrap' }}>For partners</span>
  </div>
);

/** A signed-in account that isn't staff: welcome, the steps, or the in-review screen. */
export function Apply() {
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const reload = async () => { const a = await loadMyApplication(); setApp(a); return a; };
  useEffect(() => {
    Promise.all([accountName().catch(() => ''), reload()]).then(([n, a]) => {
      setName(n);
      if (a?.status === 'submitted' || a?.status === 'approved') setStep(6);
      else if (a || applying()) setStep(2);
    }).catch(() => setApp(null)).finally(() => setReady(true));
  }, []);
  if (!ready || app === undefined) return null;
  if (step === 0) return <ApplyWelcome signedIn onSignIn={() => signOut()} onStart={() => setStep(2)} />;
  return <Flow app={app} name={name} step={step} setStep={(n) => { setStep(n); window.scrollTo(0, 0); }} reload={reload} />;
}

function Flow({ app, name, step, setStep, reload }: { app: Application | null; name: string; step: number; setStep: (n: number) => void; reload: () => Promise<Application | null> }) {
  const [f, setF] = useState(() => ({
    contact_name: app?.contact_name ?? name, phone: app?.phone ?? '', partner_type: app?.partner_type ?? null as PartnerType | null,
    business_name: app?.business_name ?? '', address: app?.address ?? '', website: app?.website ?? '',
    wheres: app?.wheres ?? [], services: app?.services ?? [], formats: app?.formats ?? [], group_size: app?.group_size ?? null as string | null,
    legal_name: app?.legal_name ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'wheres' | 'services' | 'formats', v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);

  const docs = docsFor(f.partner_type);
  const have = (k: DocKind) => (app?.docs ?? []).some((d) => d.kind === k);
  const reqDocs = docs.filter((d) => d.req);
  const reqDone = reqDocs.filter((d) => have(d.kind)).length;
  const blocked = step === 2 ? !(f.contact_name.trim() && f.partner_type && f.business_name.trim() && f.address.trim().length > 5)
    : step === 3 ? f.services.length === 0
    : step === 4 ? reqDone < reqDocs.length
    : step === 5 ? !f.legal_name.trim() : false;
  const notes = ['', '', 'You can edit these details any time.', 'You can change services later from your profile.',
    reqDone === reqDocs.length ? 'All required documents are in.' : 'Upload every required document to continue.', 'Your application goes to the partner team next.'];

  const fields = (n: number) => n === 2 ? { contact_name: f.contact_name, phone: f.phone, partner_type: f.partner_type, business_name: f.business_name, address: f.address, website: f.website, wheres: f.wheres }
    : n === 3 ? { services: f.services, formats: f.formats, group_size: f.group_size }
    : n === 5 ? { legal_name: f.legal_name } : {};
  const save = async (n: number) => { if (n >= 2 && n <= 5 && n !== 4) await saveApplication(fields(n)); };
  const next = async () => {
    setBusy(true); setError(null);
    try {
      await save(step);
      if (step === 5) { await submitApplication(); await reload(); }
      setStep(step + 1);
    } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const later = async () => {
    setBusy(true);
    try { if (step <= 5) await save(step); } catch { /* signed out either way; the last Continue saved */ }
    await signOut();
  };

  const submitted = step === 6;
  return (
    <div data-theme="dark" style={{ minHeight: '100vh', padding: 16, boxSizing: 'border-box', display: 'flex', gap: 16, background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <aside style={{ flex: '0 0 40%', maxWidth: 600, position: 'sticky', top: 16, height: 'calc(100vh - 32px)', minHeight: 640, borderRadius: 32, overflow: 'hidden', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px 32px 32px', boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', inset: 0, background: `#222322 center/cover no-repeat url("/photos/${PHOTOS[step]}.jpg")` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,0) 24%,rgba(0,0,0,0) 40%,rgba(0,0,0,.72) 100%)' }} />
        <div style={{ position: 'relative' }}><Brand /></div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 className="pk-display-lg" style={{ margin: 0, textWrap: 'balance' }}>{SIDE[step]}</h2>
          <div style={{ padding: 10, borderRadius: 28, ...glass, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {STEPS.map((label, i) => {
              const n = i + 1, done = step > n || submitted, cur = step === n;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9999, background: cur ? 'rgba(255,255,255,.18)' : 'transparent', opacity: done || cur ? 1 : 0.72 }}>
                  <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: done || cur ? '#fff' : 'rgba(255,255,255,.18)', color: done || cur ? '#0e0f0e' : '#fff' }}>{done ? <Check size={14} /> : n}</span>
                  <span className="pk-label" style={{ flex: 1, fontWeight: 600 }}>{label}</span>
                  <span className="pk-caption" style={{ opacity: 0.8 }}>{done ? 'Done' : cur ? 'Now' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '12px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56 }}>
          {step > 2 && !submitted ? (
            <button type="button" onClick={() => setStep(step - 1)} aria-label="Back" style={{ width: 44, height: 44, flex: 'none', border: 0, borderRadius: 9999, background: 'var(--surface-raised)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
          ) : null}
          {!submitted ? (
            <div style={{ flex: 1, maxWidth: 360, display: 'flex', gap: 4 }}>
              {STEPS.map((s, i) => <span key={s} style={{ flex: 1, height: 4, borderRadius: 9999, background: i < step ? 'var(--ink)' : 'var(--surface-sunken)', transition: 'background 260ms' }} />)}
            </div>
          ) : null}
          <button type="button" className="link" onClick={later} disabled={busy} style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600 }}>{submitted ? 'Sign out' : 'Save and finish later'}</button>
        </div>

        <div style={{ flex: 1, width: '100%', maxWidth: 580, margin: '0 auto', padding: '48px 0 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {app?.decline_reason && (app.status === 'declined' || app.status === 'draft') ? (
            <div style={{ padding: '16px 18px', borderRadius: 20, background: 'var(--kennel-red-soft)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="pk-label" style={{ fontWeight: 600, color: 'var(--kennel-red)' }}>PackPass asked for a change</span>
              <span className="pk-label" style={{ textWrap: 'pretty' }}>{app.decline_reason}</span>
            </div>
          ) : null}

          {step === 2 ? (
            <Section eyebrow="Step 2 of 5 · Business" title="Tell us about your business.">
              <Row2>
                <Input label="Your name" value={f.contact_name} onChange={(v) => set('contact_name', v)} autoComplete="name" />
                <Input label="Mobile" value={f.phone} onChange={(v) => set('phone', v)} type="tel" autoComplete="tel" />
              </Row2>
              <Chips label="What kind of partner are you?" options={TYPES.map(([k, l]) => [k, l])} isOn={(k) => f.partner_type === k} pick={(k) => set('partner_type', k as PartnerType)} />
              <Input label="Business name" value={f.business_name} onChange={(v) => set('business_name', v)} autoComplete="organization" />
              <Input label="Address" value={f.address} onChange={(v) => set('address', v)} autoComplete="street-address" placeholder="1180 Hollis Rd, Austin, TX"
                note="Members see this on your classes and the map. Add more locations later." />
              <Chips label="Where do sessions happen?" options={WHERES.map((w) => [w, w])} isOn={(k) => f.wheres.includes(k)} pick={(k) => toggle('wheres', k)} />
              <Input label="Website or Instagram" optional value={f.website} onChange={(v) => set('website', v)} />
            </Section>
          ) : null}

          {step === 3 ? (
            <Section eyebrow="Step 3 of 5 · Services" title={`What does ${f.business_name || 'your business'} offer?`} lede="Members filter by what their dog needs. Pick everything you teach or provide.">
              <Chips label="Services" right={`${f.services.length} selected`} options={OFFERS.map((o) => [o, o])} isOn={(k) => f.services.includes(k)} pick={(k) => toggle('services', k)} />
              <Chips label="Session formats" options={FORMATS.map((o) => [o, o])} isOn={(k) => f.formats.includes(k)} pick={(k) => toggle('formats', k)} />
              <Chips label="Typical group size" options={SIZES.map((o) => [o, o])} isOn={(k) => f.group_size === k} pick={(k) => set('group_size', k)} />
              <div style={{ padding: '18px 20px', borderRadius: 20, background: 'var(--surface-raised)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <CalendarPlus size={20} style={{ flex: 'none', marginTop: 1 }} />
                <span className="pk-label" style={{ textWrap: 'pretty' }}>You’ll build individual classes, set times and choose credits per session in your dashboard after approval.</span>
              </div>
            </Section>
          ) : null}

          {step === 4 ? (
            <Section eyebrow="Step 4 of 5 · Credentials" title="Upload your credentials." lede="PackPass checks every partner before classes go live. Verified credentials show as a badge on your profile and every class.">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <h2 className="pk-title" style={{ margin: 0 }}>Documents</h2>
                <span className="pk-label pk-muted">{`${reqDone} of ${reqDocs.length} required`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -12 }}>
                {docs.map((d) => <DocRow key={d.kind} d={d} files={(app?.docs ?? []).filter((x) => x.kind === d.kind)} onChange={reload} />)}
              </div>
              <p className="pk-caption pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>PDF, JPG or PNG, up to 10 MB each. Documents are only seen by the PackPass partner team. Add each trainer’s certifications from Team once you’re approved.</p>
            </Section>
          ) : null}

          {step === 5 ? (
            <Section eyebrow="Step 5 of 5 · Payouts" title="Get paid for every booking.">
              <div style={{ background: 'var(--pitch)', color: 'var(--on-pitch)', borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="pk-wide" style={{ color: 'var(--on-pitch-muted)' }}>Partner rate</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span className="pk-display-xl">$9.50</span><span className="pk-label" style={{ color: 'var(--on-pitch-muted)' }}>per credit redeemed</span></div>
                <span className="pk-label" style={{ color: 'var(--on-pitch-muted)', textWrap: 'pretty' }}>Members spend 1 to 4 credits per session, so a typical 2-credit class pays $19 a dog. Payouts go out on the 1st of each month. Rates are set by PackPass.</span>
              </div>
              <Input label="Legal business name" value={f.legal_name} onChange={(v) => set('legal_name', v)} placeholder={f.business_name ? `${f.business_name} LLC` : ''} />
              <div style={{ padding: '18px 20px', borderRadius: 20, background: 'var(--surface-raised)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Banknote size={20} style={{ flex: 'none', marginTop: 1 }} />
                <span className="pk-label" style={{ textWrap: 'pretty' }}>Once you’re approved, Payouts in your dashboard connects your bank account and tax details through Stripe. PackPass never sees your account number or tax ID.</span>
              </div>
            </Section>
          ) : null}

          {submitted ? <InReview app={app} /> : null}
        </div>

        {!submitted ? (
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '16px 0 28px' }}>
            <div style={{ maxWidth: 580, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ErrorLine>{error}</ErrorLine>
              <Button block disabled={busy || blocked} onClick={next}>{busy ? 'Saving…' : step === 5 ? 'Submit application' : 'Continue'}</Button>
              <p className="pk-caption pk-muted" style={{ margin: 0, textAlign: 'center', textWrap: 'pretty' }}>{notes[step]}</p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function InReview({ app }: { app: Application | null }) {
  const approved = app?.status === 'approved';
  const steps: ['done' | 'now' | 'next', string, string, LucideIcon][] = [
    ['done', 'Application submitted', app?.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · Business, services, credentials and payouts' : 'Business, services, credentials and payouts', Check],
    [approved ? 'done' : 'now', 'Credentials verified', 'Usually 2 business days. We’ll ask if anything needs a second look.', approved ? Check : Loader],
    [approved ? 'now' : 'next', 'Go live on PackPass', 'Publish classes and members near Austin can book.', Rocket],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <p className="pk-wide pk-muted" style={{ margin: 0 }}>{approved ? 'Approved' : 'Application sent'}</p>
        <h1 className="pk-display-xl" style={{ margin: '10px 0 0' }}>{`${app?.business_name ?? 'Your business'} is ${approved ? 'approved' : 'in review'}.`}</h1>
        <p className="pk-body pk-muted" style={{ margin: '10px 0 0', textWrap: 'pretty' }}>
          {approved ? 'Sign in again and your dashboard opens.' : 'The partner team checks every document by hand. Sign in here any time to see where it’s up to.'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map(([k, title, sub, Icon], i) => (
          <div key={title} style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flex: 'none' }}>
              <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: k === 'done' ? 'var(--turf)' : k === 'now' ? 'var(--ink)' : 'var(--surface-raised)', color: k === 'done' ? 'var(--on-turf)' : k === 'now' ? 'var(--bg)' : 'var(--ink-muted)' }}><Icon size={16} /></span>
              <span style={{ width: 2, flex: 1, minHeight: 16, background: i < steps.length - 1 ? 'var(--surface-sunken)' : 'transparent' }} />
            </div>
            <div style={{ flex: 1, padding: '4px 0 26px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="pk-heading">{title}</span>
              <span className="pk-label pk-muted" style={{ textWrap: 'pretty' }}>{sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocRow({ d, files, onChange }: { d: ReturnType<typeof docsFor>[number]; files: Application['docs']; onChange: () => Promise<unknown> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = files.length > 0;
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true); setError(null);
    try { for (const file of Array.from(list)) await uploadApplicationDoc(d.kind, file); await onChange(); } catch (e) { setError(errorCopy(e)); } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async (id: string) => {
    setError(null);
    try { await removeApplicationDoc(id); await onChange(); } catch (e) { setError(errorCopy(e)); }
  };
  const Icon = error ? X : done ? Check : FileUp;
  return (
    <div style={{ padding: '18px 20px', borderRadius: 20, background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: error ? 'var(--kennel-red)' : done ? 'var(--turf)' : 'var(--surface-sunken)', color: error ? 'var(--bg)' : done ? 'var(--on-turf)' : 'var(--ink)' }}><Icon size={18} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="pk-heading">{d.name}</span>{d.req ? <Tag>Required</Tag> : null}</div>
          <span className="pk-caption pk-muted" style={{ textWrap: 'pretty' }}>{d.desc}</span>
        </div>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" multiple={d.multi} hidden onChange={(e) => upload(e.target.files)} aria-label={`Upload ${d.name}`} />
        {!done || d.multi ? (
          <Button size="sm" variant={done ? 'quiet' : 'primary'} disabled={busy} onClick={() => input.current?.click()} style={done ? { background: 'var(--bg)' } : undefined}>
            {busy ? <><Upload size={14} /> Uploading…</> : done ? 'Add another' : 'Upload'}
          </Button>
        ) : null}
      </div>
      {files.map((x) => (
        <div key={x.id} style={{ marginLeft: 54, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 14px', borderRadius: 14, background: 'var(--bg)' }}>
          <FileText size={16} color="var(--ink-muted)" style={{ flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="pk-label" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.file_name}</span>
            <span className="pk-caption pk-muted">{[kb(x.size_bytes), 'Uploaded'].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" onClick={() => remove(x.id)} aria-label={`Remove ${x.file_name}`} style={{ width: 32, height: 32, flex: 'none', border: 0, borderRadius: 9999, background: 'none', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      ))}
      {error ? <div style={{ marginLeft: 54, padding: '12px 16px', borderRadius: 14, background: 'var(--kennel-red-soft)' }}><span className="pk-label" style={{ color: 'var(--kennel-red)', fontWeight: 600 }}>{error}</span></div> : null}
    </div>
  );
}

const Section = ({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede?: string; children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
    <div>
      <p className="pk-wide pk-muted" style={{ margin: 0 }}>{eyebrow}</p>
      <h1 className="pk-display-xl" style={{ margin: '10px 0 0' }}>{title}</h1>
      {lede ? <p className="pk-body pk-muted" style={{ margin: '10px 0 0', textWrap: 'pretty' }}>{lede}</p> : null}
    </div>
    {children}
  </div>
);
const Row2 = ({ children }: { children: ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>{children}</div>;

function Input({ label, value, onChange, note, optional, ...rest }: { label: string; value: string; onChange: (v: string) => void; note?: string; optional?: boolean; type?: string; autoComplete?: string; placeholder?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="pk-label" style={{ fontWeight: 600 }}>{label}{optional ? <span className="pk-muted" style={{ fontWeight: 400 }}> · Optional</span> : null}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} {...rest} />
      {note ? <span className="pk-caption pk-muted">{note}</span> : null}
    </label>
  );
}

function Chips({ label, right, options, isOn, pick }: { label: string; right?: string; options: string[][]; isOn: (k: string) => boolean; pick: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="pk-label" style={{ fontWeight: 600 }}>{label}</span>{right ? <span className="pk-caption pk-muted">{right}</span> : null}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{options.map(([k, l]) => <Chip key={k} on={isOn(k)} onClick={() => pick(k)}>{l}</Chip>)}</div>
    </div>
  );
}
