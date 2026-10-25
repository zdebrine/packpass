import { create } from 'zustand';

import { isLive } from '@/api/client';
import * as live from '@/api/live';
import { sampleVideos, sampleWatches } from '@/data/learn';
import type { Video, VideoWatch } from '@/data/types';
import { now } from '@/lib/clock';

/**
 * Learn (16, 17): the published videos and the member's progress. Live mode asks the server whether Learn is on for
 * this member (the `learn` flag) and loads nothing when it isn't; sample mode always shows the designs' library.
 */
interface LearnState {
  enabled: boolean;
  videos: Video[];
  watches: VideoWatch[];
  load: () => Promise<void>;
  /** Saves where the member got to; finishing marks the video watched. */
  progress: (id: string, positionS: number, finished: boolean) => Promise<void>;
  setSaved: (id: string, saved: boolean) => Promise<void>;
  reset: () => void;
}

const empty = { enabled: false, videos: [] as Video[], watches: [] as VideoWatch[] };

export const useLearn = create<LearnState>((set, get) => ({
  ...(isLive ? empty : { enabled: true, videos: sampleVideos(now()), watches: sampleWatches(now()) }),
  load: async () => {
    if (!isLive) return;
    const r = await live.loadLearn();
    set(r);
  },
  progress: async (id, positionS, finished) => {
    const prev = get().watches.find((w) => w.videoId === id);
    const next: VideoWatch = { videoId: id, positionS, finished: finished || !!prev?.finished, saved: !!prev?.saved, updatedAt: now() };
    set({ watches: [next, ...get().watches.filter((w) => w.videoId !== id)] });
    if (isLive) await live.watchVideo(id, positionS, finished);
  },
  setSaved: async (id, saved) => {
    const before = get().watches;
    const prev = before.find((w) => w.videoId === id);
    const next: VideoWatch = { videoId: id, positionS: prev?.positionS ?? 0, finished: !!prev?.finished, saved, updatedAt: prev?.updatedAt ?? now() };
    set({ watches: [next, ...before.filter((w) => w.videoId !== id)] });
    if (!isLive) return;
    try { await live.saveVideo(id, saved); } catch (e) { set({ watches: before }); throw e; }
  },
  reset: () => set(isLive ? empty : { enabled: true, videos: sampleVideos(now()), watches: sampleWatches(now()) }),
}));

export const useVideo = (id: string) => useLearn((s) => s.videos.find((v) => v.id === id));
export const useWatch = (id: string) => useLearn((s) => s.watches.find((w) => w.videoId === id));

/** A published video that helps with this skill, for homework and drills; null while Learn is off. */
export const useVideoForSkill = (skillId: string | undefined) =>
  useLearn((s) => (s.enabled && skillId ? s.videos.find((v) => v.skills.includes(skillId)) ?? null : null));

/** Started, not finished, and more than 30 seconds from the end: Continue watching, most recent first. */
export function continueWatching(videos: Video[], watches: VideoWatch[]) {
  return watches
    .filter((w) => !w.finished && w.positionS > 0)
    .sort((a, b) => +b.updatedAt - +a.updatedAt)
    .map((w) => ({ video: videos.find((v) => v.id === w.videoId), watch: w }))
    .filter((x): x is { video: Video; watch: VideoWatch } => !!x.video && x.video.durationS - x.watch.positionS > 30);
}

/** "12 min", or "45 sec" for a short one. */
export const minutes = (s: number) => (s < 60 ? `${s} sec` : `${Math.round(s / 60)} min`);
/** 4:32, or 1:02:08 past an hour. */
export const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
};
