import { FileText } from 'lucide-react';
import { useState } from 'react';

import { decideVetRecord, errorCopy, loadVetRecords, type AdminVetRecord, type VaccineKind } from '@/lib/api';
import { useData } from '@/lib/partner';
import { monthDay } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Button, ErrorLine, Row, Tag } from '@/ui/kit';
import { Empty, Loading } from '@/pages/Overview';

const VACCINE: Record<VaccineKind, string> = { rabies: 'Rabies', dhpp: 'DHPP', bordetella: 'Bordetella' };
const expiry = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

/**
 * PackPass › Vet records: the vaccine records members upload during onboarding (or later from Vaccines).
 * Check the record against the expiry dates they entered, then approve (the vaccines show as checked) or deny
 * with a reason, which the member sees on the app's Records Denied screen.
 */
export function VetRecords() {
  const { data, reload } = useData(loadVetRecords, []);
  if (!data) return <Loading />;
  const waiting = data.filter((r) => r.status === 'pending');
  const decided = data.filter((r) => r.status !== 'pending');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">PackPass · Vet records</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Vet records</h1>
        <span className="pk-label pk-muted">Open each record and check it shows the three vaccines with the dates the member entered. Denying sends them your reason so they can upload a new one.</span>
      </header>
      {waiting.length ? waiting.map((r) => <RecordCard key={r.dog_id} r={r} onDone={reload} />) : <Empty>No records waiting. New uploads from the app show up here.</Empty>}
      {decided.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="pk-title" style={{ margin: 0 }}>Decided in the last 30 days</h2>
          {decided.map((r) => (
            <div key={r.dog_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 20, background: 'var(--surface-raised)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="pk-label" style={{ fontWeight: 600 }}>{r.dog_name}</span>
                <span className="pk-caption pk-muted">{[r.owner_name, r.email].filter(Boolean).join(' · ')}</span>
              </div>
              {r.status === 'approved'
                ? <Tag tone="signal">Approved</Tag>
                : <><Tag tone="warning">Denied</Tag><span className="pk-caption pk-muted" style={{ maxWidth: 380 }}>{r.reason}</span></>}
              {r.decided_at ? <span className="pk-caption pk-muted">{monthDay(new Date(r.decided_at))}</span> : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function RecordCard({ r, onDone }: { r: AdminVetRecord; onDone: () => void }) {
  const urls = useSigned('vaccine-docs', [r.document_path]);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(true); setError(null);
    try { await decideVetRecord(r.dog_id, approve, approve ? undefined : reason); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const fileName = r.document_path.slice(r.document_path.lastIndexOf('/') + 1).replace(/^\d+-/, '');
  const complete = r.vaccines.length >= 3;
  return (
    <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Row gap={10} style={{ justifyContent: 'space-between' }}>
        <Row gap={10}><h2 className="pk-title" style={{ margin: 0 }}>{r.dog_name}</h2>{r.mixed || r.breed ? <Tag>{r.mixed ? 'Mixed breed' : r.breed}</Tag> : null}</Row>
        {r.uploaded_at ? <span className="pk-caption pk-muted">{`Uploaded ${monthDay(new Date(r.uploaded_at))}`}</span> : null}
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="pk-caption pk-muted">Owner</span>
          <span className="pk-label">{[r.owner_name, r.email].filter(Boolean).join(' · ')}</span>
        </div>
        {(['rabies', 'dhpp', 'bordetella'] as VaccineKind[]).map((k) => {
          const v = r.vaccines.find((x) => x.type === k);
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="pk-caption pk-muted">{`${VACCINE[k]} expires`}</span>
              <span className="pk-label">{v ? expiry(v.expires_on) : 'Not entered'}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: 'var(--surface-raised)' }}>
        <FileText size={16} color="var(--ink-muted)" />
        <span className="pk-label" style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
        {urls[r.document_path] ? <a href={urls[r.document_path]} target="_blank" rel="noreferrer" className="pk-label" style={{ fontWeight: 600 }}>Open</a> : null}
      </div>
      {denying ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pk-label" style={{ fontWeight: 600 }}>Why are you denying it?</span>
            <textarea className="area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The record doesn't show Bordetella. Ask your vet for the full vaccine history." />
            <span className="pk-caption pk-muted">{`The member sees this in the app and can upload a new record for ${r.dog_name}.`}</span>
          </label>
          <Row gap={10}>
            <Button disabled={busy || reason.trim().length < 3} onClick={() => decide(false)}>{busy ? 'Sending…' : 'Deny record'}</Button>
            <Button variant="quiet" onClick={() => setDenying(false)}>Cancel</Button>
          </Row>
        </div>
      ) : (
        <Row gap={10}>
          <Button disabled={busy || !complete} onClick={() => decide(true)}>{busy ? 'Approving…' : 'Approve'}</Button>
          <Button variant="quiet" disabled={busy} onClick={() => setDenying(true)}>Deny</Button>
          {!complete ? <span className="pk-caption pk-muted">All three expiry dates are needed to approve.</span> : null}
        </Row>
      )}
      <ErrorLine>{error}</ErrorLine>
    </section>
  );
}
