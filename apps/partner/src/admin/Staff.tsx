import { useState } from 'react';

import { errorCopy, linkStaff, loadAdminPartners, loadAdminStaff, loadAdminTrainers, unlinkStaff, type AdminStaff } from '@/lib/api';
import { useData } from '@/lib/partner';
import { Button, Chip, ErrorLine, Field, Row, Tag } from '@/ui/kit';
import { Loading } from '@/pages/Overview';

/**
 * PackPass › Staff: who can open each partner's dashboard. Linking needs an existing account: the person
 * signs up in the member app (or is invited from Supabase › Authentication), then gets linked here.
 * Linking an account again moves it (one partner per account); Remove takes it off the team.
 */
export function Staff() {
  const { data, reload } = useData(async () => ({ staff: await loadAdminStaff(), partners: await loadAdminPartners(), trainers: await loadAdminTrainers() }), []);
  const [email, setEmail] = useState('');
  const [partner, setPartner] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'trainer'>('owner');
  const [trainer, setTrainer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return <Loading />;
  const theirTrainers = data.trainers.filter((t) => t.partner_id === partner);

  const link = async () => {
    setBusy(true); setMsg(null);
    try {
      await linkStaff(email.trim(), partner!, role, trainer);
      setMsg({ ok: true, text: `${email.trim()} can now open ${data.partners.find((p) => p.id === partner)?.name}'s dashboard.` });
      setEmail(''); reload();
    } catch (e) { setMsg({ ok: false, text: errorCopy(e) }); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">PackPass · Staff</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Staff accounts</h1>
        <span className="pk-label pk-muted">Link a PackPass account to a partner so it opens their dashboard, usually a new partner’s first owner. The person creates an account first; owners add the rest of their team on Team.</span>
      </header>

      <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 className="pk-title" style={{ margin: 0 }}>Link an account</h2>
        <Field label="Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@theirbusiness.com" style={{ background: 'var(--bg)' }} /></Field>
        <Field label="Partner">
          <Row gap={6}>{data.partners.map((p) => <Chip key={p.id} on={partner === p.id} onClick={() => { setPartner(p.id); setTrainer(null); }}>{p.name}</Chip>)}</Row>
        </Field>
        <Field label="Role" note={role === 'owner' ? 'Owners see everything, including earnings.' : 'Trainers run sessions, rosters, notes and results.'}>
          <Row gap={6}><Chip on={role === 'owner'} onClick={() => setRole('owner')}>Owner</Chip><Chip on={role === 'trainer'} onClick={() => setRole('trainer')}>Trainer</Chip></Row>
        </Field>
        {partner ? (
          <Field label="Their trainer profile" note="Notes and results they send are signed with this name. Optional for owners who don't train.">
            <Row gap={6}>
              <Chip on={!trainer} onClick={() => setTrainer(null)}>None</Chip>
              {theirTrainers.map((t) => <Chip key={t.id} on={trainer === t.id} onClick={() => setTrainer(t.id)}>{t.name}</Chip>)}
            </Row>
          </Field>
        ) : null}
        <Row gap={12}>
          <Button disabled={busy || !email.includes('@') || !partner} onClick={link}>{busy ? 'Linking…' : 'Link account'}</Button>
          {msg ? (msg.ok ? <span className="pk-label" style={{ color: 'var(--turf)', fontWeight: 600 }}>{msg.text}</span> : <ErrorLine>{msg.text}</ErrorLine>) : null}
        </Row>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="pk-title" style={{ margin: 0 }}>{`Linked · ${data.staff.length}`}</h2>
        {data.staff.map((s) => (
          <StaffRow key={s.user_id} s={s} onDone={reload}
            lastOwner={s.role === 'owner' && data.staff.filter((x) => x.partner_id === s.partner_id && x.role === 'owner').length === 1} />
        ))}
      </section>
    </div>
  );
}

function StaffRow({ s, lastOwner, onDone }: { s: AdminStaff; lastOwner: boolean; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true); setError(null);
    try { await unlinkStaff(s.user_id); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 20, background: 'var(--surface-raised)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>{s.name || s.email}</span>
        <span className="pk-caption pk-muted">{s.email}</span>
      </div>
      <span className="pk-label">{s.partner_name}</span>
      <Tag>{s.role === 'owner' ? 'Owner' : 'Trainer'}</Tag>
      {s.trainer_name ? <span className="pk-caption pk-muted">{`as ${s.trainer_name}`}</span> : null}
      {confirm ? (
        <Row gap={8} wrap={false}>
          <span className="pk-caption" style={{ color: lastOwner ? 'var(--kennel-red)' : undefined }}>
            {lastOwner ? `${s.partner_name} will have no owner.` : 'They keep their PackPass account.'}
          </span>
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
