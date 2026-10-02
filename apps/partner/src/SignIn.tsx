import { useState } from 'react';

import { errorCopy, signIn, signOut } from '@/lib/api';
import { Button, ErrorLine } from '@/ui/kit';

/** Staff sign in with the email and password of their PackPass account. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await signIn(email.trim(), pw); } catch (err) { setError(errorCopy(err)); } finally { setBusy(false); }
  };
  return (
    <Centered>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className="pk-wide pk-muted">PackPass · Partner</span>
        <h1 className="pk-display-xl" style={{ margin: '0 0 8px' }}>Sign in.</h1>
        <label className="pk-label" style={{ fontWeight: 600 }}>Email<input className="field" style={{ marginTop: 8 }} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="pk-label" style={{ fontWeight: 600 }}>Password<input className="field" style={{ marginTop: 8 }} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" block disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <span className="pk-caption pk-muted">Use the account PackPass linked to your business. Forgot your password? Reset it in the PackPass app.</span>
      </form>
    </Centered>
  );
}

export function NotStaff() {
  return (
    <Centered>
      <span className="pk-wide pk-muted">PackPass · Partner</span>
      <h1 className="pk-display-lg" style={{ margin: '12px 0' }}>This account isn't linked to a partner yet.</h1>
      <p className="pk-body pk-muted" style={{ margin: '0 0 20px' }}>Once PackPass approves your partner application, we link your account and the dashboard opens here.</p>
      <Button variant="quiet" onClick={() => signOut()}>Use another account</Button>
    </Centered>
  );
}

export const Centered = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-raised)' }}>
    <div style={{ width: 420, maxWidth: '100%', padding: 32, borderRadius: 32, background: 'var(--bg)', boxShadow: 'var(--shadow-card)' }}>{children}</div>
  </div>
);
