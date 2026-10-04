import { useState } from 'react';

import { confirmAccount, createAccount, errorCopy, resendAccountCode, sendPasswordCode, setPasswordWithCode, signIn, signOut } from '@/lib/api';
import { Button, ErrorLine } from '@/ui/kit';

/** Staff sign in with the email and password of their PackPass account, or set one with an emailed code. */
export function SignIn() {
  const [mode, setMode] = useState<'sign_in' | 'code' | 'create'>('sign_in');
  const [email, setEmail] = useState('');
  if (mode === 'code') return <SetPassword email={email} setEmail={setEmail} onBack={() => setMode('sign_in')} />;
  if (mode === 'create') return <CreateAccount email={email} setEmail={setEmail} onBack={() => setMode('sign_in')} />;
  return <PasswordSignIn email={email} setEmail={setEmail} onSetPassword={() => setMode('code')} onCreate={() => setMode('create')} />;
}

function PasswordSignIn({ email, setEmail, onSetPassword, onCreate }: { email: string; setEmail: (v: string) => void; onSetPassword: () => void; onCreate: () => void }) {
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
        <button type="button" className="link" onClick={onCreate}>Create an account</button>
        <span className="pk-caption pk-muted">Added to a team? Create an account with the email they added. Invited by PackPass by email? Choose Set or reset password and use the code from the invite.</span>
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

/** For someone an owner added to their team: name, email and password, then the 6-digit code we email. */
function CreateAccount({ email, setEmail, onBack }: { email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await createAccount(name, email.trim(), pw); setSent(true); } catch (err) { setError(errorCopy(err)); } finally { setBusy(false); }
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await confirmAccount(email.trim(), code.trim()); } catch (err) { setError(errorCopy(err)); setBusy(false); }
  };
  const resend = async () => {
    setError(null); setNote(null);
    try { await resendAccountCode(email.trim()); setNote('Sent. Check your inbox and spam folder.'); } catch (err) { setError(errorCopy(err)); }
  };
  if (sent) return (
    <Centered>
      <form onSubmit={confirm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className="pk-wide pk-muted">PackPass · Partner</span>
        <h1 className="pk-display-xl" style={{ margin: '0 0 8px' }}>Check your email.</h1>
        <span className="pk-body pk-muted">{`We sent a 6-digit code to ${email.trim()}.`}</span>
        <label className="pk-label" style={{ fontWeight: 600 }}>Code<input className="field" style={{ marginTop: 8, letterSpacing: '.3em' }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required /></label>
        <ErrorLine>{error}</ErrorLine>
        {note ? <span className="pk-caption pk-muted">{note}</span> : null}
        <Button type="submit" block disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Confirm and open the dashboard'}</Button>
        <button type="button" className="link" onClick={resend}>Send another code</button>
        <button type="button" className="link" onClick={onBack}>Back to sign in</button>
      </form>
    </Centered>
  );
  return (
    <Centered>
      <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className="pk-wide pk-muted">PackPass · Partner</span>
        <h1 className="pk-display-xl" style={{ margin: '0 0 8px' }}>Create an account.</h1>
        <span className="pk-body pk-muted">Use the email your team added. The same account works in the PackPass app.</span>
        <label className="pk-label" style={{ fontWeight: 600 }}>Your name<input className="field" style={{ marginTop: 8 }} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="pk-label" style={{ fontWeight: 600 }}>Email<input className="field" style={{ marginTop: 8 }} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="pk-label" style={{ fontWeight: 600 }}>Password<input className="field" style={{ marginTop: 8 }} type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" block disabled={busy || name.trim().length < 2 || pw.length < 8}>{busy ? 'Creating…' : 'Create account'}</Button>
        <button type="button" className="link" onClick={onBack}>I have an account</button>
      </form>
    </Centered>
  );
}

export function NotStaff() {
  return (
    <Centered>
      <span className="pk-wide pk-muted">PackPass · Partner</span>
      <h1 className="pk-display-lg" style={{ margin: '12px 0' }}>This account isn't linked to a partner yet.</h1>
      <p className="pk-body pk-muted" style={{ margin: '0 0 20px' }}>Once PackPass approves your partner application, we link your account and the dashboard opens here. Added to a team? Ask the owner to check they used this account’s email.</p>
      <Button variant="quiet" onClick={() => signOut()}>Use another account</Button>
    </Centered>
  );
}

export const Centered = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-raised)' }}>
    <div style={{ width: 420, maxWidth: '100%', padding: 32, borderRadius: 32, background: 'var(--bg)', boxShadow: 'var(--shadow-card)' }}>{children}</div>
  </div>
);
