import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { TOP_UP } from '@/data/plans';
import { Button, Chip, Tag } from '@/ds/controls';
import { IconButton, useBottom } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { ModalSheet } from '@/ds/sheet';
import { tile, useWide } from '@/ds/responsive';
import { ClearanceBlocker, clearanceBlock, CreditsBlocker, FullBlocker, VaccineBlocker, vaccineFix, WaiverBlocker } from '@/features/book/Blockers';
import { WaitlistActions } from '@/features/book/Waitlist';
import { Photo, PhotoFill, Scrim } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { credits as creditsLabel, eligibility, sameDaySessions, view } from '@/lib/booking';
import { addToCalendar } from '@/lib/calendar';
import { cancelCopy, dayTimeInline, relativeDay, time } from '@/lib/dates';
import { pay, settle } from '@/lib/checkout';
import { comingWithAccounts } from '@/lib/notice';
import { unsignedWaiver } from '@/lib/ready';
import { activeDogId, recordOf, useAllowance, useApp, useDog, useRulesFor } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** 06 Booking sheet. "Book for 2 credits" → "Confirm booking" → "Booked." */
export default function BookingSheet() {
  const { c } = useTheme();
  const wide = useWide();
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
  const vaccines = useApp((s) => recordOf(s, dogId).vaccines);
  const waivers = useApp((s) => s.waivers);
  const signed = useApp((s) => s.waiversSigned);
  const signWaiver = useApp((s) => s.signWaiver);
  const selectDog = useApp((s) => s.selectDog);
  const accountName = useApp((s) => s.account.name);
  const [signName, setSignName] = useState(accountName);
  const [agree, setAgree] = useState(false);

  const v = view(selected) ?? first;
  if (!v) return null;
  const { cls, partner, session } = v;
  const cost = cls.credits;
  const short = credits < cost;
  const already = bookings.some((b) => b.sessionId === session.id && b.dogId === dogId && b.status !== 'cancelled');
  const dog = dogs.find((d) => d.id === dogId) ?? dogs[0];
  const el = eligibility(v, rules, dog?.name);
  const dogName = dog?.name ?? 'Your dog';
  // The waiver isn't a lock on the class: the sheet signs it, then books (block-waiver).
  const waiver = el.ok && !already ? unsignedWaiver(waivers, signed, partner.id) : null;
  const clearance = !el.ok ? clearanceBlock(v, el) : null;
  const vaccineBlock = !el.ok && el.needs === 'vaccines';

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

  // Signs the waiver showing; books too when nothing else is left to sign and the class can be booked now.
  const sign = async (thenBook: boolean) => {
    if (!waiver) return;
    setBusy(true);
    setError(null);
    try {
      await signWaiver(waiver.id, signName);
    } catch (e) {
      setBusy(false);
      return setError(errorCopy(e));
    }
    setAgree(false);
    const s = useApp.getState();
    if (thenBook && !unsignedWaiver(s.waivers, s.waiversSigned, partner.id)) return confirm();
    setBusy(false);
  };

  // Records live on the dog the app is showing, so switch to the booking's dog before uploading.
  const uploadRecord = async () => {
    if (activeDogId(useApp.getState()) !== dogId) await selectDog(dogId);
    const fix = vaccineFix(vaccines, session.startsAt);
    router.push(fix && !rules.recordsDenied ? { pathname: '/vaccines', params: { type: fix.type } } : '/vaccines');
  };

  const body = (
    done ? (
      <>
        <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', ...(wide ? { marginTop: 40 } : null) }}>
          <PhotoFill name={cls.image} />
          <Scrim />
          <View style={{ position: 'absolute', top: 14, left: 14 }}><Tag tone="glass">{allowance ? `${credits} of ${allowance} credits left` : `${creditsLabel(credits)} left`}</Tag></View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
            <Text variant="hero" color="#fff" accessibilityRole="header" accessibilityLiveRegion="polite">Booked.</Text>
            <Text color="#fff" style={{ marginTop: 8 }}>{`${cls.title}, ${dayTimeInline(session.startsAt)}.`}</Text>
          </View>
        </View>
        <Text variant="caption" muted style={{ marginTop: 14, marginHorizontal: 4 }}>{`${partner.name} · ${partner.address}. ${cancelCopy(session.startsAt)}.`}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: wide ? 18 : 16 }}>
          <Button variant="quiet" style={{ flex: 1 }} disabled={added} onPress={() => addToCalendar(v).then(setAdded).catch(() => {})}>{added ? 'Added' : 'Add to calendar'}</Button>
          <Button style={{ flex: 1 }} onPress={() => router.dismissTo('/')}>Done</Button>
        </View>
      </>
    ) : (
      <>
        <Text variant="wide" muted>{`${relativeDay(session.startsAt)} · ${partner.name}`}</Text>
        <Text variant="displayLg" style={{ marginTop: 8 }}>{cls.title}</Text>

        <Text variant="label" style={{ marginTop: wide ? 24 : 22, marginBottom: 10 }}>Time</Text>
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

        {!el.ok && clearance ? (
          <View style={{ marginTop: wide ? 24 : 22 }}><ClearanceBlocker v={v} el={el} dogName={dogName} /></View>
        ) : vaccineBlock ? (
          <View style={{ marginTop: wide ? 24 : 22 }}><VaccineBlocker v={v} vaccines={vaccines} dogName={dogName} denied={rules.recordsDenied} /></View>
        ) : el.ok && !already ? (
          <View style={{ gap: 16, marginTop: wide ? 24 : 22 }}>
            {waiver ? <WaiverBlocker waiver={waiver} partnerName={partner.name} name={signName} setName={setSignName} agree={agree} setAgree={setAgree} />
              : session.spotsLeft === 0 ? <FullBlocker v={v} />
                : short ? <CreditsBlocker v={v} credits={credits} /> : null}
            {session.spotsLeft === 0 ? null : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text>{creditsLabel(cost)}</Text>
                  {cls.dropOff ? <Tag>Drop-off</Tag> : null}
                </View>
                <Text variant="label" num color={short ? c.kennelRed : c.inkMuted}>
                  {short ? `You have ${creditsLabel(credits)} left` : allowance ? `${credits - cost} of ${allowance} left after booking` : `${creditsLabel(credits - cost)} left after booking`}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: 16, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.kennelRedSoft }} accessibilityLiveRegion="polite">
            <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text>
          </View>
        ) : null}
        <View style={{ gap: 8, marginTop: 16 }}>
          {!el.ok && clearance ? (
            <>
              {clearance.assessment ? <Button block onPress={() => router.replace(`/book/${clearance.assessment!.session.id}`)}>Book assessment</Button> : null}
              <Button variant="quiet" block onPress={() => router.replace('/book')}>{`See classes ${dogName} can join`}</Button>
            </>
          ) : vaccineBlock ? (
            <Button block icon="file-plus" onPress={uploadRecord}>Upload record</Button>
          ) : !el.ok ? (
            <Text variant="label" muted>{el.reason}</Text>
          ) : already ? (
            <Button block disabled>{`${dogName} is booked for this`}</Button>
          ) : waiver ? (
            session.spotsLeft === 0 || short
              ? <Button block disabled={busy || !agree || signName.trim().length < 2} onPress={() => sign(false)}>{busy ? 'Signing…' : 'Sign waiver'}</Button>
              : <Button block variant="signal" disabled={busy || !agree || signName.trim().length < 2} onPress={() => sign(true)}>{busy ? 'Signing…' : 'Sign and book'}</Button>
          ) : session.spotsLeft === 0 ? (
            <WaitlistActions v={v} dogId={dogId} dogName={dogName} />
          ) : short && wide ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <View style={tile(180)}><Button block disabled={busy} onPress={buyCredits}>{busy ? 'Opening checkout…' : `Buy ${TOP_UP.credits} credits · ${TOP_UP.price}`}</Button></View>
              <View style={tile(180)}><Button variant="quiet" block onPress={() => router.replace('/book')}>Pick a 1-credit class</Button></View>
            </View>
          ) : short ? (
            <>
              <Button block disabled={busy} onPress={buyCredits}>{busy ? 'Opening checkout…' : `Buy ${TOP_UP.credits} credits · ${TOP_UP.price}`}</Button>
              <Button variant="quiet" block onPress={() => router.replace('/book')}>Pick a 1-credit class</Button>
            </>
          ) : (
            <Button block disabled={busy} onPress={confirm}>{busy ? 'Booking…' : 'Confirm booking'}</Button>
          )}
          {(wide || waiver) && el.ok && !already && session.spotsLeft > 0 && !short ? <Text variant="caption" muted center style={{ marginTop: 2 }}>{cancelCopy(session.startsAt)}</Text> : null}
        </View>
      </>
    )
  );

  if (wide) {
    return (
      <Overlay kind="dialog" width={520} top={72} onClose={close}>
        <View style={{ padding: 28 }}>
          {body}
          <View style={{ position: 'absolute', top: 16, right: 16 }}>
            <IconButton icon="x" size={40} label="Close" onPress={close} />
          </View>
        </View>
      </Overlay>
    );
  }

  return (
    <ModalSheet
      onClose={close}
      padding={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: bottom }}
    >
      {body}
    </ModalSheet>
  );
}

