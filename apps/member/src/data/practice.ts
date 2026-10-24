// Practice between classes (Log at home, docs: uploads/LOG_AT_HOME_SPEC.md §5.6 and §7): what an owner can log,
// the skills a dog works on and the drill library. Claude drafted the drills; a partner trainer reviews them.
// supabase/practice.sql is generated from this file (npm run gen:practice), so the database's skills and drills
// match what the app shows. Drill text says {dog} where the dog's name goes.
import type { IconName } from '@/ds/Icon';
import type { FocusSkill, PhotoKey } from './types';

export type Balance = 'physical' | 'mental' | 'social';
export type ActivityKind = 'walk' | 'sniff' | 'park' | 'patio' | 'out' | 'train' | 'play' | 'puzzle' | 'hike' | 'alone' | 'other';
export type Rating = 'tough' | 'mixed' | 'good';
export type DrillLevel = 'start' | 'next' | 'harder';

export interface Activity {
  id: ActivityKind;
  label: string;
  /** Null: the owner picks (Something else). */
  balance: Balance | null;
  image: PhotoKey;
  icon: IconName;
  /** Skills offered first in the Log activity sheet. */
  skills: string[];
}

export interface Skill {
  id: string;
  label: string;
  balance: Balance;
  /** "A loose leash is what makes {dog} easy to bring to a patio." */
  why: string;
  /** Traits (src/data/traits.ts) that make this one of the dog's focus skills. */
  traits: string[];
  pathId: string | null;
  /** Classes that train it (Skill detail › Classes that help, and the Logged step's next nudge). */
  classIds: string[];
  /** Tags partners use on session notes for this skill (apps/partner Notes). */
  aliases: string[];
  /** Best worked on with a trainer: home drills stay gentle and short. */
  trainerLed: boolean;
}

export interface Drill {
  id: string;
  skillId: string;
  title: string;
  minutes: number;
  /** "On your walk" */
  setting: string;
  level: DrillLevel;
  /** What it gets logged as when the practice session finishes. */
  activity: ActivityKind;
  image: PhotoKey;
  goal: string;
  needs: string[];
  steps: string[];
  good: string;
  stop: string;
}

export const ACTIVITIES: Activity[] = [
  { id: 'walk', label: 'Walk', balance: 'physical', image: 'pulling_on_leash', icon: 'footprints', skills: ['loose_leash', 'calm_dogs', 'leave_it'] },
  { id: 'sniff', label: 'Sniff walk', balance: 'mental', image: 'dog_chilling', icon: 'leaf', skills: ['decompression', 'loose_leash'] },
  { id: 'park', label: 'Dog park', balance: 'social', image: 'dog_getting_pets_at_park', icon: 'trees', skills: ['recall', 'play_manners'] },
  { id: 'patio', label: 'Patio or café', balance: 'social', image: 'dog_chilling_with_owner_on_porch', icon: 'coffee', skills: ['settle_public', 'greetings'] },
  { id: 'out', label: 'Out and about', balance: 'social', image: 'dog_chilling_in_car', icon: 'store', skills: ['settle_public', 'calm_people'] },
  { id: 'train', label: 'Training at home', balance: 'mental', image: 'dog_providing_good_eye_contact', icon: 'house', skills: ['recall', 'settle_home', 'greetings', 'leave_it'] },
  { id: 'play', label: 'Play and fetch', balance: 'physical', image: 'athletic_dog_catching_ball', icon: 'circle-dot', skills: ['drop_it', 'recall'] },
  { id: 'puzzle', label: 'Puzzle or scent game', balance: 'mental', image: 'dog_and_owner_chilling', icon: 'puzzle', skills: ['enrichment'] },
  { id: 'hike', label: 'Hike or run', balance: 'physical', image: 'dog_running_on_beach', icon: 'mountain', skills: ['recall', 'loose_leash'] },
  { id: 'alone', label: 'Alone time practice', balance: 'mental', image: 'dog_sleeping_while_owner_reads', icon: 'door-closed', skills: ['alone_time'] },
  { id: 'other', label: 'Something else', balance: null, image: 'dog_wrapped_in_blanket', icon: 'plus', skills: [] },
];

export const SKILLS: Skill[] = [
  { id: 'loose_leash', label: 'Loose leash', balance: 'physical', why: 'A loose leash is what makes {dog} easy to bring to a patio.', traits: ['pulls'], pathId: 'loose-leash-walking', classIds: ['loose-leash', 'focus-recall'], aliases: ['Loose leash'], trainerLed: false },
  { id: 'calm_dogs', label: 'Calm around dogs', balance: 'social', why: 'Calm around dogs is what opens group classes and busy sidewalks to {dog}.', traits: ['nervous_dogs', 'leash_reactive'], pathId: 'calm-around-dogs', classIds: ['calm-private', 'parallel-walk', 'small-group-play'], aliases: ['Confidence'], trainerLed: false },
  { id: 'recall', label: 'Recall', balance: 'mental', why: 'A come {dog} answers every time is what earns more freedom at the park.', traits: ['recall'], pathId: null, classIds: ['focus-recall'], aliases: ['Recall', 'Stop'], trainerLed: false },
  { id: 'settle_public', label: 'Settle in public', balance: 'social', why: 'Settling in public turns a coffee stop into something {dog} can join.', traits: ['settle_public'], pathId: null, classIds: ['focus-recall'], aliases: ['Settle', 'Focus', 'Gate wait'], trainerLed: false },
  { id: 'greetings', label: 'Polite greetings', balance: 'social', why: 'Four paws on the floor makes {dog} welcome when friends come over.', traits: ['jumps'], pathId: null, classIds: [], aliases: [], trainerLed: false },
  { id: 'calm_people', label: 'Calm around people', balance: 'social', why: 'Calm around people lets {dog} relax when the house or the sidewalk gets busy.', traits: ['shy_people', 'barks_visitors'], pathId: null, classIds: [], aliases: [], trainerLed: false },
  { id: 'leave_it', label: 'Leave it', balance: 'mental', why: 'Leave it keeps {dog} safe around bikes, cars and dropped food.', traits: ['chases'], pathId: null, classIds: ['focus-recall'], aliases: [], trainerLed: false },
  { id: 'play_manners', label: 'Play manners', balance: 'social', why: 'Good play manners mean other dogs want to play with {dog}.', traits: ['rough_play'], pathId: null, classIds: ['small-group-play'], aliases: ['Play manners'], trainerLed: false },
  { id: 'sharing', label: 'Calm around food and toys', balance: 'mental', why: 'Feeling safe around food and toys makes {dog} easier to live with and to bring places.', traits: ['guards'], pathId: null, classIds: [], aliases: [], trainerLed: true },
  { id: 'alone_time', label: 'Alone time', balance: 'mental', why: 'Being fine alone gives {dog} a calmer day, and gives you one too.', traits: ['alone'], pathId: null, classIds: [], aliases: [], trainerLed: true },
  { id: 'settle_home', label: 'Settle at home', balance: 'mental', why: 'A dog who can switch off at home rests better and copes better out.', traits: ['crate'], pathId: null, classIds: [], aliases: [], trainerLed: false },
  { id: 'enrichment', label: 'Enrichment', balance: 'mental', why: 'Nose and brain work tire {dog} out in a way a walk alone can\'t.', traits: ['bored_chewing'], pathId: null, classIds: ['scent-work', 'sniff-space'], aliases: [], trainerLed: false },
  { id: 'fitness', label: 'Fitness', balance: 'physical', why: 'A fit dog stays sound for sport days and is calmer at home.', traits: [], pathId: null, classIds: ['fitness', 'agility-drop-in'], aliases: [], trainerLed: false },
  { id: 'decompression', label: 'Decompression', balance: 'mental', why: 'A slow sniff lets {dog} unwind after a busy day.', traits: [], pathId: null, classIds: ['sniff-space'], aliases: [], trainerLed: false },
  { id: 'drop_it', label: 'Drop it', balance: 'mental', why: 'Drop it keeps games going and gets things out of {dog}\'s mouth without a chase.', traits: [], pathId: null, classIds: [], aliases: [], trainerLed: false },
];

/** Shown on a trainer-led skill's drills. */
export const TRAINER_LINE = 'Best worked on with a trainer. Keep home sessions short and easy, and book a 1:1 for the rest.';

export const DRILLS: Drill[] = [
  // Loose leash
  { id: 'turn-and-go', skillId: 'loose_leash', title: 'Turn and go', minutes: 15, setting: 'On your walk', level: 'start', activity: 'walk', image: 'pulling_on_leash',
    goal: '{dog} learns pulling takes the walk backwards.', needs: ['Treats', '6 ft leash', 'A quiet street'],
    steps: ['Walk at your normal pace.', 'The moment the leash goes tight, turn and walk the other way.', 'Mark and treat when {dog} catches up beside you.', 'Repeat for the length of one block.'],
    good: '{dog} checks in with you before the leash goes tight.', stop: '{dog} is too wound up to take treats. Head somewhere quieter.' },
  { id: 'red-light', skillId: 'loose_leash', title: 'Red light, green light', minutes: 10, setting: 'On your walk', level: 'start', activity: 'walk', image: 'dog_providing_good_eye_contact',
    goal: 'A tight leash stops the walk; a loose one starts it again.', needs: ['Treats', '6 ft leash'],
    steps: ['Walk forward while the leash is loose.', 'When it goes tight, stop and stand still.', 'Wait for any slack, a step back or a look at you.', 'Say yes and walk on.'],
    good: 'The stops get shorter because {dog} comes back on their own.', stop: '{dog} spins or barks at the stops. Go back to Turn and go.' },
  { id: 'pace-changes', skillId: 'loose_leash', title: 'Pace changes', minutes: 15, setting: 'On your walk', level: 'next', activity: 'walk', image: 'dog_and_owner_chilling',
    goal: '{dog} keeps watching you as the walk speeds up and slows down.', needs: ['Treats', '6 ft leash'],
    steps: ['Walk ten steps at a normal pace.', 'Slow right down for five steps, then speed up for five.', 'Treat at your side every time {dog} matches your pace.', 'Mix the order so it stays a game.'],
    good: '{dog} adjusts without the leash tightening.', stop: 'The leash is tight more than it is loose. Slow the changes down.' },
  { id: 'sit-at-corners', skillId: 'loose_leash', title: 'Sit at every corner', minutes: 10, setting: 'On your walk', level: 'next', activity: 'walk', image: 'dog_being_patient',
    goal: 'Every curb is a pause, so the walk has a calm rhythm.', needs: ['Treats', '6 ft leash'],
    steps: ['Slow down as you reach the curb.', 'Ask for a sit and treat it.', 'Wait two seconds, then say a release word and cross.', 'Stretch the wait a little each corner.'],
    good: '{dog} sits at the curb before you ask.', stop: 'Traffic is too much to think around. Pick a quieter route.' },
  { id: 'busy-street', skillId: 'loose_leash', title: 'Busy street', minutes: 20, setting: 'Downtown', level: 'harder', activity: 'out', image: 'dog_chilling_in_car',
    goal: 'The loose leash holds up with people, smells and noise around.', needs: ['High-value treats', '6 ft leash', 'A busy block'],
    steps: ['Start at the quiet end of a busy block.', 'Walk a short stretch and treat often at your side.', 'Turn and go the moment the leash goes tight.', 'End on a calm stretch and head home.'],
    good: '{dog} looks around, then back at you, and keeps walking.', stop: '{dog} stops taking treats or freezes. Back to a quieter street.' },
  { id: 'past-a-dog', skillId: 'loose_leash', title: 'Past a calm dog', minutes: 20, setting: 'On your walk', level: 'harder', activity: 'walk', image: 'dogs_meeting_on_leash',
    goal: '{dog} walks past another dog on a loose leash.', needs: ['High-value treats', '6 ft leash', 'A friend with a calm dog'],
    steps: ['Ask your friend to stand still across the street.', 'Walk past at that distance, treating as {dog} looks.', 'Cross a little closer on each pass.', 'Stop after three good passes.'],
    good: 'The leash stays loose all the way past.', stop: '{dog} stiffens, stares or lunges. Add distance and end on an easy pass.' },

  // Calm around dogs
  { id: 'watch-the-park', skillId: 'calm_dogs', title: 'Watch the park', minutes: 10, setting: 'Outside the dog park', level: 'start', activity: 'park', image: 'dog_getting_pets_at_park',
    goal: '{dog} sees dogs playing and stays calm enough to eat.', needs: ['Treats', '6 ft leash', 'A spot past the fence'],
    steps: ['Stand far enough from the fence that {dog} notices dogs but can still take food.', 'Every time {dog} looks at a dog, mark and treat.', 'Move 5 steps closer only after 5 calm looks in a row.', 'End while it\'s still easy.'],
    good: '{dog} looks at a dog, then back at you.', stop: '{dog} stiffens, stares or lunges. Add distance and end on an easy rep.' },
  { id: 'u-turn', skillId: 'calm_dogs', title: 'Let\'s go U-turn', minutes: 10, setting: 'On your walk', level: 'next', activity: 'walk', image: 'pulling_on_leash',
    goal: 'An easy way out when a dog appears too close.', needs: ['Treats', '6 ft leash'],
    steps: ['On a quiet street, say "let\'s go" and turn away with a treat at {dog}\'s nose.', 'Practice it ten times with no dogs around.', 'On a walk, use it the moment you see a dog before {dog} locks on.', 'Treat as you walk away.'],
    good: '{dog} turns with you as soon as you say it.', stop: 'You\'re turning too late to help. Walk at quieter times for now.' },
  { id: 'parallel-practice', skillId: 'calm_dogs', title: 'Parallel walk practice', minutes: 20, setting: 'On your walk', level: 'harder', activity: 'walk', image: 'dog_chilling_with_owner_on_porch',
    goal: '{dog} walks the same way as a calm dog across the street.', needs: ['Treats', '6 ft leash', 'A friend with a calm dog'],
    steps: ['Walk the same direction on opposite sides of a quiet street.', 'Treat each time {dog} looks at the other dog and looks away.', 'If it goes well for a block, close the gap by a few steps.', 'Finish apart, with both dogs relaxed.'],
    good: '{dog} sniffs and walks as if the other dog is just part of the street.', stop: '{dog} stiffens, stares or lunges. Add distance and end on an easy rep.' },

  // Recall
  { id: 'name-game', skillId: 'recall', title: 'Name game', minutes: 5, setting: 'At home', level: 'start', activity: 'train', image: 'dog_providing_good_eye_contact',
    goal: '{dog}\'s name means good things happen near you.', needs: ['Treats'],
    steps: ['Say {dog}\'s name once in a happy voice.', 'The moment {dog} looks at you, mark and treat.', 'Do it from other rooms and when {dog} is busy.', 'Ten reps, a few times a day.'],
    good: '{dog} turns the instant the name is said.', stop: 'You\'re saying the name more than once. Move closer and make it easier.' },
  { id: 'ping-pong', skillId: 'recall', title: 'Ping-pong recall', minutes: 10, setting: 'At home or in the yard', level: 'next', activity: 'train', image: 'athletic_dog_catching_ball',
    goal: '{dog} runs between two people for a reward every time.', needs: ['Treats', 'A second person'],
    steps: ['Stand a few steps apart from your helper.', 'Take turns calling {dog} once.', 'Treat and touch the collar when {dog} arrives.', 'Step further apart as it gets easy.'],
    good: '{dog} runs straight in, fast, without being called twice.', stop: '{dog} wanders off between calls. Shorten the distance.' },
  { id: 'long-line', skillId: 'recall', title: 'Long line at the park', minutes: 15, setting: 'At the park', level: 'harder', activity: 'park', image: 'dog_running_on_beach',
    goal: 'The come holds up with smells and dogs around.', needs: ['High-value treats', '15 ft long line', 'A quiet park'],
    steps: ['Let {dog} explore on the long line.', 'When {dog} isn\'t too busy, call once and back away.', 'Treat well and let {dog} go sniff again.', 'Five good recalls, then head home.'],
    good: '{dog} comes away from a smell on the first call.', stop: 'You need the line to bring {dog} in. Go back to Ping-pong recall.' },

  // Settle in public
  { id: 'mat-at-home', skillId: 'settle_public', title: 'Mat at home', minutes: 10, setting: 'At home', level: 'start', activity: 'train', image: 'dog_sleeping_while_owner_reads',
    goal: 'A mat that means lie down and relax.', needs: ['A mat or towel', 'Treats'],
    steps: ['Put the mat down and treat any paw on it.', 'Then treat only sits, then only downs on the mat.', 'Treat calm every few seconds while you read or watch TV.', 'Pick the mat up when you finish.'],
    good: '{dog} lies on the mat as soon as it goes down.', stop: '{dog} is restless. Try after a walk, when {dog} is tired.' },
  { id: 'patio-settle', skillId: 'settle_public', title: 'Patio settle', minutes: 20, setting: 'On a patio', level: 'next', activity: 'patio', image: 'dog_chilling_with_owner_on_porch',
    goal: '{dog} lies down and stays settled while you have a coffee.', needs: ['A mat or towel', 'A long chew', 'Treats'],
    steps: ['Bring a mat or towel and a long chew.', 'Pick a table at the edge, away from the door.', 'Reward any down on the mat, then reward calm every 30 seconds.', 'Leave before {dog} has had enough.'],
    good: '{dog} lies on the mat and watches people go by.', stop: '{dog} can\'t take food. Try a quieter time.' },
  { id: 'bench-watch', skillId: 'settle_public', title: 'Bench watching', minutes: 15, setting: 'Out and about', level: 'harder', activity: 'out', image: 'dog_being_patient',
    goal: '{dog} settles beside you somewhere busy.', needs: ['A mat or towel', 'Treats'],
    steps: ['Sit on a bench near a market or shop entrance.', 'Treat each calm look at people passing.', 'Treat a down and then calm every minute.', 'Stay ten minutes, then leave on a good note.'],
    good: '{dog} lies down and dozes off.', stop: '{dog} keeps standing up to watch. Move further from the crowd.' },

  // Polite greetings
  { id: 'four-on-floor', skillId: 'greetings', title: 'Four on the floor', minutes: 5, setting: 'At home', level: 'start', activity: 'train', image: 'dog_providing_good_eye_contact',
    goal: 'Attention comes when all four paws are down.', needs: ['Treats'],
    steps: ['Walk in the door calmly.', 'If {dog} jumps, turn away and wait.', 'Treat on the floor as soon as all four paws land.', 'Say hello once {dog} stays down.'],
    good: '{dog} waits with paws on the floor when you come in.', stop: 'The jumping gets bigger. Keep greetings short and boring.' },
  { id: 'doorbell-sit', skillId: 'greetings', title: 'Doorbell sit', minutes: 10, setting: 'At home', level: 'next', activity: 'train', image: 'dog_being_patient',
    goal: '{dog} sits back from the door when someone arrives.', needs: ['Treats', 'A helper to knock'],
    steps: ['Ask a helper to knock.', 'Toss a treat behind {dog}, away from the door.', 'Ask for a sit before you open it.', 'Open only while {dog} stays sitting.'],
    good: '{dog} goes to the spot when someone knocks.', stop: '{dog} is barking too hard to listen. Practice with a softer knock.' },
  { id: 'greet-a-friend', skillId: 'greetings', title: 'Greet a friend', minutes: 10, setting: 'On your walk', level: 'harder', activity: 'walk', image: 'dog_and_owner_chilling',
    goal: '{dog} says hi to people with four paws down.', needs: ['Treats', 'A friend'],
    steps: ['Ask a friend to walk up slowly.', 'They stop if {dog} jumps and step back.', 'They pet {dog} only while {dog} sits or stands calmly.', 'Three short greetings, then walk on.'],
    good: '{dog} sits as the friend comes close.', stop: '{dog} is too excited to sit. Try with a calmer friend or after a walk.' },

  // Calm around people
  { id: 'treat-from-afar', skillId: 'calm_people', title: 'Treats from afar', minutes: 10, setting: 'On your walk', level: 'start', activity: 'walk', image: 'dog_being_patient',
    goal: 'People passing mean treats, not worry.', needs: ['Treats', '6 ft leash'],
    steps: ['Stand back from a path where people walk by.', 'Each time someone passes, treat.', 'Stop the treats when they\'re gone.', 'Move closer only when {dog} looks for the treat.'],
    good: '{dog} sees a person and looks at you for the treat.', stop: '{dog} barks, hides or won\'t eat. Add distance.' },
  { id: 'visitor-toss', skillId: 'calm_people', title: 'Visitor toss', minutes: 10, setting: 'At home', level: 'next', activity: 'train', image: 'dog_sleeping_while_owner_reads',
    goal: '{dog} learns visitors are safe and can be ignored.', needs: ['Treats', 'A calm visitor'],
    steps: ['Ask your visitor to sit and not reach for {dog}.', 'They toss a treat away from themselves now and then.', 'Let {dog} choose to come closer, or not.', 'Keep visits short to start.'],
    good: '{dog} sniffs the visitor and walks off relaxed.', stop: '{dog} growls or freezes. Stop and give {dog} space.' },
  { id: 'busy-door', skillId: 'calm_people', title: 'Shop doorway', minutes: 15, setting: 'Out and about', level: 'harder', activity: 'out', image: 'dog_chilling_in_car',
    goal: '{dog} stays relaxed near a busy entrance.', needs: ['Treats', 'A mat or towel'],
    steps: ['Stand well back from a shop entrance.', 'Treat each person who comes out.', 'Move a few steps closer when {dog} is loose and curious.', 'Leave after ten minutes.'],
    good: '{dog} watches the door with a soft body.', stop: '{dog} pulls away or won\'t eat. Go back to Treats from afar.' },

  // Leave it
  { id: 'closed-hand', skillId: 'leave_it', title: 'Closed hand', minutes: 5, setting: 'At home', level: 'start', activity: 'train', image: 'dog_providing_good_eye_contact',
    goal: '{dog} backs off from something to get something better.', needs: ['Treats'],
    steps: ['Hold a treat in a closed hand.', 'Wait while {dog} sniffs and paws.', 'The moment {dog} backs off, treat from the other hand.', 'Add "leave it" once it\'s easy.'],
    good: '{dog} looks at you instead of your hand.', stop: '{dog} gets frustrated. Use a less exciting treat in the hand.' },
  { id: 'floor-leave', skillId: 'leave_it', title: 'Leave it on the floor', minutes: 10, setting: 'At home', level: 'next', activity: 'train', image: 'dog_being_patient',
    goal: '{dog} walks past food on the floor.', needs: ['Treats', '6 ft leash'],
    steps: ['Put a treat on the floor and cover it with your foot.', 'Say "leave it" and treat from your hand when {dog} looks away.', 'Uncover it a little at a time.', 'Walk past it on leash and treat at your side.'],
    good: '{dog} glances at it and keeps walking.', stop: '{dog} lunges for it. Keep it covered for longer.' },
  { id: 'bike-watch', skillId: 'leave_it', title: 'Bikes go by', minutes: 15, setting: 'Near a bike path', level: 'harder', activity: 'walk', image: 'pulling_on_leash',
    goal: '{dog} watches bikes pass without chasing.', needs: ['High-value treats', '6 ft leash'],
    steps: ['Stand well back from a bike path.', 'Treat as each bike goes by.', 'Ask for a look at you before the treat as it gets easy.', 'Move closer over several visits, not one.'],
    good: '{dog} sees a bike and turns to you.', stop: '{dog} lunges or spins. Add distance.' },

  // Play manners
  { id: 'play-pause', skillId: 'play_manners', title: 'Play and pause', minutes: 10, setting: 'At home or in the yard', level: 'start', activity: 'play', image: 'athletic_dog_catching_ball',
    goal: '{dog} can calm down in the middle of a game.', needs: ['A tug toy', 'Treats'],
    steps: ['Play tug for ten seconds.', 'Freeze and hold the toy still.', 'When {dog} lets go and sits, start again.', 'Five rounds, then end the game.'],
    good: '{dog} lets go and sits as soon as you freeze.', stop: '{dog} grabs at hands or clothes. End the game for now.' },
  { id: 'call-out', skillId: 'play_manners', title: 'Call out of play', minutes: 15, setting: 'At the park', level: 'next', activity: 'park', image: 'dog_getting_pets_at_park',
    goal: '{dog} takes breaks during play with another dog.', needs: ['High-value treats', 'A friend with a dog {dog} knows'],
    steps: ['Let the dogs play for thirty seconds.', 'Call {dog} and treat when {dog} comes.', 'Send {dog} back to play straight away.', 'Repeat every minute or so.'],
    good: '{dog} comes when called and goes back calm.', stop: 'Play gets loud and stiff. Separate them for a break.' },
  { id: 'calm-buddy', skillId: 'play_manners', title: 'Calm buddy walk', minutes: 20, setting: 'On your walk', level: 'harder', activity: 'walk', image: 'dogs_meeting_on_leash',
    goal: '{dog} spends time with another dog without playing rough.', needs: ['Treats', 'A friend with a calm dog'],
    steps: ['Walk side by side first.', 'Let the dogs sniff for three seconds, then move on.', 'Short sniffs, lots of walking.', 'End before either dog gets wound up.'],
    good: 'Loose bodies and short, polite sniffs.', stop: '{dog} stiffens or mounts. Move apart and keep walking.' },

  // Calm around food and toys
  { id: 'trade-up', skillId: 'sharing', title: 'Trade up', minutes: 5, setting: 'At home', level: 'start', activity: 'train', image: 'dog_and_owner_chilling',
    goal: 'Your hand near {dog}\'s things means something better arrives.', needs: ['A low-value toy', 'High-value treats'],
    steps: ['Give {dog} a toy {dog} doesn\'t care much about.', 'Toss a treat near, not at, {dog}.', 'Walk away. Do not take the toy.', 'Repeat a few times a day.'],
    good: '{dog} looks up happily when you come near.', stop: '{dog} stiffens, freezes or growls. Stop and book a 1:1.' },
  { id: 'walk-by-bowl', skillId: 'sharing', title: 'Walk past the bowl', minutes: 5, setting: 'At home', level: 'next', activity: 'train', image: 'dog_being_patient',
    goal: 'People passing the bowl add food, never take it.', needs: ['Treats'],
    steps: ['While {dog} eats, walk past at a distance.', 'Toss a treat toward the bowl as you pass.', 'Keep walking.', 'Come a step closer only over many meals.'],
    good: '{dog} keeps eating with a loose body as you pass.', stop: '{dog} eats faster, freezes or growls. Stop and book a 1:1.' },
  { id: 'drop-for-treat', skillId: 'sharing', title: 'Drop for a treat', minutes: 5, setting: 'At home', level: 'harder', activity: 'train', image: 'dog_providing_good_eye_contact',
    goal: '{dog} drops a toy because giving it up pays.', needs: ['A low-value toy', 'High-value treats'],
    steps: ['Show a treat at {dog}\'s nose.', 'Say "drop" as {dog} lets go.', 'Give the treat, then give the toy back.', 'Three reps, then end.'],
    good: '{dog} drops it and waits for the toy to come back.', stop: '{dog} guards harder. Stop and book a 1:1.' },

  // Alone time
  { id: 'door-in-out', skillId: 'alone_time', title: 'Out the door and back', minutes: 5, setting: 'At home', level: 'start', activity: 'alone', image: 'dog_sleeping_while_owner_reads',
    goal: 'You leaving is boring because you always come back.', needs: ['A long chew'],
    steps: ['Give {dog} a chew.', 'Step out the door and close it.', 'Come back in after a few seconds, calmly.', 'Do it ten times, only as long as {dog} stays relaxed.'],
    good: '{dog} keeps chewing as you go out.', stop: '{dog} whines, paces or scratches the door. Make it shorter.' },
  { id: 'busy-chew', skillId: 'alone_time', title: 'Chew while you\'re busy', minutes: 15, setting: 'At home', level: 'next', activity: 'alone', image: 'dog_wrapped_in_blanket',
    goal: '{dog} settles in another room while you\'re home.', needs: ['A long chew', 'A baby gate'],
    steps: ['Set {dog} up with a chew behind a baby gate.', 'Potter around where {dog} can see you.', 'Then step out of sight for a minute.', 'Come back before {dog} finishes the chew.'],
    good: '{dog} stays on the chew while you\'re out of sight.', stop: '{dog} stops chewing to watch for you. Stay in sight longer.' },
  { id: 'short-errand', skillId: 'alone_time', title: 'A short errand', minutes: 15, setting: 'At home', level: 'harder', activity: 'alone', image: 'dog_sleeping_while_owner_reads',
    goal: '{dog} rests through a short time alone.', needs: ['A long chew', 'A camera if you have one'],
    steps: ['Walk {dog} first.', 'Leave with no fuss and a chew down.', 'Be back in ten minutes.', 'Come in calmly and say hi once {dog} settles.'],
    good: '{dog} is lying down when you get back.', stop: '{dog} barks or paces the whole time. Go back a step.' },

  // Settle at home
  { id: 'crate-games', skillId: 'settle_home', title: 'Crate games', minutes: 10, setting: 'At home', level: 'start', activity: 'train', image: 'dog_wrapped_in_blanket',
    goal: 'The crate is where good things show up.', needs: ['Treats', 'A crate with the door open'],
    steps: ['Toss a treat into the crate.', 'Let {dog} go in and come out freely.', 'Treat inside when {dog} lies down.', 'Close the door for a few seconds, then open it.'],
    good: '{dog} walks in on their own to see what\'s there.', stop: '{dog} won\'t go in. Toss the treats just at the door.' },
  { id: 'settle-cue', skillId: 'settle_home', title: 'Settle on cue', minutes: 10, setting: 'At home', level: 'next', activity: 'train', image: 'dog_sleeping_while_owner_reads',
    goal: '{dog} lies down and relaxes when you sit down.', needs: ['A mat or bed', 'Treats'],
    steps: ['Sit on the couch with {dog} on a leash.', 'Wait. Treat any calm lie-down.', 'Treat slow blinks and sighs.', 'Practice every evening.'],
    good: '{dog} flops onto a hip when you sit down.', stop: '{dog} keeps asking to play. Try after exercise.' },
  { id: 'nap-after-walk', skillId: 'settle_home', title: 'Quiet after a walk', minutes: 15, setting: 'At home', level: 'harder', activity: 'train', image: 'dog_wrapped_in_blanket',
    goal: '{dog} learns walks end in rest, not more play.', needs: ['A long chew', 'A quiet room'],
    steps: ['Come home from a walk.', 'Give a chew on the bed straight away.', 'Keep the room quiet and lights low.', 'Let {dog} sleep it off.'],
    good: '{dog} falls asleep within fifteen minutes.', stop: '{dog} is still wired. Make the walk sniffier next time.' },

  // Enrichment
  { id: 'scatter-feed', skillId: 'enrichment', title: 'Scatter feed', minutes: 10, setting: 'In the yard or at home', level: 'start', activity: 'puzzle', image: 'dog_chilling',
    goal: '{dog} uses their nose to find dinner.', needs: ['Dinner kibble'],
    steps: ['Scatter a handful of kibble on grass or a towel.', 'Let {dog} find every piece.', 'Make the area bigger as it gets easy.', 'Use part of a meal so it doesn\'t add extra food.'],
    good: '{dog} sniffs slowly and keeps searching.', stop: '{dog} gives up quickly. Use a smaller area.' },
  { id: 'cup-game', skillId: 'enrichment', title: 'Cup game', minutes: 10, setting: 'At home', level: 'next', activity: 'puzzle', image: 'dog_and_owner_chilling',
    goal: '{dog} finds the treat under one of three cups.', needs: ['Three cups', 'Treats'],
    steps: ['Put a treat under one cup while {dog} watches.', 'Let {dog} nose the right one and lift it.', 'Shuffle slowly as it gets easy.', 'Stop after ten finds.'],
    good: '{dog} sniffs each cup and picks the right one.', stop: '{dog} knocks cups over in frustration. Use one cup.' },
  { id: 'find-it', skillId: 'enrichment', title: 'Find it, room to room', minutes: 15, setting: 'At home', level: 'harder', activity: 'puzzle', image: 'dog_and_owner_chilling',
    goal: '{dog} searches the house for a hidden treat or toy.', needs: ['Treats or a toy'],
    steps: ['Have {dog} wait in one room.', 'Hide a treat somewhere easy in the next room.', 'Say "find it" and let {dog} search.', 'Make the hides harder over time.'],
    good: '{dog} works the room on their own.', stop: '{dog} keeps looking at you for help. Make the hides easier.' },

  // Fitness
  { id: 'sit-stand', skillId: 'fitness', title: 'Sit to stand', minutes: 5, setting: 'At home', level: 'start', activity: 'train', image: 'dog_being_patient',
    goal: 'Builds the back legs with slow, square reps.', needs: ['Treats', 'A non-slip floor'],
    steps: ['Ask for a sit, then a stand, then a sit.', 'Keep it slow and square.', 'Do five reps.', 'Rest and do one more set.'],
    good: '{dog} stands up straight without shuffling forward.', stop: '{dog} sits to one side or seems sore. Stop and check with your vet.' },
  { id: 'hill-walk', skillId: 'fitness', title: 'Hill walks', minutes: 20, setting: 'On your walk', level: 'next', activity: 'hike', image: 'dog_running_on_beach',
    goal: 'Strength from walking up and down a gentle hill.', needs: ['6 ft leash', 'A gentle hill'],
    steps: ['Walk up a gentle slope at a steady pace.', 'Walk back down slowly.', 'Repeat three to five times.', 'Finish with a flat cool-down.'],
    good: '{dog} keeps a steady pace up and down.', stop: '{dog} lags or pants hard. Cut it short.' },
  { id: 'cavaletti', skillId: 'fitness', title: 'Pole walk', minutes: 10, setting: 'In the yard', level: 'harder', activity: 'play', image: 'athletic_dog_catching_ball',
    goal: '{dog} lifts each paw cleanly over low poles.', needs: ['4 broom handles or poles', 'Treats'],
    steps: ['Lay poles on the ground a stride apart.', 'Walk {dog} over them slowly on leash.', 'Treat at the end.', 'Five passes each way.'],
    good: '{dog} steps over each pole without knocking it.', stop: '{dog} trips or rushes. Space the poles wider.' },

  // Decompression
  { id: 'sniffari', skillId: 'decompression', title: 'Sniffari', minutes: 30, setting: 'Somewhere green', level: 'start', activity: 'sniff', image: 'dog_chilling',
    goal: '{dog} sets the pace and sniffs as long as they like.', needs: ['Long leash or harness'],
    steps: ['Pick a quiet green spot.', 'Let {dog} lead and stop wherever {dog} wants.', 'Don\'t hurry, cue or correct.', 'Head home when {dog} slows down.'],
    good: '{dog} sniffs slowly and comes home relaxed.', stop: 'It\'s too busy for {dog} to unwind. Try an earlier time.' },
  { id: 'new-route', skillId: 'decompression', title: 'A new route', minutes: 20, setting: 'On your walk', level: 'next', activity: 'sniff', image: 'dog_chilling',
    goal: 'New smells make a short walk count for more.', needs: ['6 ft leash'],
    steps: ['Pick a street {dog} hasn\'t walked.', 'Walk slowly and stop at every interesting smell.', 'Keep it short.', 'Come home the usual way.'],
    good: '{dog} explores with a loose body.', stop: '{dog} is jumpy in the new place. Use a route you know.' },
  { id: 'lick-mat', skillId: 'decompression', title: 'Lick mat wind-down', minutes: 10, setting: 'At home', level: 'harder', activity: 'puzzle', image: 'dog_wrapped_in_blanket',
    goal: 'Licking helps {dog} come down after a busy day.', needs: ['A lick mat', 'Wet food or yogurt'],
    steps: ['Spread a thin layer on a lick mat.', 'Give it in a quiet spot.', 'Stay nearby and calm.', 'Pick it up when {dog} is done.'],
    good: '{dog} lies down to lick and settles afterwards.', stop: '{dog} chews the mat. Use it only while you\'re watching.' },

  // Drop it
  { id: 'two-toys', skillId: 'drop_it', title: 'Two toys', minutes: 10, setting: 'At home or in the yard', level: 'start', activity: 'play', image: 'athletic_dog_catching_ball',
    goal: '{dog} drops one toy to get the other.', needs: ['Two matching toys'],
    steps: ['Throw one toy.', 'When {dog} brings it back, make the second toy exciting.', 'Throw the second as soon as the first drops.', 'Add "drop" just before {dog} lets go.'],
    good: '{dog} drops the toy at your feet.', stop: '{dog} runs off with the toy. Use a long line.' },
  { id: 'trade-tug', skillId: 'drop_it', title: 'Tug and trade', minutes: 10, setting: 'At home', level: 'next', activity: 'play', image: 'athletic_dog_catching_ball',
    goal: '{dog} lets go of a tug toy on cue.', needs: ['A tug toy', 'Treats'],
    steps: ['Play tug for a few seconds.', 'Stop moving and say "drop".', 'Treat when {dog} lets go, then restart tug.', 'Ten reps.'],
    good: '{dog} lets go as soon as the toy goes still.', stop: '{dog} won\'t let go. Hold the treat at the nose first.' },
  { id: 'drop-outside', skillId: 'drop_it', title: 'Drop it on a walk', minutes: 10, setting: 'On your walk', level: 'harder', activity: 'walk', image: 'pulling_on_leash',
    goal: '{dog} drops a stick or bit of trash when asked.', needs: ['High-value treats', '6 ft leash'],
    steps: ['Carry great treats.', 'When {dog} picks something up, say "drop" once.', 'Treat on the ground away from the item.', 'Pick it up while {dog} eats.'],
    good: '{dog} drops it before you reach for it.', stop: 'It\'s something dangerous. Swap for a treat right away and practice at home.' },
];

export const activityById = (id: string): Activity => ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[ACTIVITIES.length - 1];
export const skillById = (id: string): Skill | undefined => SKILLS.find((s) => s.id === id);
export const skillLabel = (id: string) => skillById(id)?.label ?? id;
export const drillById = (id: string): Drill | undefined => DRILLS.find((d) => d.id === id);
export const drillsFor = (skillId: string) => DRILLS.filter((d) => d.skillId === skillId);
/** Drill and skill copy for one dog. */
export const forDog = (text: string, dog: string) => text.replaceAll('{dog}', dog);
/** The focus skills a dog's traits start (dog_focus_skills does the same in the database). */
export const skillsForTraits = (traits: string[]) => SKILLS.filter((s) => s.traits.some((t) => traits.includes(t))).map((s) => s.id);
/** What a dog works on before the owner edits it: its traits' skills, then its active paths' (seed_focus_skills does the same). */
export function defaultFocus(traits: string[], pathIds: string[]): FocusSkill[] {
  const out: FocusSkill[] = skillsForTraits(traits).map((skillId) => ({ skillId, source: 'trait' }));
  for (const s of SKILLS) if (s.pathId && pathIds.includes(s.pathId) && !out.some((f) => f.skillId === s.id)) out.push({ skillId: s.id, source: 'path' });
  return out;
}
export const RATING_LABEL: Record<Rating, string> = { tough: 'Tough', mixed: 'Mixed', good: 'Good' };
export const LEVEL_LABEL: Record<DrillLevel, string> = { start: 'Start here', next: 'Next', harder: 'Harder' };
