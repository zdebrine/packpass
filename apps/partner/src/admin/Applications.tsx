import { FileText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { decideApplication, errorCopy, loadApplications, type AdminApplication, type DocKind } from '@/lib/api';
import { useData } from '@/lib/partner';
import { monthDay } from '@/lib/time';
import { useSigned } from '@/lib/useSigned';
import { Button, ErrorLine, Row, Tag } from '@/ui/kit';
import { Empty, Loading } from '@/pages/Overview';

const TYPE: Record<string, string> = { trainer: 'Independent trainer', facility: 'Training facility', sport_club: 'Dog sport club', behavior_specialist: 'Behavior specialist', outdoor_space: 'Outdoor space' };
const DOC: Record<DocKind, string> = { license: 'Business license', insurance: 'Liability insurance', certs: 'Trainer certification', firstaid: 'Pet first aid and CPR', photos: 'Photo of the space' };

/**
 * PackPass › Applications: partner applications waiting for a decision. Approve creates the partner and makes
 * the applicant its owner; Ask for changes sends it back with a note they see when they sign in.
 */
export function Applications() {
  const { data, reload } = useData(loadApplications, []);
  if (!data) return <Loading />;
  const waiting = data.filter((a) => a.status === 'submitted');
  const decided = data.filter((a) => a.status !== 'submitted');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">PackPass · Applications</span>
        <h1 className="pk-display-xl" style={{ margin: 0 }}>Partner applications</h1>
        <span className="pk-label pk-muted">Check the documents, then approve or ask for changes. Approving creates the partner and opens their dashboard.</span>
      </header>
      {waiting.length ? waiting.map((a) => <ApplicationCard key={a.id} a={a} onDone={reload} />) : <Empty>No applications waiting. New ones from the dashboard’s Apply to partner show up here.</Empty>}
      {decided.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="pk-title" style={{ margin: 0 }}>Decided in the last 30 days</h2>
          {decided.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 20, background: 'var(--surface-raised)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="pk-label" style={{ fontWeight: 600 }}>{a.business_name}</span>
                <span className="pk-caption pk-muted">{[a.contact_name, a.email].filter(Boolean).join(' · ')}</span>
              </div>
              {a.status === 'approved'
                ? <><Tag tone="signal">Approved</Tag>{a.partner_id ? <Link to="/admin/partners" className="pk-caption">Set its map location on Partners</Link> : null}</>
                : <><Tag tone="warning">Changes asked</Tag><span className="pk-caption pk-muted" style={{ maxWidth: 380 }}>{a.decline_reason}</span></>}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ApplicationCard({ a, onDone }: { a: AdminApplication; onDone: () => void }) {
  const urls = useSigned('partner-docs', a.docs.map((d) => d.path));
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(true); setError(null);
    try { await decideApplication(a.id, approve, approve ? undefined : reason); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const facts: [string, string | null][] = [
    ['Contact', [a.contact_name, a.phone].filter(Boolean).join(' · ')], ['Email', a.email], ['Address', a.address],
    ['Website', a.website], ['Sessions happen', a.wheres.join(', ') || null], ['Services', a.services.join(', ')],
    ['Formats', [a.formats.join(', '), a.group_size ? `groups of ${a.group_size}` : null].filter(Boolean).join(' · ') || null], ['Legal name', a.legal_name],
  ];
  return (
    <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Row gap={10} style={{ justifyContent: 'space-between' }}>
        <Row gap={10}><h2 className="pk-title" style={{ margin: 0 }}>{a.business_name}</h2>{a.partner_type ? <Tag>{TYPE[a.partner_type]}</Tag> : null}</Row>
        {a.submitted_at ? <span className="pk-caption pk-muted">{`Sent ${monthDay(new Date(a.submitted_at))}`}</span> : null}
      </Row>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 24px' }}>
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="pk-caption pk-muted">{k}</span>
            <span className="pk-label" style={{ textWrap: 'pretty' }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="pk-label" style={{ fontWeight: 600 }}>{`Documents · ${a.docs.length}`}</span>
        {a.docs.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: 'var(--surface-raised)' }}>
            <FileText size={16} color="var(--ink-muted)" />
            <span className="pk-caption pk-muted" style={{ width: 170, flex: 'none' }}>{DOC[d.kind]}</span>
            <span className="pk-label" style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</span>
            {urls[d.path] ? <a href={urls[d.path]} target="_blank" rel="noreferrer" className="pk-label" style={{ fontWeight: 600 }}>Open</a> : null}
          </div>
        ))}
      </div>
      {asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="pk-label" style={{ fontWeight: 600 }}>What needs to change?</span>
            <textarea className="area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The insurance certificate expired in March. Upload the current one." />
            <span className="pk-caption pk-muted">They see this when they sign in, edit the application and send it again.</span>
          </label>
          <Row gap={10}>
            <Button disabled={busy || reason.trim().length < 3} onClick={() => decide(false)}>{busy ? 'Sending…' : 'Send it back'}</Button>
            <Button variant="quiet" onClick={() => setAsking(false)}>Cancel</Button>
          </Row>
        </div>
      ) : (
        <Row gap={10}>
          <Button disabled={busy} onClick={() => decide(true)}>{busy ? 'Approving…' : 'Approve'}</Button>
          <Button variant="quiet" disabled={busy} onClick={() => setAsking(true)}>Ask for changes</Button>
        </Row>
      )}
      <ErrorLine>{error}</ErrorLine>
    </section>
  );
}
