import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';

import { TRAIT_GROUPS, TRAIT_SPECIAL } from '@/data/fixtures';
import { Button, Chip } from '@/ds/controls';
import { Footer, Screen, themed } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { BackButton, Body, ChipRow, FieldGroup, Intro, StepHeader } from '@/features/onboarding/parts';
import { useApp, useDog } from '@/store/app';

/** 01h Step 4 · Traits. "None of these" and "Not sure yet" clear the other picks. */
function Traits() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const traits = useApp((s) => s.draft.traits);
  const dog = useDog();
  const draftName = useApp((s) => s.draft.dogName.trim());
  const name = (edit ? dog.name : draftName) || 'your dog';
  const toggle = useApp((s) => s.toggleTrait);
  const updateDraft = useApp((s) => s.updateDraft);
  const saveTraits = useApp((s) => s.saveTraits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Editing from the Passport starts from what's saved on the dog (live mode), not an old draft.
  useEffect(() => {
    if (edit && isLive && dog.traits) updateDraft({ traits: dog.traits });
  }, [edit, dog.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveTraits(dog.id); router.back(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const n = traits.length;
  const count =
    n === 0 ? 'Pick any that apply. You can change these later.'
      : TRAIT_SPECIAL.includes(traits[0]) ? `${traits[0]}. You can add traits later.`
        : `${n} selected. You can change these later.`;

  return (
    <Screen theme="dark">
      {edit ? <View style={{ paddingTop: 6, paddingHorizontal: 20 }}><BackButton /></View> : <StepHeader step={4} showBack={false} />}
      <Body gap={26}>
        <Intro
          eyebrow={edit ? `Passport · ${name}` : `Step 4 of 5 · About ${name}`}
          title={`Tell us about ${name}.`}
          lede="Every dog has something to work on. This helps us point you to the right people."
        />
        <View style={{ gap: 22 }}>
          {TRAIT_GROUPS.map(([label, chips]) => (
            <FieldGroup key={label} label={label}>
              <ChipRow>
                {chips.map((t) => <Chip key={t} selected={traits.includes(t)} onPress={() => toggle(t)}>{t}</Chip>)}
              </ChipRow>
            </FieldGroup>
          ))}
        </View>
      </Body>
      <Footer>
        <Text variant="caption" muted center>{error ?? count}</Text>
        <Button block disabled={busy} onPress={() => (edit ? save() : router.push('/onboarding/reveal'))}>{edit ? (busy ? 'Saving…' : 'Save') : 'Continue'}</Button>
      </Footer>
    </Screen>
  );
}

export default themed('dark', Traits);
