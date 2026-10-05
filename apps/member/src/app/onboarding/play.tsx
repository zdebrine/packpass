import { router } from 'expo-router';
import { View } from 'react-native';

import { ENERGY, INTERESTS, SOCIAL } from '@/data/fixtures';
import { Button, Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Footer, MiniButton, Screen, themed } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { Body, ChipRow, FieldGroup, Intro, StepHeader } from '@/features/onboarding/parts';
import { AREAS } from '@/lib/location';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';


/** 01g Step 3 · Play style */
function PlayStyle() {
  const { c } = useTheme();
  const d = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const name = d.dogName.trim() || 'Your dog';

  return (
    <Screen theme="dark">
      <StepHeader step={3} />
      <Body gap={24}>
        <Intro eyebrow="Step 3 of 5 · Play style" title={`How does ${name} play?`} />
        <FieldGroup label="Energy" note={ENERGY.find((e) => e.key === d.energy)?.note}>
          <ChipRow>
            {ENERGY.map((e) => <Chip key={e.key} selected={d.energy === e.key} onPress={() => update({ energy: e.key })}>{e.label}</Chip>)}
          </ChipRow>
        </FieldGroup>
        <FieldGroup label="With other dogs">
          <ChipRow>
            {SOCIAL.map((e) => <Chip key={e} selected={d.social === e} onPress={() => update({ social: e })}>{e}</Chip>)}
          </ChipRow>
        </FieldGroup>
        <FieldGroup label="Interested in">
          <ChipRow>
            {INTERESTS.map((e) => (
              <Chip
                key={e}
                selected={d.interests.includes(e)}
                onPress={() => update({ interests: d.interests.includes(e) ? d.interests.filter((x) => x !== e) : [...d.interests, e] })}
              >
                {e}
              </Chip>
            ))}
          </ChipRow>
        </FieldGroup>
        <FieldGroup label="Trains near">
          <View style={{ height: 52, paddingLeft: 18, paddingRight: 8, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="map-pin" color={c.inkMuted} />
            <Text style={{ flex: 1 }}>{d.area}</Text>
            <MiniButton onPress={() => update({ area: AREAS[(AREAS.findIndex((a) => a.label === d.area) + 1) % AREAS.length].label })}>Change</MiniButton>
          </View>
        </FieldGroup>
      </Body>
      <Footer>
        <Button block onPress={() => router.push('/onboarding/traits')}>Continue</Button>
      </Footer>
    </Screen>
  );
}

export default themed('dark', PlayStyle);
