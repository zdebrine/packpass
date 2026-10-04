import { useState } from 'react';

import { errorCopy, loadAdminPartners, loadAdminTrainers, saveAdminPartner, saveAdminTrainer, type AdminPartner, type AdminTrainer } from '@/lib/api';
import { useData } from '@/lib/partner';
import { money } from '@/lib/time';
import { Button, Chip, ErrorLine, Field, Modal, Row, Tag } from '@/ui/kit';
import { Loading } from '@/pages/Overview';

const TYPES: [string, string][] = [['facility', 'Facility'], ['sport_club', 'Sport club'], ['trainer', 'Independent trainer'], ['behavior_specialist', 'Behavior specialist'], ['outdoor_space', 'Outdoor space']];
const typeLabel = (t: string) => TYPES.find(([k]) => k === t)?.[1] ?? t;

/** PackPass › Partners: every partner, with their trainers. Add or edit either. */
export function Partners() {
  const { data, reload } = useData(async () => ({ partners: await loadAdminPartners(), trainers: await loadAdminTrainers() }), []);
  const [editing, setEditing] = useState<AdminPartner | 'new' | null>(null);
  const [trainer, setTrainer] = useState<{ partner: AdminPartner; t: AdminTrainer | null } | null>(null);
  if (!data) return <Loading />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pk-wide pk-muted">PackPass · Partners</span>
          <h1 className="pk-display-xl" style={{ margin: 0 }}>Partners</h1>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>Add partner</Button>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.partners.map((p) => (
          <div key={p.id} className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row gap={12} wrap={false} style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <Row gap={8}><span className="pk-title">{p.name}</span><Tag>{typeLabel(p.type)}</Tag>{p.in_review ? <Tag tone="warning">{`${p.in_review} to review`}</Tag> : null}</Row>
                <span className="pk-caption pk-muted">{`${p.address} · ${p.live_classes} live classes · ${p.staff} staff · ${money(p.payout_rate_cents)} a credit`}</span>
              </div>
              <Row gap={8} wrap={false}>
                <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={() => setTrainer({ partner: p, t: null })}>Add trainer</Button>
                <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={() => setEditing(p)}>Edit</Button>
              </Row>
            </Row>
            <Row gap={6}>
              {data.trainers.filter((t) => t.partner_id === p.id).map((t) => (
                <Chip key={t.id} onClick={() => setTrainer({ partner: p, t })}>{`${t.name}${t.classes ? ` · ${t.classes}` : ''}`}</Chip>
              ))}
              {data.trainers.some((t) => t.partner_id === p.id) ? null : <span className="pk-caption pk-muted">No trainers yet.</span>}
            </Row>
          </div>
        ))}
      </div>
      {editing ? <PartnerModal p={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
      {trainer ? <TrainerModal partner={trainer.partner} t={trainer.t} onClose={() => setTrainer(null)} onSaved={() => { setTrainer(null); reload(); }} /> : null}
    </div>
  );
}

function PartnerModal({ p, onClose, onSaved }: { p: AdminPartner | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: p?.name ?? '', short_name: p?.short_name ?? '', type: p?.type ?? 'facility', street: p?.street ?? '', address: p?.address ?? '',
    lat: p?.lat?.toString() ?? '', lng: p?.lng?.toString() ?? '', parking: p?.parking ?? '', meet_at: p?.meet_at ?? '',
    rate: ((p?.payout_rate_cents ?? 950) / 100).toFixed(2),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await saveAdminPartner(p?.id ?? null, {
        ...f, lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null, payout_rate_cents: Math.round(Number(f.rate) * 100) || 950,
      });
      onSaved();
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const input = (k: keyof typeof f, placeholder?: string) => <input className="field" value={f[k]} onChange={set(k)} placeholder={placeholder} />;
  return (
    <Modal eyebrow={p ? p.id : 'PackPass · Partners'} title={p ? `Edit ${p.name}` : 'Add a partner'} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Name">{input('name', 'Northside Canine')}</Field>
        <Field label="Short name">{input('short_name', 'Northside')}</Field>
        <div style={{ gridColumn: '1/-1' }}><Field label="Type"><Row gap={6}>{TYPES.map(([k, l]) => <Chip key={k} on={f.type === k} onClick={() => setF({ ...f, type: k })}>{l}</Chip>)}</Row></Field></div>
        <Field label="Street (shown on cards)">{input('street', 'Burnet Rd')}</Field>
        <Field label="Address">{input('address', '5701 Burnet Rd')}</Field>
        <Field label="Latitude" note="For distances in the app. Right-click the spot in Google Maps to copy both.">{input('lat', '30.329')}</Field>
        <Field label="Longitude">{input('lng', '-97.739')}</Field>
        <Field label="Parking">{input('parking', 'Street parking on Burnet')}</Field>
        <Field label="Meet at">{input('meet_at', 'Front desk')}</Field>
        <Field label="Payout per credit ($)">{input('rate', '9.50')}</Field>
      </div>
      <Row style={{ marginTop: 20 }}><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : p ? 'Save' : 'Add partner'}</Button><ErrorLine>{error}</ErrorLine></Row>
    </Modal>
  );
}

function TrainerModal({ partner, t, onClose, onSaved }: { partner: AdminPartner; t: AdminTrainer | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(t?.name ?? '');
  const [credential, setCredential] = useState(t?.credential ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveAdminTrainer(t?.id ?? null, partner.id, name, credential); onSaved(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow={partner.name} title={t ? `Edit ${t.name}` : 'Add a trainer'} width={520} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Ruiz" /></Field>
        <Field label="Credential" note="Shown under their name, e.g. 'Reactivity and recall · CPDT-KA'. The partner adds the bio and specialties.">
          <input className="field" value={credential} onChange={(e) => setCredential(e.target.value)} />
        </Field>
        <Row><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : t ? 'Save' : 'Add trainer'}</Button><ErrorLine>{error}</ErrorLine></Row>
      </div>
    </Modal>
  );
}
