import { SITE_URL } from '@/lib/supabase';

/** Support, terms and privacy on the website, opened in a new tab. */
export const LegalLinks = ({ style }: { style?: React.CSSProperties }) => (
  <span className="pk-caption pk-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, ...style }}>
    {([['Support', '/support'], ['Terms', '/terms'], ['Privacy', '/privacy']] as const).map(([label, path]) => (
      <a key={path} href={`${SITE_URL}${path}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{label}</a>
    ))}
  </span>
);
