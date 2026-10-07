import { Link } from 'react-router-dom';

import type { LegalDoc } from '@/content/legal';

/** Privacy policy, membership terms and support: one readable column, with links between the three. */
export function Legal({ doc }: { doc: LegalDoc }) {
  return (
    <article className="pp-section" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span className="pk-wide pk-muted">{`Last updated ${doc.updated}`}</span>
      <h1 className="pk-display-xl pp-h2" style={{ margin: 0 }}>{doc.title}</h1>
      <p className="pk-body" style={{ margin: 0, textWrap: 'pretty' }}>{doc.intro}</p>
      {doc.sections.map((s) => {
        const bullets = s.body.filter((p) => p.startsWith('- '));
        const paras = s.body.filter((p) => !p.startsWith('- '));
        return (
          <section key={s.heading} id={s.heading.toLowerCase().replace(/[^a-z]+/g, "-")} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <h2 className="pk-heading" style={{ margin: 0 }}>{s.heading}</h2>
            {paras.map((p) => <p key={p} className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>{p}</p>)}
            {bullets.length ? (
              <ul className="pk-body pk-muted" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bullets.map((b) => <li key={b} style={{ textWrap: 'pretty' }}>{b.slice(2)}</li>)}
              </ul>
            ) : null}
          </section>
        );
      })}
      <nav className="pk-label" style={{ display: 'flex', gap: 20, marginTop: 32 }}>
        <Link to="/terms">Membership terms</Link>
        <Link to="/privacy">Privacy policy</Link>
        <Link to="/support">Support</Link>
      </nav>
    </article>
  );
}
