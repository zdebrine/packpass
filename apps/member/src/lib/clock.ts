import { NOW } from '@/data/fixtures';

let live = false;

/** Sample data runs on the moment the designs depict; a live backend runs on the real clock. */
export const setLiveClock = (on: boolean) => {
  live = on;
};

export const now = () => (live ? new Date() : NOW);
