// Small wrappers over the design system's pk- classes, matching the prototype's components.
import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';

type Variant = 'primary' | 'signal' | 'quiet' | 'glass';
export function Button({ children, variant = 'primary', size, block, disabled, onClick, style, type = 'button' }: {
  children: ReactNode; variant?: Variant; size?: 'sm'; block?: boolean; disabled?: boolean; onClick?: () => void; style?: CSSProperties; type?: 'button' | 'submit';
}) {
  const cls = ['pk-btn', `pk-btn-${variant}`, size === 'sm' && 'pk-btn-sm', block && 'pk-btn-block'].filter(Boolean).join(' ');
  return <button type={type} className={cls} disabled={disabled} onClick={onClick} style={style}>{children}</button>;
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'premium' | 'signal' | 'warning' | 'glass' }) {
  return <span className={`pk-tag pk-tag-${tone}`}>{children}</span>;
}

export function Chip({ children, on, onClick }: { children: ReactNode; on?: boolean; onClick?: () => void }) {
  return <button type="button" className={`pk-chip${on ? ' pk-chip-on' : ''}`} aria-pressed={!!on} onClick={onClick}>{children}</button>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 48, height: 28, flex: 'none', border: 0, padding: 3, borderRadius: 9999, cursor: 'pointer', background: on ? 'var(--inverse)' : 'var(--surface-sunken)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background 140ms' }}>
      <span style={{ width: 22, height: 22, borderRadius: 9999, background: on ? 'var(--on-inverse)' : 'var(--bg)' }} />
    </button>
  );
}

/** − value + control used for capacity, spots and group size. */
export function Stepper({ value, onDec, onInc, label, decDisabled, incDisabled }: { value: ReactNode; onDec: () => void; onInc: () => void; label: string; decDisabled?: boolean; incDisabled?: boolean }) {
  const b: CSSProperties = { width: 44, height: 44, border: 0, borderRadius: 9999, background: 'var(--bg)', fontSize: 20, cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 9999, background: 'var(--surface-raised)', alignSelf: 'flex-start' }}>
      <button type="button" aria-label={`Fewer ${label}`} style={{ ...b, opacity: decDisabled ? 0.4 : 1 }} disabled={decDisabled} onClick={onDec}>−</button>
      <span className="pk-display-md pk-num" style={{ minWidth: 56, textAlign: 'center' }}>{value}</span>
      <button type="button" aria-label={`More ${label}`} style={{ ...b, opacity: incDisabled ? 0.4 : 1 }} disabled={incDisabled} onClick={onInc}>+</button>
    </div>
  );
}

export function Avatar({ name, size = 40, photo, radius = 9999, tone = 'sunken' }: { name: string; size?: number; photo?: string | null; radius?: number; tone?: 'sunken' | 'pitch' }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const st: CSSProperties = { width: size, height: size, flex: 'none', borderRadius: radius, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size / 3), fontWeight: 600,
    background: tone === 'pitch' ? 'var(--pitch)' : 'var(--surface-sunken)', color: tone === 'pitch' ? 'var(--on-pitch)' : 'var(--ink)' };
  return <span style={st}>{photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</span>;
}

/** The prototype's sheet: a centred card over a dimmed page. Escape or a click outside closes it. */
export function Modal({ eyebrow, title, onClose, width = 680, children }: { eyebrow: string; title: string; onClose: () => void; width?: number; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,15,14,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '100%', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', boxSizing: 'border-box', padding: 28, borderRadius: 32, background: 'var(--bg)', color: 'var(--ink)', boxShadow: 'var(--shadow-float)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pk-wide pk-muted">{eyebrow}</span>
            <h2 className="pk-display-lg" style={{ margin: 0 }}>{title}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, border: 0, borderRadius: 9999, background: 'var(--surface-raised)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="pk-label" style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {note ? <span className="pk-caption pk-muted">{note}</span> : null}
    </div>
  );
}

export const Row = ({ children, gap = 8, wrap = true, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: CSSProperties }) =>
  <div style={{ display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap, alignItems: 'center', ...style }}>{children}</div>;

export function ErrorLine({ children }: { children: ReactNode }) {
  return children ? <span className="pk-label" role="alert" style={{ color: 'var(--kennel-red)', fontWeight: 600 }}>{children}</span> : null;
}

export { photoSrc as photoUrl } from '@/lib/photos';

/** The design system's ClassCard (tile layout): what members see on Book. */
export function ClassCard({ image, discipline, premium, title, meta, credits, spotsLeft }: {
  image: string; discipline?: string; premium?: boolean; title: string; meta: string; credits: string; spotsLeft?: number;
}) {
  const spots = spotsLeft == null ? null : spotsLeft === 0 ? 'Full. Waitlist open' : spotsLeft === 1 ? 'Last spot' : `${spotsLeft} spots left`;
  return (
    <article className="pk-class">
      <img className="pk-class-img" src={image} alt="" />
      <div className="pk-class-top">
        <span>{premium ? <Tag tone="premium">Premium</Tag> : discipline ? <Tag tone="glass">{discipline}</Tag> : null}</span>
        <Tag tone="glass">{credits}</Tag>
      </div>
      <div className="pk-class-body">
        <h3 className="pk-class-title">{title}</h3>
        <p className="pk-class-meta">{meta}</p>
        {spots ? <p className={`pk-class-spots${spotsLeft! <= 2 ? ' pk-class-spots-low' : ''}`}>{spots}</p> : null}
      </div>
    </article>
  );
}

/** Five round bars for intensity 1–5. */
export function IntensityBars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Intensity">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onPick(n)}
          style={{ width: 44, height: 44, border: 0, borderRadius: 9999, cursor: 'pointer', background: n <= value ? 'var(--inverse)' : 'var(--surface-raised)' }} />
      ))}
    </div>
  );
}
