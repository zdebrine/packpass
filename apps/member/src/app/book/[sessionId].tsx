import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';

import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { TOP_UP } from '@/data/plans';
import { Button, Chip, Tag } from '@/ds/controls';
import { Grabber, useBottom } from '@/ds/layout';
import { WaitlistActions } from '@/features/book/Waitlist';
import { Photo, PhotoFill, Scrim } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { credits as creditsLabel, eligibility, sameDaySessions, view } from '@/lib/booking';
import { addToCalendar } from '@/lib/calendar';
import { cancelCopy, dayTimeInline, relativeDay, time } from '@/lib/dates';
import { pay, settle } from '@/lib/checkout';
import { comingWithAccounts } from '@/lib/notice';
import { useAllowance, useApp, useDog, useRulesFor } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

const ease = Easing.bezier(...motion.easeOut);
const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** 06 Booking sheet. "Book for 2 credits" → "Confirm booking" → "Booked." */
export default function BookingSheet() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const first = view(sessionId);
  const [selected, setSelected] = useState(sessionId);
  const dogs = useApp((s) => s.dogs);
  // Starts on the dog that's showing; the picker books any of the member's dogs, on that dog's own records.
  const [dogId, setDogId] = useState(useDog().id);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const credits = useApp((s) => s.credits);
  const allowance = useAllowance();
  const bookings = useApp((s) => s.bookings);
  const rules = useRulesFor(dogId);
  const book = useApp((s) => s.bookSession);

  const v = view(selected) ?? first;
  if (!v) return null;
  const { cls, partner, session } = v;
  const cost = cls.credits;
  const short = credits < cost;
  const already = bookings.some((b) => b.sessionId === session.id && b.dogId === dogId && b.status !== 'cancelled');
  const dog = dogs.find((d) => d.id === dogId) ?? dogs[0];
  const el = eligibility(v, rules, dog?.name);

  // A 2-credit top-up through Stripe Checkout, then back to this sheet with the credits added.
  const buyCredits = async () => {
    if (!isLive) return comingWithAccounts('Buy more credits');
    setBusy(true);
    setError(null);
    try {
      if ((await pay('credits', `/book/${sessionId}`)) === 'done') await settle();
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const r = await book(session.id, dogId);
    setBusy(false);
    if (!r.ok) return setError(errorCopy(r.error));
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Photo name={cls.image} style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 460 }} />
      <Animated.View entering={FadeIn.duration(motion.base)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(motion.base).easing(ease)}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, paddingHorizontal: 20, paddingBottom: bottom }}
        accessibilityViewIsModal
      >
        <Grabber />
        <View style={{ height: 18 }} />
        {done ? (
          <>
            <View style={{ height: 260, borderRadius: 28, overflow: 'hidden' }}>
              <PhotoFill name={cls.image} />
              <Scrim />
              <View style={{ position: 'absolute', top: 14, left: 14 }}><Tag tone="glass">{allowance ? `${credits} of ${allowance} credits left` : `${creditsLabel(credits)} left`}</Tag></View>
              <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
                <Text variant="display2xl" color="#fff" accessibilityRole="header" accessibilityLiveRegion="polite">Booked.</Text>
                <Text color="#fff" style={{ marginTop: 8 }}>{`${cls.title}, ${dayTimeInline(session.startsAt)}.`}</Text>
              </View>
            </View>
            <Text variant="caption" muted style={{ marginTop: 14, marginHorizontal: 4 }}>{`${partner.name} · ${partner.address}. ${cancelCopy(session.startsAt)}.`}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button variant="quiet" style={{ flex: 1 }} disabled={added} onPress={() => addToCalendar(v).then(setAdded).catch(() => {})}>{added ? 'Added' : 'Add to calendar'}</Button>
              <Button style={{ flex: 1 }} onPress={() => router.dismissTo('/')}>Done</Button>
            </View>
          </>
        ) : (
          <>
            <Text variant="wide" muted>{`${relativeDay(session.startsAt)} · ${partner.name}`}</Text>
            <Text variant="displayLg" style={{ marginTop: 8 }}>{cls.title}</Text>

            <Text variant="label" style={{ marginTop: 22, marginBottom: 10 }}>Time</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {sameDaySessions(v).map((s) => (
                <Chip key={s.id} selected={s.id === session.id} onPress={() => { if (s.spotsLeft > 0) { setSelected(s.id); setError(null); } }} style={s.spotsLeft === 0 ? { opacity: 0.4 } : undefined}>
                  {cls.openWindow ? cls.openWindow : time(s.startsAt)}
                </Chip>
              ))}
            </View>

            <Text variant="label" style={{ marginTop: 20, marginBottom: 10 }}>Dog</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {dogs.map((d) => (
                <Chip key={d.id} selected={d.id === dogId} onPress={() => { setDogId(d.id); setError(null); }} leading={<Photo name={d.photo} style={{ width: 28, height: 28, borderRadius: 9999 }} />}>{d.name}</Chip>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text>{creditsLabel(cost)}</Text>
                {cls.dropOff ? <Tag>Drop-off</Tag> : null}
              </View>
              <Text variant="label" num color={short ? c.kennelRed : c.inkMuted}>
                {short ? `You have ${creditsLabel(credits)} left` : allowance ? `${credits - cost} of ${allowance} left after booking` : `${creditsLabel(credits - cost)} left after booking`}
              </Text>
            </View>

            {error ? (
              <View style={{ marginTop: 16, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.kennelRedSoft }} accessibilityLiveRegion="polite">
                <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text>
              </View>
            ) : null}
            <View style={{ gap: 8, marginTop: 16 }}>
              {!el.ok ? (
                <Text variant="label" muted>{el.reason}</Text>
              ) : already ? (
                <Button block disabled>{`${dog?.name ?? 'Your dog'} is booked for this`}</Button>
              ) : session.spotsLeft === 0 ? (
                <WaitlistActions v={v} dogId={dogId} dogName={dog?.name ?? 'your dog'} />
              ) : short ? (
                <>
                  <Button block disabled={busy} onPress={buyCredits}>{busy ? 'Opening checkout…' : `Buy ${TOP_UP.credits} credits · ${TOP_UP.price}`}</Button>
                  <Button variant="quiet" block onPress={() => router.replace('/book')}>Pick a 1-credit class</Button>
                </>
              ) : (
                <Button block disabled={busy} onPress={confirm}>{busy ? 'Booking…' : 'Confirm booking'}</Button>
              )}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

