import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { errorCopy, loadSessions, saveLocation } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { withClasses, type SessionView } from '@/lib/sessions';
import { addDays, austin, mondayOf, time, ymd } from '@/lib/time';
import { Badge, Button, ErrorLine, Field, Ico, Modal, Page, PageHead, Row, Tag, photoUrl } from '@/ui/kit';
import { QrModal } from './Roster';
import { WaiverCard } from './Waiver';

const TYPE: Record<string, string> = { trainer: 'Trainer', facility: 'Facility', sport_club: 'Sport club', behavior_specialist: 'Behavior specialist', outdoor_space: 'Outdoor space' };

/** 06 Locations: where the partner trains, the notes members get on arrival, the waiver, and today's check-in codes. */
export function Locations() {
  const { partner, classes, reloadCatalog } = usePartner();
  const now = new Date();
  const mon = mondayOf(now);
  const { data } = useData(async () => withClasses(await loadSessions(austin(mon, 0), austin(addDays(mon, 7), 0)), (id) => classes.find((c) => c.id === id)), [mon, classes]);
  const [editing, setEditing] = useState(false);
  const [params, setParams] = useSearchParams();
  const [codes, setCodesState] = useState(() => !!params.get('qr'));
  const setCodes = (v: boolean) => { setCodesState(v); if (!v && params.get('qr')) setParams({}); };
  const [qr, setQr] = useState<SessionView | null>(null);

  const week = (data ?? []).filter((s) => !s.cancelled_at);
  const today = week.filter((s) => ymd(s.start) === ymd(now) && s.end > now);
  const live = classes.filter((c) => c.status === 'live');
  const disciplines = Array.from(new Set(live.map((c) => c.discipline)));
  const cover = live.find((c) => c.image)?.image ?? 'dog_and_owner_chilling';
  const rows: [string, string][] = [
    ['Address', partner.address],
    ['Parking', partner.parking || 'Not set'],
    ['Meet at', partner.meet_at || 'Not set'],
    ['Sessions this week', String(week.length)],
  ];

  return (
    <Page gap={20}>
      <PageHead title="Locations" sub="Where you train" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', height: 140, color: '#fff' }}>
            <img src={photoUrl(cover)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 10, left: 10 }}><Tag tone="glass">{TYPE[partner.type] ?? 'Partner'}</Tag></div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pp-title">{partner.name}</span><span className="pp-caption pp-muted">{partner.street}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', boxShadow: 'inset 0 -1px 0 var(--line)' }}>
                  <span className="pp-caption pp-muted">{k}</span>
                  <span className="pp-label" style={{ textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
            {disciplines.length ? <Row gap={4}>{disciplines.map((d) => <Badge key={d}>{d}</Badge>)}</Row> : null}
            <span className="pp-caption pp-muted">{`${live.length} live class${live.length === 1 ? '' : 'es'}`}</span>
            <Row style={{ marginTop: 'auto' }}>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" variant="outline" icon={QrCode} onClick={() => setCodes(true)}>Check-in QR</Button>
            </Row>
          </div>
        </div>
        <WaiverCard />
      </div>
      <span className="pp-caption pp-muted">Training somewhere else too? Ask PackPass to add the location. Each one gets its own address and check-in.</span>

      {editing ? <EditLocation onClose={() => setEditing(false)} onSaved={async () => { await reloadCatalog(); setEditing(false); }} /> : null}
      {codes ? (
        <Modal eyebrow={partner.name} title="Check-in QR" width={560} onClose={() => setCodes(false)}>
          <span className="pp-body" style={{ textWrap: 'pretty' }}>Each session has its own code. Open one on a tablet at the gate, or print it.</span>
          {today.length ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {today.map((s) => (
                <button key={s.id} type="button" className="pp-row" onClick={() => { setCodes(false); setQr(s); }} style={{ boxShadow: 'inset 0 -1px 0 var(--line)', minHeight: 52 }}>
                  <span className="pp-row-thumb pp-row-thumb-icon pp-row-thumb-round" style={{ width: 36, height: 36 }}><Ico icon={QrCode} /></span>
                  <span className="pp-row-body"><span className="pp-row-title">{s.cls.title}</span><span className="pp-row-meta">{`${time(s.start)} · ${s.booked} booked`}</span></span>
                  <span className="pp-label pp-num" style={{ letterSpacing: '.15em' }}>{s.check_in_code}</span>
                </button>
              ))}
            </div>
          ) : <span className="pp-label pp-muted">No more sessions today. Codes for other days are on each session's roster.</span>}
        </Modal>
      ) : null}
      {qr ? <QrModal s={qr} onClose={() => setQr(null)} /> : null}
    </Page>
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
    <Modal eyebrow={partner.address} title="Arrival notes" width={480} onClose={onClose}
      footer={<><ErrorLine>{error}</ErrorLine><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button></>}>
      <span className="pp-body pp-muted" style={{ textWrap: 'pretty' }}>Members see these on the class page, so they know where to go when they arrive.</span>
      <Field label="Parking"><input className="field" aria-label="Parking" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Park in the gravel lot by the gate" /></Field>
      <Field label="Meet at"><input className="field" aria-label="Meet at" value={meetAt} onChange={(e) => setMeetAt(e.target.value)} placeholder="Barn gate, field 2" /></Field>
      <span className="pp-caption pp-muted">To change the address, contact PackPass. Members' distances are measured from it.</span>
    </Modal>
  );
}
