import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { isLive } from '@/api/client';
import type { LogEntry } from '@/data/types';
import { Button, Tag } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Badge, IconButton, Screen, themed, useBottom, useTop } from '@/ds/layout';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { checkInClosesAt, credits as creditsLabel } from '@/lib/booking';
import { now } from '@/lib/clock';
import { addMinutes, dayOffset, monthDay, time, weekday } from '@/lib/dates';
import { openSite } from '@/lib/site';
import { useAllowance, useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Sample mode's missed class (Settings › Preview states): last Thursday's Herding Fundamentals, as in the designs. */
function sampleMissed(dogId: string): LogEntry {
  const at = now();
  const startsAt = new Date(at.getFullYear(), at.getMonth(), at.getDate() - 5, 7, 30);
  return {
    bookingId: 'sample', dogId, startsAt, durationMin: 60, classId: 'herding-fundamentals', title: 'Herding Fundamentals',
    image: 'dog_chilling', balance: 'mental', partner: 'Ridgeline Dog Sport', trainer: 'Maren Holt',
    note: null, skills: [], noteBy: null, assessment: null, missed: true, credits: 2,
  };
}

/** "Thursday" within the past week, else "Sep 24". */
const dayLabel = (d: Date) => (dayOffset(d) > -7 ? weekday(d) : monthDay(d));

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
      <Badge icon={icon} bg={c.bg} fg={c.ink} size={48} iconSize={20} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" muted>{label}</Text>
        <Text variant="label" weight="600">{value}</Text>
      </View>
    </View>
  );
}

/**
 * 15b Missed class · credits kept. The dog wasn't checked in and the booking wasn't cancelled before the free
 * cancellation window closed (12 hours before), so the credits stay used (supabase/migrations/…_missed_classes.sql
 * marks the no-show). Opens once per missed class on launch, and from the notification and the Log.
 */
function MissedClass() {
  const { c } = useTheme();
  const top = useTop();
  const bottom = useBottom(34);
  const dog = useDog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useApp((s) => s.missed.find((e) => e.bookingId === id));
  const see = useApp((s) => s.seeMissed);
  const credits = useApp((s) => s.credits);
  const allowance = useAllowance();
  const e = found ?? (!isLive && id === 'sample' ? sampleMissed(dog.id) : null);
  if (!e) return <Redirect href="/" />;

  // Check-in closes 15 minutes after the start (check_in); free cancellation 12 hours before it (cancel_booking).
  const checkInClosed = checkInClosesAt(e.startsAt);
  const windowClosed = addMinutes(e.startsAt, -12 * 60);
  const done = (to?: '/book') => {
    see(e.bookingId);
    if (to) router.replace(to);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottom }}>
        <View style={{ height: 380, overflow: 'hidden' }}>
          <PhotoFill name={e.image} />
          <Gradient stops={[['rgba(0,0,0,0.35)', 0], ['rgba(0,0,0,0)', 0.25], ['rgba(0,0,0,0.25)', 0.5], [c.bg, 1]]} />
          <View style={{ position: 'absolute', top: top + 8, left: 20 }}>
            <IconButton glass icon="x" label="Close" onPress={() => done()} />
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20 }}>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              <Tag tone="glass">MISSED</Tag>
            </View>
            <Text variant="displayXl" color="#fff" accessibilityRole="header" style={{ fontSize: 40, lineHeight: 38 }}>{`${dog.name} missed ${e.title}.`}</Text>
            <Text variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 10 }}>{`${dayLabel(e.startsAt)} ${time(e.startsAt)} · ${e.partner}`}</Text>
          </View>
        </View>

        <View style={{ paddingTop: 12, paddingHorizontal: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 18, borderRadius: 20, backgroundColor: c.kennelRedSoft }}>
            <Icon name="circle-alert" size={24} color={c.kennelRed} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" weight="600" color={c.kennelRed}>{`${creditsLabel(e.credits)} ${e.credits === 1 ? 'was' : 'were'} not returned.`}</Text>
              <Text variant="caption" color={c.kennelRed}>{`No check-in by ${time(checkInClosed)} and the booking wasn't cancelled before the window closed.`}</Text>
            </View>
          </View>
          <Row icon="clock" label="Free cancellation" value={`Closed ${weekday(windowClosed)} ${time(windowClosed)}`} />
          <Row icon="wallet" label="Balance" value={allowance ? `${credits} of ${allowance} credits left` : `${creditsLabel(credits)} left`} />
          <Text variant="caption" muted style={{ textAlign: 'center', marginTop: 8, marginHorizontal: 8 }}>
            Cancel before the window closes and the credits come back to your account.
          </Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            <Button block onPress={() => done('/book')}>Book another time</Button>
            <Button variant="quiet" block onPress={() => { see(e.bookingId); openSite('/support'); }}>{`${dog.name} was there. Report a problem`}</Button>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

export default themed('dark', MissedClass);
