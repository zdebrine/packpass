// Wrappers over the PackPass v3 design system's pp- classes (ds/v3-components.css).
import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { Check, Minus, Plus, X, type LucideIcon } from 'lucide-react';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/** Lucide at the system's 1.75 stroke. */
export const Ico = ({ icon: I, size = 16, color, style }: { icon: LucideIcon; size?: number; color?: string; style?: CSSProperties }) =>
  <I size={size} strokeWidth={1.75} color={color} style={{ flex: 'none', ...style }} aria-hidden />;

type Variant = 'primary' | 'signal' | 'quiet' | 'outline' | 'ghost' | 'danger' | 'glass';
export function Button({ children, variant = 'primary', size, block, disabled, onClick, style, type = 'button', icon, iconRight, label }: {
  children?: ReactNode; variant?: Variant; size?: 'sm'; block?: boolean; disabled?: boolean; onClick?: () => void; style?: CSSProperties; type?: 'button' | 'submit';
  icon?: LucideIcon; iconRight?: LucideIcon; label?: string;
}) {
  const cls = cx('pp-btn', `pp-btn-${variant}`, size === 'sm' && 'pp-btn-sm', block && 'pp-btn-block');
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} style={style} aria-label={label}>
      {icon ? <Ico icon={icon} /> : null}{children}{iconRight ? <Ico icon={iconRight} /> : null}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'quiet', onClick, dot, style }: { icon: LucideIcon; label: string; variant?: 'quiet' | 'ghost' | 'glass'; onClick?: () => void; dot?: boolean; style?: CSSProperties }) {
  return (
    <button type="button" className={cx('pp-iconbtn', variant !== 'quiet' && `pp-iconbtn-${variant}`)} aria-label={label} title={label} onClick={onClick} style={style}>
      <Ico icon={icon} />{dot ? <span className="pp-iconbtn-dot" /> : null}
    </button>
  );
}

/** Over photography or editorial content. */
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'premium' | 'signal' | 'warning' | 'glass' }) {
  return <span className={`pp-tag pp-tag-${tone}`}>{children}</span>;
}

export type BadgeTone = 'neutral' | 'cleared' | 'needs' | 'warning' | 'signal';
/** Status: always a Badge. */
export function Badge({ children, tone = 'neutral', icon, dot }: { children: ReactNode; tone?: BadgeTone; icon?: LucideIcon; dot?: boolean }) {
  return <span className={cx('pp-badge', `pp-badge-${tone}`, dot && 'pp-badge-dot')}>{icon ? <Ico icon={icon} size={12} /> : null}{children}</span>;
}

export function Chip({ children, on, onClick, icon }: { children: ReactNode; on?: boolean; onClick?: () => void; icon?: LucideIcon }) {
  return <button type="button" className={cx('pp-chip', on && 'pp-chip-on')} aria-pressed={!!on} onClick={onClick}>{icon ? <Ico icon={icon} /> : null}{children}</button>;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: (T | { value: T; label: ReactNode })[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="pp-seg" role="group" aria-label={label} style={{ alignSelf: 'flex-start' }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        return <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{typeof o === 'string' ? o : o.label}</button>;
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label, children, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; children?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('pp-toggle', on && 'pp-toggle-on', disabled && 'pp-disabled')}>
      <input type="checkbox" role="switch" aria-label={label} checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span className="pp-toggle-track" />{children}
    </label>
  );
}

export function Checkbox({ on, onChange, children, disabled }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('pp-check', on && 'pp-check-on', disabled && 'pp-disabled')}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span className="pp-check-box">{on ? <Ico icon={Check} size={12} /> : null}</span>{children}
    </label>
  );
}

/** − value + control used for capacity, spots and group size. */
export function Stepper({ value, onDec, onInc, label, decDisabled, incDisabled }: { value: ReactNode; onDec: () => void; onInc: () => void; label: string; decDisabled?: boolean; incDisabled?: boolean }) {
  return (
    <div className="pp-stepper" style={{ alignSelf: 'flex-start' }}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={decDisabled} onClick={onDec}><Ico icon={Minus} /></button>
      <span>{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={incDisabled} onClick={onInc}><Ico icon={Plus} /></button>
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone, style }: { value: number; max?: number; tone?: 'turf' | 'signal' | 'warning'; style?: CSSProperties }) {
  return (
    <div className={cx('pp-progress', tone && `pp-progress-${tone}`)} role="progressbar" aria-valuenow={value} aria-valuemax={max} style={style}>
      <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
  );
}

export type StatItem = { label: string; value: ReactNode; unit?: string; caption?: ReactNode };
export function StatGroup({ stats, variant = 'line', columns, style }: { stats: StatItem[]; variant?: 'line' | 'fill'; columns?: number; style?: CSSProperties }) {
  return (
    <div className={`pp-statgroup pp-statgroup-${variant}`} style={{ ...(columns ? { gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` } : null), ...style }}>
      {stats.map((s) => (
        <div className="pp-stat" key={s.label}>
          <span className="pp-stat-label">{s.label}</span>
          <div className="pp-stat-row"><span className="pp-stat-num">{s.value}</span>{s.unit ? <span className="pp-stat-unit">{s.unit}</span> : null}</div>
          {s.caption ? <span className="pp-stat-caption">{s.caption}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 28, photo, radius = 9999, tone = 'sunken' }: { name: string; size?: number; photo?: string | null; radius?: number; tone?: 'sunken' | 'pitch' }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const st: CSSProperties = { width: size, height: size, flex: 'none', borderRadius: radius, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(11, Math.round(size / 3)), fontWeight: 600,
    background: tone === 'pitch' ? 'var(--pitch)' : 'var(--surface-raised)', color: tone === 'pitch' ? 'var(--on-pitch)' : 'var(--ink)' };
  return <span style={st}>{photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</span>;
}

/** Centred dialog over a dimmed page (480 wide by default). Escape or a click outside closes it. */
export function Modal({ eyebrow, title, onClose, width = 480, children, footer }: { eyebrow?: string; title: string; onClose: () => void; width?: number; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ maxWidth: width, maxHeight: 'calc(100vh - 48px)' }}>
        <div className="pp-modal-head" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {eyebrow ? <span className="pp-caption pp-muted">{eyebrow}</span> : null}
            <h2 className="pp-modal-title">{title}</h2>
          </div>
          <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
        </div>
        <div className="pp-modal-body">{children}</div>
        {footer ? <div className="pp-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children, note, error }: { label: string; children: ReactNode; note?: ReactNode; error?: ReactNode }) {
  return (
    <div className="pp-field">
      <span className="pp-field-label">{label}</span>
      {children}
      {error ? <span className="pp-field-error" role="alert">{error}</span> : note ? <span className="pp-field-help">{note}</span> : null}
    </div>
  );
}

export const Row = ({ children, gap = 8, wrap = true, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: CSSProperties }) =>
  <div style={{ display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap, alignItems: 'center', ...style }}>{children}</div>;

export function ErrorLine({ children }: { children: ReactNode }) {
  return children ? <span className="pp-label" role="alert" style={{ color: 'var(--kennel-red)' }}>{children}</span> : null;
}

/** Page header: title, a caption line under it, and actions on the right. */
export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <h1 className="pp-page-title">{title}</h1>
        {sub ? <span className="pp-caption pp-muted">{sub}</span> : null}
      </div>
      {children ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div> : null}
    </header>
  );
}

/** The page frame: centred, max 1200. */
export const Page = ({ children, gap = 24 }: { children: ReactNode; gap?: number }) =>
  <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap }}>{children}</div>;

export function EmptyState({ icon: I, title, body, children }: { icon?: LucideIcon; title: ReactNode; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pp-empty">
      {I ? <div className="pp-empty-icon"><Ico icon={I} size={20} /></div> : null}
      <h3 className="pp-empty-title">{title}</h3>
      {body ? <p className="pp-empty-body">{body}</p> : null}
      {children}
    </div>
  );
}

export { photoSrc as photoUrl } from '@/lib/photos';

/** The design system's ClassCard (tile layout): what members see on Book. */
export function ClassCard({ image, discipline, premium, title, meta, credits, spotsLeft }: {
  image: string; discipline?: string; premium?: boolean; title: string; meta: string; credits: string; spotsLeft?: number;
}) {
  const spots = spotsLeft == null ? null : spotsLeft === 0 ? 'Full. Waitlist open' : spotsLeft === 1 ? 'Last spot' : `${spotsLeft} spots left`;
  return (
    <article className="pp-class" style={{ cursor: 'default' }}>
      <img src={image} alt="" />
      <div className="pp-class-top">
        <span>{premium ? <Tag tone="premium">Premium</Tag> : discipline ? <Tag tone="glass">{discipline}</Tag> : null}</span>
        <Tag tone="glass">{credits}</Tag>
      </div>
      <div className="pp-class-body">
        <h3 className="pp-class-title">{title}</h3>
        <p className="pp-class-meta">{meta}</p>
        {spots ? <p className="pp-class-meta" style={{ color: '#fff', fontWeight: 500 }}>{spots}</p> : null}
      </div>
    </article>
  );
}

/** Five segments for intensity 1–5. */
export function IntensityBars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label="Intensity">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onPick(n)}
          style={{ width: 40, height: 'var(--c-btn-sm)', border: 0, borderRadius: 'var(--r-field-sm)', cursor: 'pointer', background: n <= value ? 'var(--inverse)' : 'var(--surface-raised)' }} />
      ))}
    </div>
  );
}

/** A confirmation that floats at the bottom of the page until dismissed. */
export function Toast({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 24, zIndex: 60, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', maxWidth: 560, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 12px 12px 18px', borderRadius: 16, background: 'var(--inverse)', color: 'var(--on-inverse)', boxShadow: 'var(--shadow-float)' }}>
        <span className="pp-label" style={{ textWrap: 'pretty' }}>{children}</span>
        <button type="button" onClick={onDismiss} className="pp-label" style={{ background: 'none', border: 0, color: 'inherit', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: '6px 8px', whiteSpace: 'nowrap' }}>Dismiss</button>
      </div>
    </div>
  );
}
