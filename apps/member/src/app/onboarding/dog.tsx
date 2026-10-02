import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Footer, Screen, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { Body, ChipRow, FieldGroup, Intro, StepHeader } from '@/features/onboarding/parts';
import { pickDogPhoto } from '@/lib/photos';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** 01e Step 1 · Who's the athlete */
function DogBasics() {
  const { c } = useTheme();
  const d = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);

  return (
    <Screen theme="dark">
      <StepHeader step={1} />
      <Body>
        <Intro eyebrow="Step 1 of 5 · The dog" title="Tell us about your pup" titleSize={28} lede="You can add more dogs later." />
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Press
            onPress={async () => {
              const uri = await pickDogPhoto().catch(() => null);
              if (uri) update({ photo: { uri } });
            }}
            accessibilityLabel={d.photo ? 'Change photo' : 'Add a photo'}
            style={{ width: 176, height: 176, borderRadius: 9999, overflow: 'hidden', backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            {d.photo ? (
              <PhotoFill name={d.photo} />
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Icon name="camera" size={28} />
                <Text variant="label" weight="600">Add a photo</Text>
              </View>
            )}
          </Press>
          <Text variant="caption" muted center>{d.photo ? 'Tap to change. This becomes the Athlete Card.' : 'A clear, outdoor photo works best.'}</Text>
        </View>
        <Field label="Dog's name" value={d.dogName} onChangeText={(dogName) => update({ dogName })} placeholder="Name" autoCapitalize="words" />
        <FieldGroup label="Sex">
          <ChipRow>
            {(['Female', 'Male'] as const).map((sex) => (
              <Chip key={sex} selected={d.sex === sex} onPress={() => update({ sex })}>{sex}</Chip>
            ))}
          </ChipRow>
        </FieldGroup>
      </Body>
      <Footer>
        <Button block disabled={!d.dogName.trim()} onPress={() => router.push('/onboarding/details')}>Continue</Button>
      </Footer>
    </Screen>
  );
}

export default themed('dark', DogBasics);
