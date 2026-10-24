import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorCopy } from '@/api/errors';
import type { PracticeRemind } from '@/data/types';
import { Button, Chip } from '@/ds/controls';
import { IconButton, Toggle, useBottom } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { useWide } from '@/ds/responsive';
import { ModalSheet } from '@/ds/sheet';
import { Text } from '@/ds/Text';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const DAYS: [number, string][] = [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [7, 'Every day']];
const REMIND: [PracticeRemind, string][] = [['morning', 'Morning'], ['after_work', 'After work'], ['evening', 'Evening']];

/** 07l Weekly goal: how many days a week to practice, and an off-day reminder. No streak. */
export default function PracticeGoal() {
  const { c } = useTheme();
  const wide = useWide();
  const bottom = useBottom(34);
  const dog = useDog();
  const setPracticeGoal = useApp((s) => s.setPracticeGoal);
  const [days, setDays] = useState(dog.practiceDays ?? 3);
  const [remind, setRemind] = useState<PracticeRemind | null>(dog.practiceRemind ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/log'));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setPracticeGoal(dog.id, days, remind);
      back();
    } catch (e) {
      setError(errorCopy(e));
      setBusy(false);
    }
  };

  const body = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">Weekly goal</Text>
        <IconButton icon="x" size={36} label="Close" onPress={back} />
      </View>
      <Text variant="heading" style={{ marginBottom: 12 }}>{`How many days a week can you practice with ${dog.name}?`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DAYS.map(([n, label]) => <Chip key={n} selected={days === n} onPress={() => setDays(n)}>{label}</Chip>)}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 28 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="heading">Remind me</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>Only on days without a booked class.</Text>
        </View>
        <Toggle on={!!remind} label="Remind me" onPress={() => setRemind(remind ? null : 'after_work')} />
      </View>
      {remind ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {REMIND.map(([id, label]) => <Chip key={id} selected={remind === id} onPress={() => setRemind(id)}>{label}</Chip>)}
        </View>
      ) : null}
      <Text muted style={{ marginTop: 28 }}>Short and often beats long and rare. Ten minutes on a walk counts.</Text>
      {error ? <Text variant="label" color={c.kennelRed} style={{ marginTop: 16 }}>{error}</Text> : null}
      <Button block onPress={save} disabled={busy} style={{ marginTop: 24 }}>Save goal</Button>
    </View>
  );

  if (wide) {
    return (
      <Overlay kind="dialog" width={480} top={80} onClose={back}>
        <View style={{ padding: 24 }}>{body}</View>
      </Overlay>
    );
  }
  return (
    <ModalSheet onClose={back} padding={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: bottom }}>
      {body}
    </ModalSheet>
  );
}
