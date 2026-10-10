import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { isLive } from '@/api/client';
import type { LogEntry } from '@/data/types';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Screen, useBottom, themed } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { Body, Intro } from '@/features/onboarding/parts';
import { credits as creditsLabel } from '@/lib/booking';
import { now } from '@/lib/clock';
import { monthDay, time, weekday } from '@/lib/dates';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Sample mode's missed class (Settings › Preview states): yesterday's Agility drop-in. */
function sampleMissed(dogId: string): LogEntry {
  const at = now();
  const startsAt = new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1, 18, 30);
  return {
    bookingId: 'sample', dogId, startsAt, durationMin: 50, classId: 'agility-drop-in', title: 'Agility drop-in',
    image: 'athletic_dog_catching_ball', balance: 'physical', partner: 'Ridgeline Dog Sport', trainer: 'Dev Patel',
    note: null, skills: [], noteBy: null, assessment: null, missed: true, credits: 2,
  };
}

/**
 * Missed class. The dog wasn't checked in and the booking wasn't cancelled at least 12 hours before, so the
 * credits were used (supabase/migrations/…_missed_classes.sql marks the no-show). Opens once per missed class
 * on launch, and from the notification and the Log.
 */
function MissedClass() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const dog = useDog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useApp((s) => s.missed.find((e) => e.bookingId === id));
  const see = useApp((s) => s.seeMissed);
  const e = found ?? (!isLive && id === 'sample' ? sampleMissed(dog.id) : null);
  if (!e) return <Redirect href="/" />;

  const close = () => {
    see(e.bookingId);
    if (router.canGoBack()) router.back(); else router.replace('/');
  };
  const book = () => {
    see(e.bookingId);
    router.replace('/book');
  };

  return (
    <Screen theme="dark">
      <Body top={34}>
        <View style={{ width: 64, height: 64, borderRadius: 9999, backgroundColor: c.kennelRedSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="calendar-x" size={30} color={c.kennelRed} />
        </View>
        <Intro
          eyebrow={`${dog.name} · Missed class`}
          title="Missed class."
          lede={`${dog.name} wasn't checked in to ${e.title}, and it wasn't cancelled at least 12 hours before. The ${e.credits === 1 ? 'credit was' : 'credits were'} used.`}
        />
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Photo name={e.image} style={{ width: 56, height: 56, borderRadius: 16 }} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="label" weight="600" numberOfLines={1}>{e.title}</Text>
            <Text variant="caption" muted numberOfLines={1}>{`${weekday(e.startsAt)} ${monthDay(e.startsAt)} · ${time(e.startsAt)}`}</Text>
            <Text variant="caption" muted numberOfLines={1}>{e.partner}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="label" weight="600" color={c.kennelRed}>{`−${creditsLabel(e.credits)}`}</Text>
            <Text variant="caption" muted>Used</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Icon name="clock" />
          <Text variant="label" style={{ flex: 1 }}>Cancel at least 12 hours before a class and the credits come back to your balance.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Icon name="message-square" />
          <Text variant="label" style={{ flex: 1 }}>{`Was ${dog.name} there? Ask the trainer to check ${dog.name} in and this goes away.`}</Text>
        </View>
      </Body>
      <View style={{ paddingHorizontal: 20, paddingBottom: bottom, gap: 10 }}>
        <Button block onPress={book}>Find another class</Button>
        <Button variant="quiet" block onPress={close}>Got it</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', MissedClass);
