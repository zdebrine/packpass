import { useState } from 'react';

import { errorCopy, sendPasswordCode, setPasswordWithCode, signIn, signOut } from '@/lib/api';
import { Button, ErrorLine } from '@/ui/kit';

/** Staff sign in with the email and password of their PackPass account, or set one with an emailed code. */
export function SignIn() {
  const [mode, setMode] = useState<'sign_in' | 'code'>('sign_in');
  const [email, setEmail] = useState('');
  if (mode === 'code') return <SetPassword email={email} setEmail={setEmail} onBack={() => setMode('sign_in')} />;
  return <PasswordSignIn email={email} setEmail={setEmail} onSetPassword={() => setMode('code')} />;
}

function PasswordSignIn({ email, setEmail, onSetPassword }: { email: string; setEmail: (v: string) => void; onSetPassword: () => void }) {
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
        <button type="button" className="link" onClick={onSetPassword}>Set or reset password</button>
        <span className="pk-caption pk-muted">Use the account PackPass linked to your business. Invited by email? Choose Set or reset password and use the code from the invite.</span>
      </form>
    </Centered>
  );
}

/** Set or reset the password with a 6-digit code: send one here, or use the code from the invite email. */
function SetPassword({ email, setEmail, onBack }: { email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setError(null);
    try { await sendPasswordCode(email.trim()); setSent(true); } catch (err) { setError(errorCopy(err)); } finally { setBusy(false); }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await setPasswordWithCode(email.trim(), code.trim(), pw); } catch (err) { setError(errorCopy(err)); setBusy(false); }
  };
  return (
    <Centered>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className="pk-wide pk-muted">PackPass · Partner</span>
        <h1 className="pk-display-xl" style={{ margin: '0 0 8px' }}>Set a password.</h1>
        <span className="pk-body pk-muted">{sent ? `We sent a 6-digit code to ${email.trim()}.` : 'Use the code from your invite email, or send yourself a new one.'}</span>
        <label className="pk-label" style={{ fontWeight: 600 }}>Email<input className="field" style={{ marginTop: 8 }} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <button type="button" className="link" disabled={busy || !email.includes('@')} onClick={send}>{sent ? 'Send another code' : 'Send me a code'}</button>
        <label className="pk-label" style={{ fontWeight: 600 }}>Code<input className="field" style={{ marginTop: 8, letterSpacing: '.3em' }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required /></label>
        <label className="pk-label" style={{ fontWeight: 600 }}>New password<input className="field" style={{ marginTop: 8 }} type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" block disabled={busy || code.length !== 6 || pw.length < 8}>{busy ? 'Saving…' : 'Save password and sign in'}</Button>
        <button type="button" className="link" onClick={onBack}>Back to sign in</button>
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
