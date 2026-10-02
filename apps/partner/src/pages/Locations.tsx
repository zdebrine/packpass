import { QrCode } from 'lucide-react';
import { useState } from 'react';

import { errorCopy, loadSessions, saveLocation } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { withClasses, type SessionView } from '@/lib/sessions';
import { addDays, austin, mondayOf, time, ymd } from '@/lib/time';
import { Button, ErrorLine, Modal, Row, Tag, photoUrl } from '@/ui/kit';
import { QrModal } from './Roster';

const TYPE: Record<string, string> = { trainer: 'Trainer', facility: 'Facility', sport_club: 'Sport club', behavior_specialist: 'Behavior specialist', outdoor_space: 'Outdoor space' };

/** 06 Locations: where the partner trains, the notes members get on arrival, and today's check-in codes. */
export function Locations() {
  const { partner, classes, reloadCatalog } = usePartner();
  const now = new Date();
  const mon = mondayOf(now);
  const { data } = useData(async () => withClasses(await loadSessions(austin(mon, 0), austin(addDays(mon, 7), 0)), (id) => classes.find((c) => c.id === id)), [mon, classes]);
  const [editing, setEditing] = useState(false);
  const [codes, setCodes] = useState(false);
  const [qr, setQr] = useState<SessionView | null>(null);

  const week = (data ?? []).filter((s) => !s.cancelled_at);
  const today = week.filter((s) => ymd(s.start) === ymd(now) && s.end > now);
  const live = classes.filter((c) => c.status === 'live');
  const disciplines = Array.from(new Set(live.map((c) => c.discipline)));
  const cover = live.find((c) => c.image)?.image ?? 'grass';
  const rows: [string, string][] = [
    ['Address', partner.address],
    ['Parking', partner.parking || 'Not set'],
    ['Meet at', partner.meet_at || 'Not set'],
    ['Sessions this week', String(week.length)],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1240 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">Where you train</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Locations</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 20 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 200, color: '#fff' }}>
            <img src={photoUrl(cover)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
            <div style={{ position: 'absolute', top: 16, left: 16 }}><Tag tone="glass">{TYPE[partner.type] ?? 'Partner'}</Tag></div>
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 className="pk-display-md" style={{ margin: 0 }}>{partner.name}</h2>
              <span className="pk-caption" style={{ opacity: 0.92 }}>{partner.street}</span>
            </div>
          </div>
          <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span className="pk-label pk-muted">{k}</span>
                <span className="pk-label" style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            {disciplines.length ? <Row gap={6} style={{ paddingTop: 4 }}>{disciplines.map((d) => <Tag key={d}>{d}</Tag>)}</Row> : null}
            <span className="pk-caption pk-muted">{`${live.length} live class${live.length === 1 ? '' : 'es'}`}</span>
            <Row style={{ paddingTop: 4 }}>
              <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" variant="quiet" style={{ background: 'var(--bg)' }} onClick={() => setCodes(true)}>Check-in QR</Button>
            </Row>
          </div>
        </div>
      </div>
      <span className="pk-caption pk-muted">Training somewhere else too? Ask PackPass to add the location. Each one gets its own address and check-in.</span>

      {editing ? <EditLocation onClose={() => setEditing(false)} onSaved={async () => { await reloadCatalog(); setEditing(false); }} /> : null}
      {codes ? (
        <Modal eyebrow={partner.name} title="Check-in QR" onClose={() => setCodes(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="pk-body" style={{ textWrap: 'pretty' }}>Each session has its own code. Open one on a tablet at the gate, or print it.</span>
            {today.length ? today.map((s) => (
              <button key={s.id} type="button" onClick={() => { setCodes(false); setQr(s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: 0, borderRadius: 20, background: 'var(--surface-raised)', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
                <QrCode size={22} />
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="pk-label" style={{ fontWeight: 600 }}>{s.cls.title}</span>
                  <span className="pk-caption pk-muted">{`${time(s.start)} · ${s.booked} booked`}</span>
                </span>
                <span className="pk-label pk-num" style={{ fontWeight: 600, letterSpacing: '.15em' }}>{s.check_in_code}</span>
              </button>
            )) : <span className="pk-label pk-muted">No more sessions today. Codes for other days are on each session's roster.</span>}
          </div>
        </Modal>
      ) : null}
      {qr ? <QrModal s={qr} onClose={() => setQr(null)} /> : null}
    </div>
  );
}

function EditLocation({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { partner } = usePartner();
  const [parking, setParking] = useState(partner.parking ?? '');
  const [meetAt, setMeetAt] = useState(partner.meet_at ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveLocation(parking, meetAt); await onSaved(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow={partner.address} title="Arrival notes" width={560} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span className="pk-body pk-muted" style={{ textWrap: 'pretty' }}>Members see these on the class page, so they know where to go when they arrive.</span>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="pk-label" style={{ fontWeight: 600 }}>Parking</span>
          <input className="field" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Park in the gravel lot by the gate" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="pk-label" style={{ fontWeight: 600 }}>Meet at</span>
          <input className="field" value={meetAt} onChange={(e) => setMeetAt(e.target.value)} placeholder="Barn gate, field 2" />
        </label>
        <span className="pk-caption pk-muted">To change the address, contact PackPass. Members' distances are measured from it.</span>
        <Row><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button><ErrorLine>{error}</ErrorLine></Row>
      </div>
    </Modal>
  );
}
