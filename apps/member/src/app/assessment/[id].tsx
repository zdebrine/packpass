import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { FIRST_QUOTE, RECHECK_QUOTE } from '@/data/passport';
import type { LogEntry } from '@/data/types';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Bars, Footer, IconButton, Screen, useTop } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { monthDay } from '@/lib/dates';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 11 Assessment result. Opened from the Log with a booking id, it shows that result as the partner
 * recorded it. The sample route (/assessment/social) shows the Sep 12 "Not yet" result until Juno
 * passes the re-check.
 */
export default function AssessmentResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useApp((s) => s.log?.find((e) => e.bookingId === id && e.assessment));
  return entry ? <RecordedResult e={entry} /> : <SampleResult />;
}

function RecordedResult({ e }: { e: LogEntry }) {
  const { c } = useTheme();
  const top = useTop();
  const dog = useDog();
  const a = e.assessment!;
  const type = a.type === 'social' ? 'Social' : 'Herding';
  const cleared = a.outcome === 'cleared';
  const close = () => (router.canGoBack() ? router.back() : router.replace('/log'));
  const list = (title: string, items: string[], icon: 'check' | 'trending-up') => (items.length ? (
    <>
      <Text variant="title" style={{ marginTop: 28, marginBottom: 14 }}>{title}</Text>
      <View style={{ gap: 12 }}>
        {items.map((x) => (
          <View key={x} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={icon} color={icon === 'check' ? undefined : c.turf} /><Text style={{ flex: 1 }}>{x}</Text></View>
        ))}
      </View>
    </>
  ) : null);

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ backgroundColor: c.pitch, paddingTop: top + 10, paddingHorizontal: 20, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="wide" color={c.onPitchMuted}>{`Assessment result · ${monthDay(e.startsAt)}`}</Text>
            <IconButton icon="x" label="Close" onPress={close} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>
          <Text variant="displayXl" color={c.onPitch} style={{ marginTop: 18 }} accessibilityRole="header">{`${type} assessment.`}</Text>
          <Text variant="label" color={c.onPitchMuted} style={{ marginTop: 8 }}>{[e.partner, a.assessor, e.title].join(' · ')}</Text>
        </View>
        <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 32 }}>
          {cleared ? (
            <View style={{ backgroundColor: c.agility, borderRadius: 28, padding: 20, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: 'rgba(14,15,14,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shield-check" size={24} color={c.onAgility} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="wide" color={c.onAgility}>New clearance</Text>
                <Text variant="displayMd" color={c.onAgility} style={{ marginTop: 4 }}>{`${type} cleared`}</Text>
                <Text variant="caption" color={c.onAgility} style={{ marginTop: 4 }}>
                  {a.type === 'herding' ? `Assessed at ${e.partner}. Herding stays with this partner.` : `${e.partner}. Counts at every PackPass partner.`}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 8 }}>
              <Text variant="wide" color={c.turf}>{`${type} · Working on it`}</Text>
              <Text variant="displayMd">{a.type === 'social' ? "Not yet. Here's the path." : 'Not yet.'}</Text>
              <Text variant="caption" muted>{a.type === 'social' ? `Calm around dogs gets ${dog.name} ready for a re-check.` : `Book another Herding assessment at ${e.partner} when ${dog.name} is ready.`}</Text>
            </View>
          )}
          {a.quote ? (
            <>
              <Text style={{ marginTop: 24 }}>{`“${a.quote}”`}</Text>
              <Text variant="caption" muted style={{ marginTop: 6 }}>{`${a.assessor}, ${e.partner}`}</Text>
            </>
          ) : null}
          {list('Strengths', a.strengths, 'check')}
          {list('Working on', a.workingOn, 'trending-up')}
        </View>
      </ScrollView>
      <Footer>
        {cleared ? (
          <Button block onPress={() => router.push(`/passport/${a.type}`)}>{`See ${dog.name}'s Passport`}</Button>
        ) : a.type === 'social' ? (
          <Button block onPress={() => router.push('/goal/calm-around-dogs')}>See the path</Button>
        ) : (
          <Button block onPress={close}>Back to Log</Button>
        )}
      </Footer>
    </Screen>
  );
}

function SampleResult() {
  const { c } = useTheme();
  const top = useTop();
  const social = useApp((s) => s.social);
  const cleared = social !== 'working';
  const strengths = cleared ? ['Calm in group play', "Reads other dogs' signals", 'Recovers fast after a startle'] : ['Calm one-on-one', 'Recovers fast after a startle', 'Easy to handle at the gate'];
  const working = cleared ? ['Fixates for the first few minutes'] : ['Fixates on new dogs at the gate', 'Fixates for the first few minutes'];

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ backgroundColor: c.pitch, paddingTop: top + 10, paddingHorizontal: 20, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="wide" color={c.onPitchMuted}>{`Assessment result · ${cleared ? 'Sep 29' : 'Sep 12'}`}</Text>
            <IconButton icon="x" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/log'))} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>
          <Text variant="displayXl" color={c.onPitch} style={{ marginTop: 18 }} accessibilityRole="header">{cleared ? 'Social re-check.' : 'Social assessment.'}</Text>
          <Text variant="label" color={c.onPitchMuted} style={{ marginTop: 8 }}>Eastside Dog Club · Sam Reyes · Small-group play</Text>
        </View>

        <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 32 }}>
          {cleared ? (
            <>
              <View style={{ backgroundColor: c.agility, borderRadius: 28, padding: 20, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: 'rgba(14,15,14,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="shield-check" size={24} color={c.onAgility} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="wide" color={c.onAgility}>New clearance</Text>
                  <Text variant="displayMd" color={c.onAgility} style={{ marginTop: 4 }}>Social cleared</Text>
                  <Text variant="caption" color={c.onAgility} style={{ marginTop: 4 }}>Eastside Dog Club · Sep 2026 · Expires Sep 2027</Text>
                </View>
              </View>
              <Text style={{ marginTop: 24 }}>{`“${RECHECK_QUOTE}”`}</Text>
            </>
          ) : (
            <>
              <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 12 }}>
                <Text variant="wide" color={c.turf}>Social · Working on it</Text>
                <Text variant="displayMd">Not yet. Here’s the path.</Text>
                <Bars total={4} done={1} />
                <Text variant="caption" muted>Calm around dogs · Step 2 of 4. A private session and a small-group play, then a re-check.</Text>
              </View>
              <Text style={{ marginTop: 24 }}>{`“${FIRST_QUOTE}”`}</Text>
            </>
          )}
          <Text variant="caption" muted style={{ marginTop: 6 }}>Sam Reyes, Eastside Dog Club</Text>

          <Text variant="title" style={{ marginTop: 28, marginBottom: 14 }}>Strengths</Text>
          <View style={{ gap: 12 }}>
            {strengths.map((x) => (
              <View key={x} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name="check" /><Text style={{ flex: 1 }}>{x}</Text></View>
            ))}
          </View>
          <Text variant="title" style={{ marginTop: 28, marginBottom: 14 }}>Working on</Text>
          <View style={{ gap: 12 }}>
            {working.map((x) => (
              <View key={x} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name="trending-up" color={c.turf} /><Text style={{ flex: 1 }}>{x}</Text></View>
            ))}
          </View>
        </View>
      </ScrollView>
      <Footer>
        {cleared ? (
          <Button block onPress={() => router.push(social === 'earned' ? '/clearance-earned' : '/passport/social')}>See Juno’s Passport</Button>
        ) : (
          <Button block onPress={() => router.push('/goal/calm-around-dogs')}>See the path</Button>
        )}
      </Footer>
    </Screen>
  );
}
