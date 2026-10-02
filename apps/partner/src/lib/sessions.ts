import type { ClassType, Session } from './api';
import { hourOf, time } from './time';

export interface SessionView extends Session { cls: ClassType; start: Date; end: Date }

/** Joins sessions to their classes (sessions of classes not loaded are dropped). */
export function withClasses(sessions: Session[], classById: (id: string) => ClassType | undefined): SessionView[] {
  return sessions.flatMap((s) => {
    const cls = classById(s.class_id);
    if (!cls) return [];
    const start = new Date(s.starts_at);
    return [{ ...s, cls, start, end: new Date(start.getTime() + cls.duration_min * 60_000) }];
  });
}

export const isFull = (s: Session) => s.spots_left <= 0;
export const statusOf = (s: SessionView, now = new Date()) =>
  s.cancelled_at ? 'Cancelled' : s.end < now ? 'Done' : s.start <= now ? 'In session' : 'Upcoming';
export const fillLabel = (s: Session) =>
  isFull(s) ? `Full${s.waiting ? ` · ${s.waiting} waitlist` : ''}` : `${s.booked} of ${s.packpass_spots}`;
export const credits = (n: number | null) => (n == null ? 'Credits pending' : `${n} credit${n === 1 ? '' : 's'}`);
export const startHour = (s: SessionView) => hourOf(s.start);
export const timeRange = (s: SessionView) => `${time(s.start)} – ${time(s.end)}`;
