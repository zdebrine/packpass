import { useState } from 'react';

import { errorCopy, flagReassessment } from '@/lib/api';
import { clearanceName } from '@/lib/clearances';
import { Button, ErrorLine, Field, Modal, Segmented } from './kit';

type Kind = string;

/**
 * Re-assessment: send a cleared dog back for a new assessment, with a reason the owner reads. The clearance pauses
 * straight away (classes that need it close for the dog) and opens again when the dog passes.
 */
export function ReassessModal({ dogId, dogName, types, onClose, onDone }: { dogId: string; dogName: string; types: Kind[]; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<Kind>(types[0]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setError(null);
    try { await flagReassessment(dogId, type, reason); onDone(); onClose(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  return (
    <Modal eyebrow={dogName} title="Ask for a re-assessment" onClose={onClose}
      footer={<><ErrorLine>{error}</ErrorLine><Button variant="quiet" onClick={onClose}>Cancel</Button><Button disabled={busy || !reason.trim()} onClick={send}>{busy ? 'Sending…' : 'Send'}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {types.length > 1 ? <Segmented label="Clearance" options={types.map((t) => ({ value: t, label: clearanceName(t) }))} value={type} onChange={setType} /> : null}
        <Field label="Reason" note={`${dogName}'s ${clearanceName(type)} clearance pauses now. The owner gets this reason and is asked to book a re-assessment.`}>
          <textarea className="area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Three sessions in a row ended early after rough play. Worth a fresh look before more group classes." />
        </Field>
      </div>
    </Modal>
  );
}

/** Restores a clearance flagged by mistake. */
export const undoReassessment = (dogId: string, type: Kind) => flagReassessment(dogId, type, '', true);
