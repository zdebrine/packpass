// Small wrappers over the design system's pk- classes.
import { Minus, Plus, Smartphone, Play } from 'lucide-react';
import { useState, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from 'react';

import type { Faq as FaqRow, Photo } from './content/defaults';
import { ANDROID_URL, IOS_URL } from './lib/supabase';

type Variant = 'primary' | 'signal' | 'quiet' | 'glass';
const cls = (variant: Variant, size?: 'sm', block?: boolean) => ['pk-btn', `pk-btn-${variant}`, size === 'sm' && 'pk-btn-sm', block && 'pk-btn-block'].filter(Boolean).join(' ');

export function Button({ children, variant = 'primary', size, block, disabled, onClick, href, style, type = 'button' }: {
  children: ReactNode; variant?: Variant; size?: 'sm'; block?: boolean; disabled?: boolean; onClick?: () => void; href?: string; style?: CSSProperties; type?: 'button' | 'submit';
}) {
  if (href && !disabled) return <a className={cls(variant, size, block)} href={href} onClick={onClick} style={style}>{children}</a>;
  return <button type={type} className={cls(variant, size, block)} disabled={disabled} onClick={onClick} style={style}>{children}</button>;
}

export const Chip = ({ children, on, onClick }: { children: ReactNode; on?: boolean; onClick?: () => void }) => (
  <button type="button" className={`pk-chip${on ? ' pk-chip-on' : ''}`} aria-pressed={!!on} onClick={onClick}>{children}</button>
);

export const Tag = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'signal' | 'glass' }) => <span className={`pk-tag pk-tag-${tone}`}>{children}</span>;

/** iOS and Android buttons. Until the app is listed (no store link set), they say so instead of linking. */
export function StoreButtons() {
  return (
    <>
      <Button href={IOS_URL || undefined} disabled={!IOS_URL} style={{ minWidth: 200 }}><Smartphone size={18} />{IOS_URL ? 'Download for iOS' : 'iOS · coming soon'}</Button>
      <Button variant="glass" href={ANDROID_URL || undefined} disabled={!ANDROID_URL} style={{ minWidth: 200 }}><Play size={18} />{ANDROID_URL ? 'Get it on Android' : 'Android · coming soon'}</Button>
    </>
  );
}

export function Heading({ eyebrow, title, children, maxWidth = 720 }: { eyebrow: string; title: ReactNode; children?: ReactNode; maxWidth?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth }}>
      <span className="pk-wide pk-muted">{eyebrow}</span>
      <h2 className="pk-display-xl pp-h2">{title}</h2>
      {children}
    </div>
  );
}

export function Faq({ id, eyebrow, rows }: { id: string; eyebrow: string; rows: FaqRow[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <section id={id} className="pp-section" style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
      <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="pk-wide pk-muted">{eyebrow}</span>
        <h2 className="pk-display-xl pp-h2">Questions.</h2>
      </div>
      <div style={{ flex: '2 1 560px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ question: q, answer: a }, i) => (
          <div key={q} style={{ background: 'var(--surface-raised)', borderRadius: 28 }}>
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} aria-expanded={!!open[i]}
              style={{ width: '100%', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '22px 24px' }}>
              <span className="pk-heading" style={{ flex: 1 }}>{q}</span>
              {open[i] ? <Minus size={20} /> : <Plus size={20} />}
            </button>
            {open[i] ? <p className="pk-body pk-muted" style={{ margin: 0, padding: '0 24px 24px', maxWidth: 640, textWrap: 'pretty' }}>{a}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** A full-bleed photo panel with a bottom-weighted shade, for the hero and closing sections. */
export function PhotoPanel({ children, photo, minHeight, shade, style }: { children: ReactNode; photo?: Photo; minHeight: string | number; shade: string; style?: CSSProperties }) {
  return (
    <div data-theme="dark" style={{ position: 'relative', minHeight, borderRadius: 32, overflow: 'hidden', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'clamp(24px,4vw,56px)', boxSizing: 'border-box', ...style }}>
      {photo ? <Img photo={photo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: shade }} />
      {children}
    </div>
  );
}

/** A content photo, with the focal point set in Sanity. `alt` overrides the photo's own (empty for decorative use). */
export const Img = ({ photo, alt, style, ...rest }: { photo: Photo } & ImgHTMLAttributes<HTMLImageElement>) => (
  <img {...rest} src={photo.src} alt={alt ?? photo.alt} style={photo.position ? { objectPosition: photo.position, ...style } : style} />
);
