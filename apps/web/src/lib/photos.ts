// Photos live in public/photos, named for what they show. Classes and trainers saved before the
// October 2026 photo swap still store the old keys, so those map to their replacements.
const LEGACY: Record<string, string> = {
  collie: 'dog_chilling', grass: 'dog_and_owner_chilling', hurdle: 'dog_being_patient', juno: 'dog_providing_good_eye_contact',
  lab: 'dog_sleeping_while_owner_reads', leap: 'dog_getting_pets_at_park', rail: 'pulling_on_leash', sprint: 'dog_running_on_beach',
  tunnel: 'dogs_meeting_on_leash', wall: 'dog_chilling_with_owner_on_porch', weave: 'athletic_dog_catching_ball',
};

export const photoSrc = (key?: string | null) => `/photos/${LEGACY[key || ''] ?? (key || 'dog_and_owner_chilling')}.jpg`;
