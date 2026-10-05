// "Why this class" in one line, by class_types.discipline (docs/COPY_REFRESH_SPEC.md, phase 2). Same constant
// in apps/web/src/lib/payoffs.ts and apps/member/src/data/payoffs.ts.

export const PAYOFFS: Record<string, string> = {
  Agility: 'Builds focus and confidence',
  Scent: 'Tires the brain fast',
  Sprint: 'For dogs who need to really run',
  Herding: 'A job for dogs bred to have one',
  'Open play': 'Room to run off leash',
  Play: 'Burns energy with good-fit dogs',
  Sniff: 'A quiet, private space to decompress',
  Skills: 'Work on the stuff that\'s hard',
  Fitness: 'Strength and stamina, done right',
  Assessment: 'Unlocks group classes at every partner',
};

/** The payoff line for a discipline, or null (the UI then hides the line). */
export const payoff = (discipline: string | null | undefined): string | null => (discipline && PAYOFFS[discipline]) || null;
