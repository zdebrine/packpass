// The catalog the screens read: partners, trainers, classes and the session schedule.
// It starts as the sample data and is replaced by rows from Supabase when the app runs live.

import { classes as sampleClasses, partners as samplePartners, sessions as sampleSessions, trainers as sampleTrainers } from './fixtures';
import type { ClassType, Partner, Session, Trainer } from './types';

export const catalog = {
  partners: { ...samplePartners } as Record<string, Partner>,
  trainers: { ...sampleTrainers } as Record<string, Trainer>,
  classes: { ...sampleClasses } as Record<string, ClassType>,
  sessions: [...sampleSessions] as Session[],
};

export function setCatalog(next: Partial<typeof catalog>) {
  Object.assign(catalog, next);
}

export const sessionById = (id: string) => catalog.sessions.find((s) => s.id === id);
