import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { errorCopy, loadAdminClearances, type AdminClearance } from '@/lib/api';
import { useData } from '@/lib/partner';
import { monthDay } from '@/lib/time';
import { Badge, Button, ErrorLine, Field } from '@/ui/kit';
import { ReassessModal, undoReassessment } from '@/ui/Reassess';
import { Empty, Loading } from '@/pages/Overview';
import { ClearanceTypes } from './ClearanceTypes';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const month = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

/**
 * PackPass › Clearances: the clearances PackPass offers and their paths (ClearanceTypes), then every dog's
 * current clearances. Ask for a re-assessment when a dog
 * should be seen again (the clearance pauses and the owner gets the reason); flagged dogs stay at the top until
 * they pass again. Undo restores a clearance flagged by mistake.
 */
export function Clearances() {
  const { data, reload } = useData(loadAdminClearances, []);
  const [q, setQ] = useState('');
  const [flagging, setFlagging] = useState<AdminClearance | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Loading />;
  const s = q.trim().toLowerCase();
  const rows = s ? data.filter((r) => [r.dog_name, r.owner_name, r.partner_name].some((x) => x.toLowerCase().includes(s))) : data;
  const undo = async (r: AdminClearance) => {
    setError(null);
    try { await undoReassessment(r.dog_id, r.type); reload(); } catch (e) { setError(errorCopy(e)); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pp-caption pp-muted">PackPass · Clearances</span>
        <h1 className="pp-page-title" style={{ margin: 0 }}>Clearances</h1>
        <span className="pp-label pp-muted">What each clearance means, how a dog earns it, and which dogs hold one.</span>
      </header>
      <ClearanceTypes />
      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 className="pp-title" style={{ margin: 0 }}>Dogs</h2>
        <span className="pp-label pp-muted">Ask for a re-assessment when a dog should be seen again, after a long break or a run of rough sessions. The clearance pauses and the owner gets your reason.</span>
      </section>
      <div style={{ maxWidth: 360 }}><Field label="Find a dog"><input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dog, owner or partner" /></Field></div>
      <ErrorLine>{error}</ErrorLine>
      {rows.length ? (
        <div className="tbl">
          <div className="tbl-head" style={{ gridTemplateColumns: COLS }}><span>Dog</span><span>Clearance</span><span>Assessed</span><span>Status</span><span /></div>
          {rows.map((r) => (
            <div key={`${r.dog_id}-${r.type}-${r.assessed_on}`} className="tbl-row" style={{ gridTemplateColumns: COLS, minHeight: 52 }}>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="pp-heading">{r.dog_name}</span>
                <span className="pp-caption pp-muted ellipsis">{[r.breed, r.owner_name].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="pp-caption">{`${cap(r.type)} · ${r.partner_name}`}</span>
              <span className="pp-caption">{month(r.assessed_on)}</span>
              {r.reassess_at ? (
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                  <Badge tone="warning" icon={ShieldAlert}>{`Re-assess · ${monthDay(new Date(r.reassess_at))}`}</Badge>
                  <span className="pp-caption pp-muted" title={r.reassess_reason ?? undefined}>{`${r.reassess_reason ?? ''} · ${r.reassess_by ?? ''}`}</span>
                </div>
              ) : (
                <Badge tone="cleared" icon={ShieldCheck}>{r.expires_on ? `Until ${month(r.expires_on)}` : 'Cleared'}</Badge>
              )}
              {r.reassess_at
                ? <Button variant="quiet" size="sm" onClick={() => undo(r)}>Undo</Button>
                : <Button variant="outline" size="sm" onClick={() => setFlagging(r)}>Re-assess</Button>}
            </div>
          ))}
        </div>
      ) : <Empty>{s ? 'No clearances match.' : 'No clearances yet.'}</Empty>}
      {flagging ? <ReassessModal dogId={flagging.dog_id} dogName={flagging.dog_name} types={[flagging.type]} onClose={() => setFlagging(null)} onDone={reload} /> : null}
    </div>
  );
}

const COLS = 'minmax(0,1.3fr) minmax(0,1fr) 96px minmax(0,1.4fr) 108px';
