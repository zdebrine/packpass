import { Film, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  deleteVideo, errorCopy, learnUrls, loadAdminTrainers, loadAdminPartners, loadLearnFlag, loadSkillOptions, loadVideos, removeLearnFiles, saveVideo,
  setLearnFlag, uploadVideoFile, uploadVideoPoster, type AdminVideo, type LearnFlag, type VideoChapter,
} from '@/lib/api';
import { PHOTOS } from '@/lib/classForm';
import { useData } from '@/lib/partner';
import { photoSrc } from '@/lib/photos';
import { monthDay } from '@/lib/time';
import { Badge, Button, Checkbox, ErrorLine, Field, Ico, Modal, Row, Segmented, Tag, Toggle } from '@/ui/kit';
import { Loading } from '@/pages/Overview';

const CATEGORIES = ['Enrichment', 'Recall', 'Leash', 'Social', 'Focus'];
const FLAG_NOTE: Record<LearnFlag, string> = {
  off: 'Members don\'t see Learn. Add and publish videos here first.',
  admins: 'Only PackPass admins see Learn in the app, to try it before members do.',
  everyone: 'Every member sees Learn and its published videos.',
};

/** 12:08, or 1:02:08 past an hour. */
export const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
};
/** "0:00 Set up a safe space" lines to chapters; null when a line can't be read. */
export function parseChapters(text: string): VideoChapter[] | null {
  const out: VideoChapter[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/.exec(line);
    if (!m) return null;
    out.push({ at: Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]), title: m[4].trim() });
  }
  return out;
}
const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);
/** The poster as an image URL: a library photo, or a signed URL for an upload. */
const posterSrc = (poster: string, urls: Record<string, string>) => (poster.includes('/') ? urls[poster] ?? '' : photoSrc(poster));

/** Seconds in an MP4, read in the browser before it uploads. */
function videoLength(file: File) {
  return new Promise<number>((ok, fail) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); Number.isFinite(el.duration) && el.duration > 0 ? ok(Math.round(el.duration)) : fail(new Error('video_mp4')); };
    el.onerror = () => { URL.revokeObjectURL(url); fail(new Error('video_mp4')); };
    setTimeout(() => fail(new Error('video_mp4')), 8000);
    el.src = url;
  });
}

/**
 * PackPass › Learn (member screens 16 and 17): the training videos members watch on the Learn tab, and the flag that
 * shows the tab. Videos are MP4s in the private learn bucket; a video is a draft until it's published.
 */
export function Learn() {
  const { data: videos, reload } = useData(loadVideos, []);
  const { data: flag, reload: reloadFlag } = useData(loadLearnFlag, []);
  const [editing, setEditing] = useState<AdminVideo | 'new' | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const posters = (videos ?? []).map((v) => v.poster).join('|');
  useEffect(() => {
    if (!posters) return;
    let live = true;
    learnUrls(posters.split('|')).then((u) => live && setUrls(u)).catch(() => {});
    return () => { live = false; };
  }, [posters]);
  if (!videos || !flag) return <Loading />;
  const pickFlag = async (v: LearnFlag) => {
    setError(null);
    try { await setLearnFlag(v); reloadFlag(); } catch (e) { setError(errorCopy(e)); }
  };
  const published = videos.filter((v) => v.published_at).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pp-caption pp-muted">PackPass · Learn</span>
        <h1 className="pp-page-title" style={{ margin: 0 }}>Learn</h1>
        <span className="pp-label pp-muted">Training videos from Pack trainers, for the days at home.</span>
      </header>

      <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Row gap={12} style={{ justifyContent: 'space-between' }}>
          <span className="pp-heading">Who sees the Learn tab</span>
          <Segmented label="Who sees the Learn tab" value={flag} onChange={pickFlag}
            options={[{ value: 'off', label: 'Nobody' }, { value: 'admins', label: 'PackPass admins' }, { value: 'everyone', label: 'Everyone' }]} />
        </Row>
        <span className="pp-caption pp-muted">{FLAG_NOTE[flag]}{flag !== 'off' && !published ? ' No video is published yet, so the tab shows an empty library.' : ''}</span>
        <ErrorLine>{error}</ErrorLine>
      </section>

      <Row gap={12} style={{ justifyContent: 'space-between' }}>
        <h2 className="pp-title" style={{ margin: 0 }}>{`Videos · ${published} published`}</h2>
        <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>New video</Button>
      </Row>
      {videos.length ? (
        <div className="tbl">
          {videos.map((v) => (
            <div key={v.id} className="tbl-row" style={{ gridTemplateColumns: '64px minmax(0,1fr) auto auto', minHeight: 72, alignItems: 'center' }}>
              <img src={posterSrc(v.poster, urls)} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, background: 'var(--surface-sunken)' }} />
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="pp-heading ellipsis">{v.title}</span>
                <span className="pp-caption pp-muted">{[v.category, v.trainer_name ? `${v.trainer_name} · ${v.partner_name}` : 'PackPass', clock(v.duration_s),
                  v.published_at ? `${v.started} started, ${v.finished} finished` : null].filter(Boolean).join(' · ')}</span>
              </div>
              {v.published_at ? <Badge tone="cleared" dot>{`Published ${monthDay(new Date(v.published_at))}`}</Badge> : <Tag tone="warning">Draft</Tag>}
              <Button size="sm" variant="outline" onClick={() => setEditing(v)}>Edit</Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Ico icon={Film} />
          <span className="pp-label pp-muted">No videos yet. Add the first one with New video.</span>
        </div>
      )}

      {editing ? (
        <VideoModal value={editing === 'new' ? null : editing} categories={Array.from(new Set([...CATEGORIES, ...videos.map((v) => v.category)]))}
          urls={urls} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
      ) : null}
    </div>
  );
}

function VideoModal({ value, categories, urls, onClose, onDone }: {
  value: AdminVideo | null; categories: string[]; urls: Record<string, string>; onClose: () => void; onDone: () => void;
}) {
  const { data: trainers } = useData(loadAdminTrainers, []);
  const { data: partners } = useData(loadAdminPartners, []);
  const { data: skills } = useData(loadSkillOptions, []);
  const [title, setTitle] = useState(value?.title ?? '');
  const [summary, setSummary] = useState(value?.summary ?? '');
  const [category, setCategory] = useState(value?.category ?? '');
  const [trainer, setTrainer] = useState(value?.trainer_id ?? '');
  const [video, setVideo] = useState(value ? { path: value.video_path, seconds: value.duration_s, name: '' } : null);
  const [poster, setPoster] = useState(value?.poster ?? PHOTOS[0]);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [chapters, setChapters] = useState((value?.chapters ?? []).map((c) => `${clock(c.at)} ${c.title}`).join('\n'));
  const [needs, setNeeds] = useState((value?.needs ?? []).join('\n'));
  const [picked, setPicked] = useState<string[]>(value?.skills ?? []);
  const [published, setPublished] = useState(!!value?.published_at);
  const [length, setLength] = useState('');
  const [uploading, setUploading] = useState<'video' | 'poster' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Files uploaded in this sheet; whichever aren't saved are removed on close.
  const added = useRef<string[]>([]);
  const videoInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const partnerName = (id: string) => partners?.find((p) => p.id === id)?.name ?? id;

  const close = () => { removeLearnFiles(added.current); onClose(); };
  const pickVideo = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setUploading('video');
    try {
      // A browser that can't decode the MP4 can't read its length either; then it's typed in.
      const seconds = await videoLength(file).catch(() => 0);
      const path = await uploadVideoFile(file);
      added.current.push(path);
      setVideo({ path, seconds, name: file.name });
    } catch (e) { setError(errorCopy(e)); } finally { setUploading(null); }
  };
  const pickPoster = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setUploading('poster');
    try {
      const path = await uploadVideoPoster(file);
      added.current.push(path);
      setPoster(path);
      setPosterUrl(URL.createObjectURL(file));
    } catch (e) { setError(errorCopy(e)); } finally { setUploading(null); }
  };
  const save = async () => {
    setError(null);
    const parsed = parseChapters(chapters);
    if (!video) return setError(errorCopy('bad_video'));
    if (!parsed) return setError(errorCopy('bad_chapters'));
    const typed = parseChapters(`${length.trim()} x`)?.[0]?.at ?? 0;
    const seconds = video.seconds || typed;
    if (!seconds) return setError('Enter how long the video is, like 12:08.');
    setBusy(true);
    try {
      await saveVideo(value?.id ?? null, {
        title, summary, category, trainer_id: trainer || null, video_path: video.path, poster, duration_s: seconds,
        chapters: parsed, needs: lines(needs), skills: picked, published,
      });
      // The files this video used before, if they were replaced, and uploads that weren't kept.
      await removeLearnFiles([
        ...added.current.filter((p) => p !== video.path && p !== poster),
        ...(value && value.video_path !== video.path ? [value.video_path] : []),
        ...(value && value.poster !== poster ? [value.poster] : []),
      ]);
      added.current = [];
      onDone();
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const remove = async () => {
    if (!value) return;
    setBusy(true); setError(null);
    try { await deleteVideo(value); await removeLearnFiles(added.current); onDone(); } catch (e) { setError(errorCopy(e)); setBusy(false); }
  };
  const shownPoster = poster.includes('/') ? posterUrl ?? urls[poster] ?? '' : photoSrc(poster);

  return (
    <Modal eyebrow="PackPass · Learn" title={value ? `Edit ${value.title}` : 'New video'} width={680} onClose={close}
      footer={(
        <Row gap={8} style={{ justifyContent: 'space-between', width: '100%' }}>
          <Row gap={8}>
            <Button disabled={busy || !!uploading} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button variant="quiet" onClick={close}>Cancel</Button>
          </Row>
          {value ? (confirmDelete ? (
            <Row gap={6} wrap={false}>
              <Button size="sm" variant="danger" disabled={busy} onClick={remove}>Delete video</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </Row>
          ) : <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>) : null}
        </Row>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Video" note="An MP4 (H.264), which plays on every phone and browser. It uploads as soon as you pick it.">
          <Row gap={10}>
            <input ref={videoInput} type="file" accept="video/mp4" hidden aria-label="Video file" onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" variant="outline" icon={Upload} disabled={!!uploading} onClick={() => videoInput.current?.click()}>
              {uploading === 'video' ? 'Uploading…' : video ? 'Replace video' : 'Upload video'}
            </Button>
            {video ? <span className="pp-label">{video.seconds ? `${video.name || 'Uploaded'} · ${clock(video.seconds)}` : `${video.name} uploaded`}</span> : null}
            {video && !video.seconds ? (
              <input className="field" style={{ width: 110 }} aria-label="Length" value={length} onChange={(e) => setLength(e.target.value)} placeholder="Length 12:08" />
            ) : null}
          </Row>
        </Field>
        <Field label="Poster" note="Shown on the library and behind the player before it starts.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row gap={12} wrap={false}>
              {shownPoster ? <img src={shownPoster} alt="Poster" style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: 10 }} /> : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PHOTOS.map((p) => (
                  <button key={p} type="button" aria-label={`Use ${p.replace(/_/g, ' ')}`} aria-pressed={poster === p} onClick={() => setPoster(p)}
                    style={{ width: 44, height: 44, padding: 0, border: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', boxShadow: poster === p ? '0 0 0 2px var(--ink)' : 'none' }}>
                    <img src={photoSrc(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </Row>
            <input ref={posterInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Poster file" onChange={(e) => { pickPoster(e.target.files?.[0]); e.target.value = ''; }} />
            <div><Button size="sm" variant="quiet" icon={ImagePlus} disabled={!!uploading} onClick={() => posterInput.current?.click()}>{uploading === 'poster' ? 'Uploading…' : 'Upload a photo'}</Button></div>
          </div>
        </Field>
        <Field label="Title"><input className="field" aria-label="Title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to keep your dog stimulated on rainy days" /></Field>
        <Field label="Summary"><textarea className="field" aria-label="Summary" rows={3} maxLength={600} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Five indoor games that work the nose and the brain." /></Field>
        <Row gap={12} wrap>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <Field label="Category" note="The chips on the library.">
              <input className="field" aria-label="Category" list="learn-categories" maxLength={24} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Enrichment" />
              <datalist id="learn-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <Field label="Trainer">
              <select className="field" aria-label="Trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)}>
                <option value="">PackPass</option>
                {(trainers ?? []).map((t) => <option key={t.id} value={t.id}>{`${t.name} · ${partnerName(t.partner_id)}`}</option>)}
              </select>
            </Field>
          </div>
        </Row>
        <Field label="Skills it helps" note="Picked for a dog when it's working on one of these, and linked from homework on them.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {(skills ?? []).map((s) => (
              <Checkbox key={s.id} on={picked.includes(s.id)} onChange={(on) => setPicked(on ? [...picked, s.id] : picked.filter((x) => x !== s.id))}>{s.label}</Checkbox>
            ))}
          </div>
        </Field>
        <Field label="Chapters" note="One per line: the time it starts, then its title. 0:00 Set up a safe space">
          <textarea className="field" aria-label="Chapters" rows={5} value={chapters} onChange={(e) => setChapters(e.target.value)} placeholder={'0:00 Set up a safe space\n1:45 Find it: treats around the room'} style={{ fontVariantNumeric: 'tabular-nums' }} />
        </Field>
        <Field label="You'll need" note="One per line, up to 8.">
          <textarea className="field" aria-label="You'll need" rows={3} value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder={'Small treats\nAn old towel'} />
        </Field>
        <Toggle on={published} onChange={setPublished} label="Published">
          <span className="pp-label">{published ? 'Published: members see it while Learn is on for them.' : 'Draft: only PackPass sees it.'}</span>
        </Toggle>
        <ErrorLine>{error}</ErrorLine>
      </div>
    </Modal>
  );
}
