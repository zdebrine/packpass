import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NOW } from '@/data/fixtures';
import { Button, Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Footer, Screen, Toggle, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { Body, ChipRow, FieldGroup, Intro, StepHeader } from '@/features/onboarding/parts';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = Array.from({ length: 16 }, (_, i) => NOW.getFullYear() - i);

function lifeStage(month: number, year: number) {
  const months = (NOW.getFullYear() - year) * 12 + (NOW.getMonth() - month);
  const yrs = Math.floor(months / 12);
  const age = months < 12 ? `${Math.max(0, months)} months old` : `${yrs} ${yrs === 1 ? 'year' : 'years'} old`;
  const stage = months < 12 ? 'Puppy' : yrs < 8 ? 'Prime' : 'Senior';
  return `${age} · ${stage}`;
}

/** Pill that opens an inline list of options. */
function Select<T extends string | number>({ value, label, options, onPick }: { value: T; label: string; options: T[]; onPick: (v: T) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Press
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={{ height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text>{String(value)}</Text>
        <Icon name="chevron-down" size={18} color={c.inkMuted} />
      </Press>
      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {options.map((o) => (
            <Chip key={o} selected={o === value} onPress={() => { onPick(o); setOpen(false); }}>{String(o)}</Chip>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 01f Step 2 · Details */
function Details() {
  const { c } = useTheme();
  const d = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const name = d.dogName.trim() || 'Your dog';

  return (
    <Screen theme="dark">
      <StepHeader step={2} />
      <Body>
        <Intro eyebrow="Step 2 of 5 · Details" title={`${name}'s details.`} lede="Trainers use these to set pace and group size." />
        <FieldGroup label="Breed">
          <Field value={d.breed} onChangeText={(breed) => update({ breed })} placeholder="Search breeds" left={<Icon name="search" color={c.inkMuted} />} autoCapitalize="words" />
          <ChipRow>
            <Chip selected={d.mixed} onPress={() => update({ mixed: !d.mixed })}>Mixed breed</Chip>
            <Chip selected={d.notSure} onPress={() => update({ notSure: !d.notSure })}>Not sure</Chip>
          </ChipRow>
        </FieldGroup>
        <FieldGroup label="Birthday" note={lifeStage(d.birthMonth, d.birthYear)}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Select label="Birth month" value={MONTHS[d.birthMonth]} options={MONTHS} onPick={(m) => update({ birthMonth: MONTHS.indexOf(m) })} />
            <Select label="Birth year" value={d.birthYear} options={YEARS} onPick={(birthYear) => update({ birthYear })} />
          </View>
        </FieldGroup>
        <FieldGroup label="Weight">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Press onPress={() => update({ weight: Math.max(2, d.weight - 1) })} accessibilityLabel="Less" style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" />
            </Press>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
              <Text variant="displayXl" num>{d.weight}</Text>
              <Text variant="heading" muted> lb</Text>
            </View>
            <Press onPress={() => update({ weight: Math.min(200, d.weight + 1) })} accessibilityLabel="More" style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" />
            </Press>
          </View>
        </FieldGroup>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text variant="label" weight="600">{d.sex === 'Female' ? 'Spayed' : 'Neutered'}</Text>
            <Text variant="caption" muted>Some play groups require it.</Text>
          </View>
          <Toggle on={d.fixed} onPress={() => update({ fixed: !d.fixed })} label={d.sex === 'Female' ? 'Spayed' : 'Neutered'} />
        </View>
      </Body>
      <Footer>
        <Button block onPress={() => router.push('/onboarding/play')}>Continue</Button>
      </Footer>
    </Screen>
  );
}

export default themed('dark', Details);
