import * as WebBrowser from 'expo-web-browser';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { traitLabel } from '@/data/traits';
import { Button, Chip, Tag } from '@/ds/controls';
import { Field, Footer, IconButton, Screen } from '@/ds/layout';
import { Page, useWide } from '@/ds/responsive';
import { PhotoFill, Scrim } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { callTime, firstName, Notice, SpecialistRow } from '@/features/intake/parts';
import { now } from '@/lib/clock';
import { time, weekday } from '@/lib/dates';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const back = () => (router.canGoBack() ? router.back() : router.replace('/book'));

/**
 * 23d Intake call: 15 minutes with a specialist for 0 credits, by video or phone at one of their open times (or on
 * Calendly). 23e once booked: the time, how the call happens, and the meeting link from 10 minutes before.
 */
export default function IntakeCallScreen() {
  const { c } = useTheme();
  const wide = useWide();
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>();
  const dog = useDog();
  const sp = useApp((s) => s.intake.specialists.find((x) => x.trainerId === trainerId));
  const call = useApp((s) => s.intake.calls.find((x) => x.trainerId === trainerId && x.dogId === dog.id && x.status === 'booked'
    && (!x.startsAt || x.startsAt.getTime() + 30 * 60_000 > now().getTime())));
  const offer = useApp((s) => s.intake.offers.find((o) => o.dogId === dog.id && o.status === 'offered' && o.trainer === sp?.name));
  const log = useApp((s) => s.log);
  const book = useApp((s) => s.bookIntake);
  const request = useApp((s) => s.requestIntake);
  const cancel = useApp((s) => s.cancelIntake);
  const [mode, setMode] = useState<'video' | 'phone'>('video');
  const [phone, setPhone] = useState('');
  const [slotId, setSlotId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!sp) return <Redirect href="/book" />;

  const first = firstName(sp.name);
  const slot = sp.slots.find((x) => x.id === slotId) ?? sp.slots[0];
  const traits = (dog.traits ?? []).map((t) => traitLabel(t).toLowerCase());
  const notes = Math.min(3, (log ?? []).filter((e) => e.dogId === dog.id && e.note).length);
  const seen = [traits.length ? `Traits: ${traits.join(', ')}.` : null, notes ? `Trainer notes from ${dog.name}'s last ${notes === 1 ? 'session' : `${notes} sessions`}.` : null].filter(Boolean).join(' ');
  const days = sp.slots.reduce<{ key: string; label: string; slots: typeof sp.slots }[]>((acc, x) => {
    const key = x.startsAt.toDateString();
    const g = acc.find((y) => y.key === key);
    if (g) g.slots.push(x); else acc.push({ key, label: weekday(x.startsAt), slots: [x] });
    return acc;
  }, []).slice(0, 4);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };
  const confirm = () => run(() => book(sp.trainerId, slot.id, dog.id, mode, mode === 'phone' ? phone : null));
  const calendly = () => run(async () => { await WebBrowser.openBrowserAsync(await request(sp.trainerId, dog.id)); });

  const errorBox = error ? (
    <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.kennelRedSoft }} accessibilityLiveRegion="polite">
      <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text>
    </View>
  ) : null;

  // 23e: booked.
  if (call && call.mode !== 'calendly' && call.startsAt) {
    const startsAt = call.startsAt;
    const body = (
      <View style={{ gap: 18 }}>
        <View style={{ height: 240, borderRadius: 16, overflow: 'hidden' }}>
          <PhotoFill name="dog_providing_good_eye_contact" />
          <Scrim />
          <View style={{ position: 'absolute', top: 14, left: 14 }}><Tag tone="glass">0 credits</Tag></View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
            <Text variant="hero" color="#fff" accessibilityRole="header" accessibilityLiveRegion="polite">Booked.</Text>
            <Text color="#fff" style={{ marginTop: 8 }}>{`Intake call with ${first}, ${callTime(startsAt)}.`}</Text>
          </View>
        </View>
        <Text variant="caption" muted>{call.mode === 'phone'
          ? `Phone call. ${first} calls you at ${time(startsAt)}. Free cancel any time.`
          : `Video call. Pack sends the link 10 minutes before. Free cancel any time.`}</Text>
        {offer ? (
          <Notice icon="user-round" title={`${first} offered ${dog.name} a 1:1.`} body={`${offer.title}, ${callTime(offer.startsAt)}. Open it from Notifications or below.`} />
        ) : null}
        {errorBox}
      </View>
    );
    const actions = (
      <View style={{ gap: 8 }}>
        {call.link ? <Button block variant="signal" icon="video" onPress={() => WebBrowser.openBrowserAsync(call.link!)}>Join the call</Button> : null}
        {offer ? <Button block onPress={() => router.push(`/offer/${offer.id}` as Href)}>See the 1:1</Button> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="quiet" style={{ flex: 1 }} disabled={busy || startsAt <= now()} onPress={() => run(() => cancel(call.id))}>{busy ? 'Cancelling…' : 'Cancel call'}</Button>
          <Button style={{ flex: 1 }} variant={call.link || offer ? 'quiet' : 'primary'} onPress={back}>Done</Button>
        </View>
      </View>
    );
    return <Frame wide={wide} body={body} foot={actions} />;
  }

  // 23d: book.
  const body = (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text variant="wide" muted>1:1 with a specialist</Text>
        <Text variant="pageTitle" accessibilityRole="header">{`Intake call with ${sp.name}`}</Text>
        <Text variant="caption" muted>15 minutes · 0 credits</Text>
      </View>
      <SpecialistRow sp={sp} sub={[sp.credential, sp.partner].filter(Boolean).join(' · ')} />
      <Notice icon="eye" title={`${first} sees ${dog.name}'s profile before the call.`} body={seen || null} />
      {sp.calendly ? (
        <Text variant="caption" muted>{call
          ? `You shared ${dog.name}'s profile with ${first}. Pick a time on Calendly if you haven't yet.`
          : `${first} books calls through Calendly. Pick a time there, and PackPass shares ${dog.name}'s profile with ${first}.`}</Text>
      ) : sp.slots.length ? (
        <>
          {sp.phone ? (
            <View style={{ gap: 10 }}>
              <Text variant="label">How</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip selected={mode === 'video'} icon="video" onPress={() => setMode('video')}>Video</Chip>
                <Chip selected={mode === 'phone'} icon="phone" onPress={() => setMode('phone')}>Phone</Chip>
              </View>
              {mode === 'phone' ? <Field label="Your number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="(512) 555-0142" accessibilityLabel="Your number" /> : null}
            </View>
          ) : null}
          {days.map((d) => (
            <View key={d.key} style={{ gap: 10 }}>
              <Text variant="label">{d.label}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {d.slots.map((x) => <Chip key={x.id} selected={x.id === slot?.id} onPress={() => setSlotId(x.id)}>{time(x.startsAt)}</Chip>)}
              </View>
            </View>
          ))}
          <Text variant="caption" muted>{`After the call, ${first} can offer a 1:1 slot right in the app.`}</Text>
        </>
      ) : (
        <Text variant="caption" muted>{`${first} has no open times in the next two weeks. Check back soon.`}</Text>
      )}
      {errorBox}
    </View>
  );
  const foot = sp.calendly ? (
    <Button block disabled={busy} onPress={calendly}>{busy ? 'Opening…' : 'Pick a time on Calendly'}</Button>
  ) : sp.slots.length ? (
    <Button block disabled={busy || !slot || (mode === 'phone' && phone.replace(/\D/g, '').length < 7)} onPress={confirm}>{busy ? 'Booking…' : 'Book intake call'}</Button>
  ) : null;
  return <Frame wide={wide} body={body} foot={foot} />;
}

function Frame({ wide, body, foot }: { wide: boolean; body: React.ReactNode; foot: React.ReactNode }) {
  if (wide) {
    return (
      <Page>
        <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center', gap: 24 }}>
          <View style={{ flexDirection: 'row' }}><IconButton icon="chevron-left" label="Back" onPress={back} /></View>
          {body}
          {foot}
        </View>
      </Page>
    );
  }
  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}><IconButton icon="chevron-left" label="Back" onPress={back} /></View>
        {body}
      </ScrollView>
      {foot ? <Footer>{foot}</Footer> : null}
    </Screen>
  );
}
