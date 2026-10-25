import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button } from '@/ds/controls';
import { Footer, IconButton, Screen } from '@/ds/layout';
import { Page, useWide } from '@/ds/responsive';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { firstName, HomeworkList, untilLabel } from '@/features/today/Homework';
import { bookError, bookingFor, credits as creditsLabel, freeCancelUntil, nextSession } from '@/lib/booking';
import { now } from '@/lib/clock';
import { dayTimeInline, monthDay, time, weekday } from '@/lib/dates';
import { useApp, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const WORD: Record<number, string> = { 1: 'Working on it', 2: 'Getting there', 3: 'Strong' };

/**
 * 22a After class: the trainer's note, Focus, Sociability and Skill rated 1 to 3, and the homework until the next
 * class, ticked off here or on Today. Opens from the note notification and the Log.
 */
export default function AfterClass() {
  const { c } = useTheme();
  const wide = useWide();
  const rules = useRules();
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useApp((s) => s.reportCards.find((r) => r.bookingId === id));
  const bookings = useApp((s) => s.bookings);
  const dog = useApp((s) => s.dogs.find((d) => d.id === card?.dogId));
  if (!card) return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const next = nextSession(card.classId);
  const canBook = !!next && !!dog && !bookError(next.session.id, dog.id, rules) && !bookingFor(bookings.filter((b) => b.dogId === dog.id), next.session.id);
  const open = card.openUntil > now();
  const ratings: [string, number][] = [['Focus', card.ratings.focus], ['Sociability', card.ratings.sociability], ['Skill', card.ratings.skill]];

  const body = (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 6 }}>
        <Text variant="caption" muted>{`${weekday(card.startsAt).slice(0, 3)}, ${monthDay(card.startsAt)} · ${card.partner}`}</Text>
        <Text variant="pageTitle" accessibilityRole="header">{card.title}</Text>
      </View>
      <View style={{ padding: 18, borderRadius: 16, backgroundColor: c.surfaceRaised, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Photo name={card.trainerPhoto} style={{ width: 40, height: 40, borderRadius: 9999 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" weight="600">{card.trainer ?? card.partner}</Text>
            <Text variant="caption" muted numberOfLines={1}>{[card.trainerRole, card.partner].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        {card.note ? <Text variant="body">{card.note}</Text> : null}
        <View style={{ gap: 8 }}>
          {ratings.map(([k, n]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel={`${k}: ${n} of 3, ${WORD[n]}`}>
              <Text variant="caption" style={{ width: 84 }}>{k}</Text>
              <View style={{ flexDirection: 'row', gap: 4, width: 84 }}>
                {[1, 2, 3].map((j) => <View key={j} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: j <= n ? c.ink : c.surfaceSunken }} />)}
              </View>
              <Text variant="caption" muted>{WORD[n]}</Text>
            </View>
          ))}
        </View>
      </View>
      {card.homework.length ? (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <Text variant="title">Homework</Text>
            <Text variant="caption" muted>{open ? `${card.done.length} of ${card.homework.length} · ${untilLabel(card)}` : `${card.done.length} of ${card.homework.length} done`}</Text>
          </View>
          <HomeworkList card={card} />
          <Text variant="caption" muted>{`Ticked items go to ${dog?.name ?? 'your dog'}'s Log.`}</Text>
        </View>
      ) : (
        <Text variant="caption" muted>{`No homework from ${firstName(card.trainer)} this time.`}</Text>
      )}
    </View>
  );

  const foot = canBook && next ? (
    <>
      <Text variant="caption" muted center>{`Next ${weekday(next.session.startsAt).slice(0, 3)} ${time(next.session.startsAt)} · ${next.cls.dropOff ? 'Drop-off' : 'You stay'} · Free cancel until ${dayTimeInline(freeCancelUntil(next))}`}</Text>
      <Button variant="signal" block onPress={() => router.push(`/book/${next.session.id}` as Href)}>{`Book again for ${creditsLabel(next.cls.credits)}`}</Button>
    </>
  ) : null;

  if (wide) {
    return (
      <Page>
        <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center', gap: 24 }}>
          <View style={{ flexDirection: 'row' }}><IconButton icon="chevron-left" label="Back" onPress={back} /></View>
          {body}
          {foot ? <View style={{ gap: 10 }}>{foot}</View> : null}
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
      {foot ? <Footer>{foot}</Footer> : null}
    </Screen>
  );
}
