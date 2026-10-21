// The catalog the screens read: partners, trainers, classes and the session schedule.
// It starts as the sample data and is replaced by rows from Supabase when the app runs live.

import { classes as sampleClasses, partners as samplePartners, sessions as sampleSessions, trainers as sampleTrainers } from './fixtures';
import type { ClassType, ClearanceInfo, Partner, Session, Trainer } from './types';

export const catalog = {
  partners: { ...samplePartners } as Record<string, Partner>,
  trainers: { ...sampleTrainers } as Record<string, Trainer>,
  classes: { ...sampleClasses } as Record<string, ClassType>,
  sessions: [...sampleSessions] as Session[],
  /** Live mode: the trainer specialties that suit each training path ("Trainers for this"). */
  pathSpecialties: {} as Record<string, string[]>,
  /** Live mode: each training path's Path classes, the classes that count for one of its steps. */
  pathClasses: {} as Record<string, string[]>,
  /** The clearances PackPass offers; live mode replaces these with the clearance_types rows. */
  clearanceTypes: {
    social: { id: 'social', name: 'Social', description: '', scope: 'network', expiryMonths: 12, groupAlsoRequires: null },
    herding: { id: 'herding', name: 'Herding', description: '', scope: 'partner', expiryMonths: 12, groupAlsoRequires: 'social' },
  } as Record<string, ClearanceInfo>,
};

/** A clearance's name ("Social"), or its id capitalised if it isn't in the catalog. */
export const clearanceName = (id: string) => catalog.clearanceTypes[id]?.name ?? id.charAt(0).toUpperCase() + id.slice(1);

export function setCatalog(next: Partial<typeof catalog>) {
  Object.assign(catalog, next);
}

export const sessionById = (id: string) => catalog.sessions.find((s) => s.id === id);
