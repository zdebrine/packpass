import { FileSignature, FileText, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { errorCopy, loadWaiver, loadWaiverSignatures, removeWaiver, saveWaiver, signedUrls, uploadWaiverPdf, type PartnerWaiver } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { monthDay } from '@/lib/time';
import { Badge, Button, ErrorLine, Field, Ico, Modal, Row } from '@/ui/kit';

/**
 * The partner's own waiver (Locations). Members sign PackPass's waiver for every booking; a partner can add
 * theirs, which members sign once, in the booking sheet, on their first booking there. Owners write it as
 * pasted text, a PDF, or both, with up to three short points the sheet shows.
 */
export function WaiverCard() {
  const { partner, staff } = usePartner();
  const owner = staff.role === 'owner';
  const { data, reload } = useData(async () => {
    const w = await loadWaiver(partner.id);
    return { w, signed: w ? await loadWaiverSignatures() : 0 };
  }, [partner.id]);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const w = data?.w ?? null;

  const openPdf = async (path: string) => {
    const tab = window.open('', '_blank');
    try {
      const urls = await signedUrls('waivers', [path]);
      if (tab) tab.location.href = urls[path]; else window.location.href = urls[path];
    } catch (e) {
      tab?.close();
      setError(errorCopy(e));
    }
  };
  const remove = async () => {
    setError(null);
    try { await removeWaiver(); setRemoving(false); reload(); } catch (e) { setError(errorCopy(e)); }
  };

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row gap={10} wrap={false}>
        <span className="pp-row-thumb pp-row-thumb-icon pp-row-thumb-round" style={{ width: 36, height: 36 }}><Ico icon={FileSignature} /></span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span className="pp-title">Your waiver</span>
          <span className="pp-caption pp-muted">Members sign it once, on their first booking with you.</span>
        </span>
      </Row>
      {!data ? null : w ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="pp-label">{w.title}</span>
            <span className="pp-caption pp-muted">{`Version ${w.version} · Saved ${monthDay(new Date(w.created_at))} · ${data.signed} ${data.signed === 1 ? 'member' : 'members'} signed`}</span>
          </div>
          {w.summary.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {w.summary.map((p, i) => <li key={i} className="pp-caption">{p}</li>)}
            </ul>
          ) : null}
          <Row gap={4}>
            {w.body ? <Badge>Text</Badge> : null}
            {w.pdf_path ? <Badge icon={FileText}>PDF</Badge> : null}
          </Row>
          {removing ? (
            <>
              <span className="pp-caption" style={{ textWrap: 'pretty' }}>Members stop signing it on new bookings. Signatures so far stay on record.</span>
              <Row><Button size="sm" variant="outline" onClick={() => setRemoving(false)}>Keep it</Button><Button size="sm" onClick={remove}>Remove waiver</Button></Row>
            </>
          ) : (
            <Row style={{ marginTop: 'auto' }}>
              {w.pdf_path ? <Button size="sm" variant="outline" icon={FileText} onClick={() => openPdf(w.pdf_path!)}>View PDF</Button> : null}
              {owner ? <Button size="sm" variant="outline" label="Edit waiver" onClick={() => setEditing(true)}>Edit</Button> : null}
              {owner ? <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>Remove</Button> : null}
            </Row>
          )}
        </>
      ) : (
        <>
          <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Members already sign the PackPass waiver for every class. Add your own and PackPass asks for it on each member's first booking with you.</span>
          {owner ? <Row style={{ marginTop: 'auto' }}><Button size="sm" variant="outline" onClick={() => setEditing(true)}>Add waiver</Button></Row>
            : <span className="pp-caption pp-muted">Owners can add one.</span>}
        </>
      )}
      <ErrorLine>{error}</ErrorLine>
      {editing ? <EditWaiver current={w} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} /> : null}
    </div>
  );
}

function EditWaiver({ current, onClose, onSaved }: { current: PartnerWaiver | null; onClose: () => void; onSaved: () => void }) {
  const { partner } = usePartner();
  const [title, setTitle] = useState(current?.title ?? `${partner.name} waiver`);
  const [points, setPoints] = useState(() => [0, 1, 2].map((i) => current?.summary[i] ?? ''));
  const [body, setBody] = useState(current?.body ?? '');
  const [pdf, setPdf] = useState<{ path: string; name: string } | null>(current?.pdf_path ? { path: current.pdf_path, name: 'Current PDF' } : null);
  const [busy, setBusy] = useState<'upload' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy('upload'); setError(null);
    try { setPdf({ path: await uploadWaiverPdf(partner.id, file), name: file.name }); } catch (e) { setError(errorCopy(e)); } finally { setBusy(null); if (input.current) input.current.value = ''; }
  };
  const save = async () => {
    setBusy('save'); setError(null);
    try { await saveWaiver(title, points.map((p) => p.trim()).filter(Boolean), body, pdf?.path ?? null); onSaved(); } catch (e) { setError(errorCopy(e)); setBusy(null); }
  };

  return (
    <Modal eyebrow={partner.name} title={current ? 'Edit your waiver' : 'Add your waiver'} width={560} onClose={onClose}
      footer={<><ErrorLine>{error}</ErrorLine><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!!busy || (!body.trim() && !pdf)} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save waiver'}</Button></>}>
      <span className="pp-body pp-muted" style={{ textWrap: 'pretty' }}>Paste the text, upload a PDF, or both. Members read it in the booking sheet and sign with their name.</span>
      <Field label="Title"><input className="field" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="In short" note="Up to three points members see before they sign.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {points.map((p, i) => (
            <input key={i} className="field" aria-label={`Point ${i + 1}`} value={p} maxLength={140}
              placeholder={['You stay with your dog and keep them leashed until the coach releases them.', 'Your dog has no bite history.', `${partner.short_name || partner.name} isn't liable for injuries from normal play and training.`][i]}
              onChange={(e) => setPoints((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </div>
      </Field>
      <Field label="Waiver text"><textarea className="field" aria-label="Waiver text" rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste your full waiver here." /></Field>
      <Field label="PDF" note="Up to 10 MB.">
        {pdf ? (
          <Row gap={10} wrap={false}>
            <Ico icon={FileText} />
            <span className="pp-label ellipsis" style={{ flex: 1, minWidth: 0 }}>{pdf.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setPdf(null)}>Remove</Button>
          </Row>
        ) : (
          <Row><Button size="sm" variant="outline" icon={Upload} disabled={!!busy} onClick={() => input.current?.click()}>{busy === 'upload' ? 'Uploading…' : 'Upload PDF'}</Button></Row>
        )}
        <input ref={input} type="file" accept="application/pdf" hidden aria-label="Upload waiver PDF" onChange={(e) => upload(e.target.files?.[0])} />
      </Field>
      {current ? <span className="pp-caption pp-muted" style={{ textWrap: 'pretty' }}>Saving a change starts version {current.version + 1}. Members sign it again on their next booking with you.</span> : null}
    </Modal>
  );
}
