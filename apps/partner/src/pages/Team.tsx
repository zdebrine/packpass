import { useState } from 'react';

import { cancelInvite, errorCopy, inviteToTeam, loadTeam, removeFromTeam, type TeamRow } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { Avatar, Button, Chip, ErrorLine, Field, Row, Tag } from '@/ui/kit';
import { Loading } from '@/pages/Overview';

const NEW = '__new';

/**
 * Team (owners only, not in the designs): who can open this dashboard. Inviting an email that already has a
 * PackPass account adds it straight away; anyone else gets added when they create an account with that
 * email (Create an account on the sign-in page, or the app). There's no invite email yet, so the page gives
 * the owner a message to send.
 */
export function Team() {
  const { partner, trainers, reloadCatalog } = usePartner();
  const { data, reload } = useData(loadTeam, []);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'trainer'>('trainer');
  const [trainer, setTrainer] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; result: 'linked' | 'invited' } | null>(null);
  if (!data) return <Loading />;

  const staff = data.filter((r) => r.kind === 'staff');
  const invites = data.filter((r) => r.kind === 'invite');
  const taken = new Set(data.map((r) => r.trainer_id).filter(Boolean)); // on the team or held by an invite
  const free = trainers.filter((t) => !taken.has(t.id));
  const ready = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && (trainer === NEW ? newName.trim().length >= 2 : role === 'owner' || !!trainer);

  const invite = async () => {
    setBusy(true); setError(null); setDone(null);
    try {
      const result = await inviteToTeam(email.trim(), role, trainer === NEW ? null : trainer, trainer === NEW ? newName.trim() : null);
      setDone({ email: email.trim().toLowerCase(), result });
      setEmail(''); setTrainer(null); setNewName('');
      if (trainer === NEW) await reloadCatalog();
      reload();
    } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">{`Team · ${staff.length}`}</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Your team</h1>
        <span className="pk-label pk-muted">Everyone who can open {partner.name}’s dashboard. Trainers run sessions, rosters, notes and results; owners also see earnings and manage the team.</span>
      </header>

      <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 className="pk-title" style={{ margin: 0 }}>Add someone</h2>
        <Field label="Email">
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@example.com" style={{ background: 'var(--bg)' }} />
        </Field>
        <Field label="Role">
          <Row gap={6}>
            <Chip on={role === 'trainer'} onClick={() => setRole('trainer')}>Trainer</Chip>
            <Chip on={role === 'owner'} onClick={() => setRole('owner')}>Owner</Chip>
          </Row>
        </Field>
        <Field label="Their trainer profile" note={role === 'owner' ? 'Notes and results they send are signed with this name. Leave as None for an owner who doesn’t train.' : 'Notes and results they send are signed with this name. A new profile shows to members once it teaches a class; PackPass adds credentials.'}>
          <Row gap={6}>
            {role === 'owner' ? <Chip on={!trainer} onClick={() => setTrainer(null)}>None</Chip> : null}
            {free.map((t) => <Chip key={t.id} on={trainer === t.id} onClick={() => setTrainer(t.id)}>{t.name}</Chip>)}
            <Chip on={trainer === NEW} onClick={() => setTrainer(NEW)}>New profile</Chip>
          </Row>
          {trainer === NEW ? (
            <input className="field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Their name, as members will see it" style={{ background: 'var(--bg)' }} aria-label="New trainer's name" />
          ) : null}
        </Field>
        <Row gap={12}>
          <Button disabled={busy || !ready} onClick={invite}>{busy ? 'Adding…' : 'Add to team'}</Button>
          <ErrorLine>{error}</ErrorLine>
        </Row>
        {done ? (
          done.result === 'linked'
            ? <span className="pk-label" style={{ color: 'var(--turf)', fontWeight: 600 }}>{`${done.email} is on the team. The dashboard opens for them next time they sign in.`}</span>
            : <InviteMessage email={done.email} partnerName={partner.name} lead="Invite saved. They join the team when they create an account with this email. Send them this:" />
        ) : null}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="pk-title" style={{ margin: 0 }}>On the team</h2>
        {staff.map((s) => <StaffRow key={s.id} s={s} onDone={reload} />)}
      </section>

      {invites.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="pk-title" style={{ margin: 0 }}>{`Waiting to join · ${invites.length}`}</h2>
          {invites.map((i) => <InviteRow key={i.id} i={i} partnerName={partner.name} onDone={reload} />)}
        </section>
      ) : null}
    </div>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 20, background: 'var(--surface-raised)', flexWrap: 'wrap' } as const;

function StaffRow({ s, onDone }: { s: TeamRow; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true); setError(null);
    try { await removeFromTeam(s.id); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <div style={rowStyle}>
      <Avatar name={s.name || s.email} size={40} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>{`${s.name || s.email}${s.is_me ? ' (you)' : ''}`}</span>
        <span className="pk-caption pk-muted">{[s.email, s.trainer_name ? `signs as ${s.trainer_name}` : null].filter(Boolean).join(' · ')}</span>
      </div>
      <Tag>{s.role === 'owner' ? 'Owner' : 'Trainer'}</Tag>
      {s.is_me ? null : confirm ? (
        <Row gap={8} wrap={false}>
          <span className="pk-caption pk-muted">They keep their PackPass account.</span>
          <Button size="sm" disabled={busy} onClick={remove} style={{ background: 'var(--kennel-red)', color: '#fff' }}>{busy ? 'Removing…' : 'Remove'}</Button>
          <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={() => setConfirm(false)}>Keep</Button>
        </Row>
      ) : (
        <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={() => setConfirm(true)}>Remove</Button>
      )}
      {error ? <div style={{ flexBasis: '100%' }}><ErrorLine>{error}</ErrorLine></div> : null}
    </div>
  );
}

function InviteRow({ i, partnerName, onDone }: { i: TeamRow; partnerName: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = async () => {
    setBusy(true); setError(null);
    try { await cancelInvite(i.id); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
      <Avatar name={i.email} size={40} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>{i.email}</span>
        <span className="pk-caption pk-muted">{['Hasn’t created an account yet', i.trainer_name ? `will sign as ${i.trainer_name}` : null].filter(Boolean).join(' · ')}</span>
        {open ? <div style={{ marginTop: 10 }}><InviteMessage email={i.email} partnerName={partnerName} /></div> : null}
        <ErrorLine>{error}</ErrorLine>
      </div>
      <Tag>{i.role === 'owner' ? 'Owner' : 'Trainer'}</Tag>
      <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={() => setOpen(!open)}>{open ? 'Hide message' : 'Message'}</Button>
      <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} disabled={busy} onClick={cancel}>Cancel invite</Button>
    </div>
  );
}

/** What to send the person, with a copy button (there's no invite email until PackPass has a sending domain). */
function InviteMessage({ email, partnerName, lead }: { email: string; partnerName: string; lead?: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${partnerName} added you to their team on PackPass. Go to ${window.location.origin}, choose "Create an account" and use this email (${email}). We'll email you a 6-digit code to confirm it, then your dashboard opens.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lead ? <span className="pk-label" style={{ fontWeight: 600 }}>{lead}</span> : null}
      <div className="pk-body" style={{ padding: '14px 18px', borderRadius: 16, background: 'var(--bg)', textWrap: 'pretty' }}>{text}</div>
      <Row gap={10}>
        <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={copy}>{copied ? 'Copied' : 'Copy message'}</Button>
      </Row>
    </div>
  );
}
