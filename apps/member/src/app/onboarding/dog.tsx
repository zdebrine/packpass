import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Footer, Screen, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { PhotoFill } from '@/ds/Surface';
import { useWide } from '@/ds/responsive';
import { Text } from '@/ds/Text';
import { Split } from '@/features/desktop/Split';
import { Body, ChipRow, FieldGroup, Intro, StepHeader } from '@/features/onboarding/parts';
import { pickDogPhoto } from '@/lib/photos';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** 01e Step 1 · Who's the athlete */
function DogBasics() {
  const { c } = useTheme();
  const d = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const adding = useApp((s) => s.addingDog);
  const wide = useWide();

  const pick = async () => {
    const uri = await pickDogPhoto().catch(() => null);
    if (uri) update({ photo: { uri } });
  };
  const photo = (size: number, icon: number) => (
    <Press
      onPress={pick}
      accessibilityLabel={d.photo ? 'Change photo' : 'Add a photo'}
      style={{ width: size, height: size, borderRadius: 9999, overflow: 'hidden', backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
    >
      {d.photo ? (
        <PhotoFill name={d.photo} />
      ) : (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Icon name="camera" size={icon} />
          <Text variant="label" weight="600">Add a photo</Text>
        </View>
      )}
    </Press>
  );
  const note = d.photo ? 'Tap to change. This becomes the Athlete Card.' : 'A clear, outdoor photo works best.';
  const intro = (titleSize?: number) => adding ? (
    <Intro eyebrow="Step 1 of 5 · Another dog" title="Tell us about your pup" titleSize={titleSize} lede="Your dogs share your plan's credits. Each one gets its own Passport." />
  ) : (
    <Intro eyebrow="Step 1 of 5 · The dog" title="Tell us about your pup" titleSize={titleSize} lede="You can add more dogs later." />
  );
  const fields = (
    <>
      <Field label="Dog's name" value={d.dogName} onChangeText={(dogName) => update({ dogName })} placeholder="Name" autoCapitalize="words" />
      <FieldGroup label="Sex">
        <ChipRow>
          {(['Female', 'Male'] as const).map((sex) => (
            <Chip key={sex} selected={d.sex === sex} onPress={() => update({ sex })}>{sex}</Chip>
          ))}
        </ChipRow>
      </FieldGroup>
    </>
  );
  const next = <Button block disabled={!d.dogName.trim()} onPress={() => router.push('/onboarding/details')}>Continue</Button>;

  if (wide) {
    return (
      <Split photo="juno" step={1}>
        {intro()}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          {photo(132, 26)}
          <Text variant="caption" muted style={{ flex: 1 }}>{note}</Text>
        </View>
        {fields}
        {next}
      </Split>
    );
  }

  return (
    <Screen theme="dark">
      <StepHeader step={1} />
      <Body>
        {intro(28)}
        <View style={{ alignItems: 'center', gap: 12 }}>
          {photo(176, 28)}
          <Text variant="caption" muted center>{note}</Text>
        </View>
        {fields}
      </Body>
      <Footer>{next}</Footer>
    </Screen>
  );
}

export default themed('dark', DogBasics);
