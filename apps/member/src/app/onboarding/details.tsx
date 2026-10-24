import { router } from 'expo-router';
import { View } from 'react-native';

import { breedById, searchBreeds } from '@/data/breeds';
import { now } from '@/lib/clock';
import { Button, Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Footer, Screen, Toggle, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { tile, useWide } from '@/ds/responsive';
import { Text } from '@/ds/Text';
import { Split } from '@/features/desktop/Split';
import { Body, ChipRow, FieldGroup, Intro, Select, StepHeader } from '@/features/onboarding/parts';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = Array.from({ length: 16 }, (_, i) => now().getFullYear() - i);

function lifeStage(month: number, year: number) {
  const months = (now().getFullYear() - year) * 12 + (now().getMonth() - month);
  const yrs = Math.floor(months / 12);
  const age = months < 12 ? `${Math.max(0, months)} months old` : `${yrs} ${yrs === 1 ? 'year' : 'years'} old`;
  const stage = months < 12 ? 'Puppy' : yrs < 8 ? 'Prime' : 'Senior';
  return `${age} · ${stage}`;
}

/** 01f Step 2 · Details */
function Details() {
  const { c } = useTheme();
  const d = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const name = d.dogName.trim() || 'Your dog';
  const wide = useWide();

  const intro = <Intro eyebrow="Step 2 of 6 · Details" title={`${name}'s details.`} lede="Trainers use these to set pace and group size." />;
  // Breed search: picking from the list gives the dog canonical breeds (src/data/breeds.ts), which is what
  // classes match on. A mix holds up to three; typed text that isn't a breed is kept as is.
  const picked = d.breedIds ?? [];
  const showName = !d.mixed && picked.length > 0 && breedById[picked[0]]?.name === d.breed;
  const suggestions = showName ? [] : searchBreeds(d.breed).filter((b) => !picked.includes(b.id));
  const pickBreed = (id: string) =>
    d.mixed
      ? update({ breedIds: [...picked, id].slice(0, 3), breed: '', notSure: false })
      : update({ breedIds: [id], breed: breedById[id].name, notSure: false });
  const typeBreed = (text: string) => update(d.mixed ? { breed: text, notSure: false } : { breed: text, breedIds: [], notSure: false });
  const toggleMixed = () =>
    d.mixed
      ? update({ mixed: false, breedIds: picked.slice(0, 1), breed: picked[0] ? breedById[picked[0]].name : d.breed })
      : update({ mixed: true, notSure: false, breed: '' });
  const toggleNotSure = () => update(d.notSure ? { notSure: false } : { notSure: true, mixed: false, breedIds: [], breed: '' });
  const breedNote = d.notSure
    ? 'That’s fine. Every class still shows, and you can add a breed later.'
    : d.mixed
      ? picked.length >= 3 ? 'Three is the most. Tap one to remove it.' : 'Pick up to three breeds in the mix.'
      : 'Pick from the list so classes match.';
  const breed = (
    <FieldGroup label="Breed" note={breedNote}>
      {d.mixed && picked.length ? (
        <ChipRow>
          {picked.map((id) => (
            <Chip key={id} selected icon="x" onPress={() => update({ breedIds: picked.filter((x) => x !== id) })}>{breedById[id]?.name ?? id}</Chip>
          ))}
        </ChipRow>
      ) : null}
      {d.mixed && picked.length >= 3 ? null : (
        <Field value={d.breed} onChangeText={typeBreed} placeholder={d.mixed ? 'Add a breed' : 'Search breeds'} left={<Icon name="search" color={c.inkMuted} />} autoCapitalize="words" />
      )}
      {suggestions.length ? (
        <ChipRow>
          {suggestions.map((b) => <Chip key={b.id} icon="plus" onPress={() => pickBreed(b.id)}>{b.name}</Chip>)}
        </ChipRow>
      ) : null}
      <ChipRow>
        <Chip selected={d.mixed} onPress={toggleMixed}>Mixed breed</Chip>
        <Chip selected={d.notSure} onPress={toggleNotSure}>Not sure</Chip>
      </ChipRow>
    </FieldGroup>
  );
  const birthday = (
    <FieldGroup label="Birthday" note={lifeStage(d.birthMonth, d.birthYear)}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Select label="Birth month" value={MONTHS[d.birthMonth]} options={MONTHS} onPick={(m) => update({ birthMonth: MONTHS.indexOf(m) })} />
        <Select label="Birth year" value={d.birthYear} options={YEARS} onPick={(birthYear) => update({ birthYear })} />
      </View>
    </FieldGroup>
  );
  const weight = (
    <FieldGroup label="Weight">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Press onPress={() => update({ weight: Math.max(2, d.weight - 1) })} accessibilityLabel="Less" style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="minus" />
        </Press>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
          <Text variant="statNum" num>{d.weight}</Text>
          <Text variant="heading" muted> lb</Text>
        </View>
        <Press onPress={() => update({ weight: Math.min(200, d.weight + 1) })} accessibilityLabel="More" style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" />
        </Press>
      </View>
    </FieldGroup>
  );
  const fixed = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
      <View style={{ gap: 2, flex: 1 }}>
        <Text variant="label" weight="600">{d.sex === 'Female' ? 'Spayed' : 'Neutered'}</Text>
        <Text variant="caption" muted>Some play groups require it.</Text>
      </View>
      <Toggle on={d.fixed} onPress={() => update({ fixed: !d.fixed })} label={d.sex === 'Female' ? 'Spayed' : 'Neutered'} />
    </View>
  );
  const next = <Button block onPress={() => router.push('/onboarding/play')}>Continue</Button>;

  if (wide) {
    return (
      <Split photo="dog_getting_pets_at_park" step={2}>
        {intro}
        {breed}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 22, columnGap: 16, alignItems: 'flex-start' }}>
          <View style={tile(200)}>{birthday}</View>
          <View style={tile(200)}>{weight}</View>
        </View>
        {fixed}
        {next}
      </Split>
    );
  }

  return (
    <Screen theme="dark">
      <StepHeader step={2} />
      <Body>
        {intro}
        {breed}
        {birthday}
        {weight}
        {fixed}
      </Body>
      <Footer>{next}</Footer>
    </Screen>
  );
}

export default themed('dark', Details);
