import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { APPLY_URL, DASHBOARD_URL } from '@/lib/supabase';
import { Button, Chip } from '@/ui';

/** The top bar and footer around both pages. Owners is light, Partner with us is dark, as in the design. */
export function Site() {
  const loc = useLocation();
  const nav = useNavigate();
  const partners = loc.pathname.startsWith('/partners');
  useEffect(() => {
    if (!loc.hash) window.scrollTo({ top: 0 });
    document.title = partners ? 'Partner with PackPass · Fill your empty spots' : 'PackPass · Dog classes in Austin, matched to your dog';
  }, [loc.pathname, loc.hash, partners]);
  const links = partners
    ? [['Payouts', '#payouts'], ['Earnings', '#earnings'], ['Clients', '#clients'], ['Requirements', '#requirements'], ['FAQ', '#partner-faq']]
    : [['How it works', '#how'], ['Classes', '#classes'], ['Partners', '#partners'], ['Plans', '#pricing'], ['FAQ', '#faq']];

  return (
    <div data-theme={partners ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: '12px 28px', padding: '14px clamp(16px,3vw,32px)', boxSizing: 'border-box' }}>
        <Link to="/" className="pk-wide" style={{ fontSize: 16, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>PackPass</Link>
        <span data-pp-hide-sm="" className="pk-wide" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 9999, background: 'var(--surface-raised)', fontSize: 11, whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--agility)' }} />Now in Austin
        </span>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9999, background: 'var(--surface-raised)' }}>
          <Chip on={!partners} onClick={() => nav('/')}><span className="pp-lg">For owners</span><span className="pp-sm">Owners</span></Chip>
          <Chip on={partners} onClick={() => nav('/partners')}><span className="pp-lg">Partner with us</span><span className="pp-sm">Partners</span></Chip>
        </div>
        <div data-pp-navlinks="" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', gap: 24, alignItems: 'center', overflow: 'hidden' }}>
          {links.map(([label, href]) => <a key={href} href={href} style={{ fontSize: 14, fontWeight: 500, lineHeight: '40px', textDecoration: 'none', whiteSpace: 'nowrap' }}>{label}</a>)}
        </div>
        <div data-pp-hide-sm="" style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          {partners ? <Button variant="quiet" size="sm" href={DASHBOARD_URL}>Sign in</Button> : null}
          {partners ? <Button size="sm" href={APPLY_URL}>Apply to partner</Button> : <Button size="sm" href="#get">Get the app</Button>}
        </div>
      </nav>

      <main><Outlet /></main>

      <footer style={{ maxWidth: 1280, margin: '0 auto', padding: '72px clamp(20px,4vw,40px) 40px', boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
          <span className="pk-wide" style={{ fontSize: 16, fontWeight: 700 }}>PackPass</span>
          <span className="pk-label pk-muted">Drop-in dog classes across Austin, matched to your dog.</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 56 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="pk-wide pk-muted">Members</span>
            <Link to="/#how" className="pk-label" style={{ textDecoration: 'none' }}>How it works</Link>
            <Link to="/#pricing" className="pk-label" style={{ textDecoration: 'none' }}>Plans</Link>
            <Link to="/#faq" className="pk-label" style={{ textDecoration: 'none' }}>FAQ</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="pk-wide pk-muted">Partners</span>
            <Link to="/partners" className="pk-label" style={{ textDecoration: 'none' }}>Partner with us</Link>
            <a href={APPLY_URL} className="pk-label" style={{ textDecoration: 'none' }}>Apply</a>
            <a href={DASHBOARD_URL} className="pk-label" style={{ textDecoration: 'none' }}>Partner sign in</a>
          </div>
        </div>
        <span className="pk-caption pk-muted" style={{ flexBasis: '100%' }}>{`© ${new Date().getFullYear()} PackPass`}</span>
      </footer>
    </div>
  );
}

/** Following a link to "/#faq" from the other page: scroll once the section exists. */
export function useHashScroll() {
  const loc = useLocation();
  useEffect(() => {
    if (!loc.hash) return;
    const t = setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView(), 50);
    return () => clearTimeout(t);
  }, [loc.pathname, loc.hash]);
}
