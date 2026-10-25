import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Footer, IconButton, Screen } from '@/ds/layout';
import { Page, useWide } from '@/ds/responsive';
import { Text } from '@/ds/Text';
import { callTime, Facts, firstName, Notice } from '@/features/intake/parts';
import { credits as creditsLabel } from '@/lib/booking';
import { now } from '@/lib/clock';
import { cancelCopy, dayTimeInline } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * 23f A specialist offers a 1:1: their words, when and where, and the credits. Booking goes through the booking sheet
 * (waivers, vaccines and credits as for any class); asking for another time hands it back to the specialist.
 */
export default function PrivateOfferScreen() {
  const { c } = useTheme();
  const wide = useWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const offer = useApp((s) => s.intake.offers.find((o) => o.id === id));
  const dog = useApp((s) => s.dogs.find((d) => d.id === offer?.dogId));
  const decline = useApp((s) => s.declineOffer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!offer) return <Redirect href="/" />;

  const who = firstName(offer.trainer);
  const dogName = dog?.name ?? 'your dog';
  const status = offer.status === 'offered' && offer.expiresAt <= now() ? 'expired' : offer.status;
  const ask = async () => {
    setBusy(true); setError(null);
    try { await decline(offer.id); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };

  const closed = {
    booked: `Booked. ${dogName} is down for ${dayTimeInline(offer.startsAt)}.`,
    other_time: `You asked ${who} for another time. ${who} can offer a new one in the app.`,
    expired: `This offer expired. Book another intake call or a 1:1 from Book › Skills.`,
  } as const;

  const body = (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text variant="wide" muted>{`Offered by ${offer.trainer ?? offer.partner}`}</Text>
        <Text variant="pageTitle" accessibilityRole="header">{`1:1 · ${offer.title}`}</Text>
      </View>
      {offer.note ? <Text style={{ fontSize: 18, lineHeight: 27 }}>{`“${offer.note}”`}</Text> : null}
      <Facts items={[['When', callTime(offer.startsAt)], ['Where', offer.partner], ['Length', `${offer.durationMin} min`], ['Credits', String(offer.credits)]]} />
      <Notice icon="users" title={`You stay with ${dogName}.`} body={`${cancelCopy(offer.startsAt, offer.cancelHours)}.`} />
      {status !== 'offered' ? (
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: status === 'booked' ? c.turfSoft : c.surfaceRaised }} accessibilityLiveRegion="polite">
          <Text variant="label" weight="600">{closed[status]}</Text>
        </View>
      ) : (
        <Text variant="caption" muted>{`Only you can book this slot. It's held until ${dayTimeInline(offer.expiresAt)}.`}</Text>
      )}
      {error ? (
        <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.kennelRedSoft }} accessibilityLiveRegion="polite">
          <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
  const foot = status === 'offered' ? (
    <View style={{ gap: 8 }}>
      <Button block variant="signal" disabled={busy} onPress={() => router.push(`/book/${offer.sessionId}` as Href)}>{`Book for ${creditsLabel(offer.credits)}`}</Button>
      <Button block variant="quiet" disabled={busy} onPress={ask}>{busy ? 'Sending…' : 'Ask for another time'}</Button>
    </View>
  ) : (
    <Button block onPress={back}>Done</Button>
  );

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
        <View style={{ flexDirection: 'row' }}><IconButton icon="chevron-left" label="Back" onPress={back} /></View>
        {body}
      </ScrollView>
      <Footer>{foot}</Footer>
    </Screen>
  );
}
