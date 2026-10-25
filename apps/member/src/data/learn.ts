import type { PhotoKey, Video, VideoWatch } from './types';

/** Sample mode's library: the eight videos in the Learn designs (16), the first one new this week. */
const V: [string, string, string, number, string, PhotoKey, string[]][] = [
  ['How to keep your dog stimulated on rainy and snowy days', 'maren', 'Enrichment', 728, 'Five indoor games that work the nose and the brain when a long run is off the table. Fifteen minutes tires most dogs as much as an hour outside.', 'dog_sleeping_while_owner_reads', ['enrichment']],
  ['Working on recall at home', 'dev', 'Recall', 540, 'Build a recall in the hallway before you take it to the park: a name game, a run-away game and a reward your dog will leave anything for.', 'dog_running_on_beach', ['recall']],
  ['Loose-leash walking, ten minutes a day', 'ana', 'Leash', 840, 'Stop rewarding the pull. Ten minutes on a quiet street, every day, with a treat at your seam.', 'pulling_on_leash', ['loose_leash']],
  ['Calm greetings with new dogs', 'dev', 'Social', 660, 'Parallel walks, a curve on the approach and a short hello, so meeting a new dog is boring in the best way.', 'dogs_meeting_on_leash', ['calm_dogs']],
  ['Scent games with a muffin tin', 'maren', 'Enrichment', 420, 'A muffin tin, tennis balls and treats make a puzzle any dog can solve, then a harder one.', 'dog_and_owner_chilling', ['enrichment']],
  ['Settle on a mat', 'ana', 'Focus', 480, 'Teach a place to relax that travels with you: the kitchen, the patio, the vet.', 'dog_chilling_with_owner_on_porch', ['settle_home']],
  ['Recall around distractions', 'dev', 'Recall', 600, 'Add one distraction at a time, at a distance your dog can still win at.', 'dog_getting_pets_at_park', ['recall']],
  ['Cooling down after a hard day', 'maren', 'Focus', 360, 'A slow sniff walk and a chew to bring a busy dog back down after class.', 'dog_being_patient', ['settle_home']],
];
const CHAPTERS = [[0, 'Set up a safe space'], [105, 'Find it: treats around the room'], [250, 'Towel unroll puzzle'], [450, 'Box search'], [620, 'Wind down and settle']] as const;
const TRAINERS: Record<string, [string, string]> = { maren: ['Maren Holt', 'Ridgeline Dog Sport'], dev: ['Dev Patel', 'Ridgeline Dog Sport'], ana: ['Ana Ruiz', 'Northside Canine'] };

export function sampleVideos(now: Date): Video[] {
  return V.map(([title, trainerId, category, durationS, summary, poster, skills], i) => ({
    id: `sample-video-${i + 1}`, title, summary, category, trainerId, trainer: TRAINERS[trainerId][0], partner: TRAINERS[trainerId][1],
    poster, videoPath: null, durationS, skills,
    chapters: i === 0 ? CHAPTERS.map(([at, t]) => ({ at, title: t })) : [],
    needs: i === 0 ? ['Small treats', 'An old towel', 'Three cardboard boxes'] : [],
    publishedAt: new Date(now.getTime() - (i === 0 ? 2 : 10 + i * 3) * 86_400_000),
  }));
}

/** A third of the way through the recall video (Continue watching). */
export const sampleWatches = (now: Date): VideoWatch[] => [
  { videoId: 'sample-video-2', positionS: 180, finished: false, saved: false, updatedAt: new Date(now.getTime() - 86_400_000) },
];
