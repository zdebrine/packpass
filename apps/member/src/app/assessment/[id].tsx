import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { FIRST_QUOTE, RECHECK_QUOTE } from '@/data/passport';
import type { LogEntry } from '@/data/types';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Bars, Footer, IconButton, Screen, useTop } from '@/ds/layout';
import { col, Columns, Page, tile, useWide } from '@/ds/responsive';
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

const close = () => (router.canGoBack() ? router.back() : router.replace('/log'));

/** The "New clearance" card: agility, shield badge. Desktop draws it a size up (24 padding, 56 badge). */
function ClearedCard({ title, sub }: { title: string; sub: string }) {
  const { c } = useTheme();
  const wide = useWide();
  return (
    <View style={{ backgroundColor: c.agility, borderRadius: 28, padding: wide ? 24 : 20, flexDirection: 'row', gap: wide ? 16 : 14, alignItems: 'center' }}>
      <View style={{ width: wide ? 56 : 52, height: wide ? 56 : 52, borderRadius: 9999, backgroundColor: 'rgba(14,15,14,0.1)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="shield-check" size={wide ? 28 : 24} color={c.onAgility} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="wide" color={c.onAgility}>New clearance</Text>
        <Text variant="displayMd" color={c.onAgility} style={{ marginTop: 4 }}>{title}</Text>
        <Text variant="caption" color={c.onAgility} style={{ marginTop: 4 }}>{sub}</Text>
      </View>
    </View>
  );
}

/**
 * 11 Assessment result, desktop: the pitch header as a rounded card with the close button, then the
 * result, the assessor's words and the next step beside Strengths and Working on.
 */
function DesktopResult({ date, title, sub, card, quote, by, cta, strengths, working }: {
  date: string; title: string; sub: string; card: ReactNode; quote: string | null; by: string | null; cta: ReactNode; strengths: string[]; working: string[];
}) {
  const { c } = useTheme();
  const list = (heading: string, items: string[], icon: 'check' | 'trending-up') => (items.length ? (
    <View style={tile(240)}>
      <Text variant="title" style={{ marginBottom: 14 }}>{heading}</Text>
      <View style={{ gap: 12 }}>
        {items.map((x) => (
          <View key={x} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={icon} color={icon === 'check' ? undefined : c.turf} /><Text style={{ flex: 1 }}>{x}</Text></View>
        ))}
      </View>
    </View>
  ) : null);
  return (
    <Page>
      <View style={{ backgroundColor: c.pitch, borderRadius: 32, paddingTop: 28, paddingHorizontal: 32, paddingBottom: 36 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="wide" color={c.onPitchMuted}>{`Assessment result · ${date}`}</Text>
          <IconButton icon="x" label="Close" onPress={close} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </View>
        <Text variant="display2xl" color={c.onPitch} style={{ marginTop: 20 }} accessibilityRole="header">{title}</Text>
        <Text variant="label" color={c.onPitchMuted} style={{ marginTop: 10 }}>{sub}</Text>
      </View>
      <Columns gap={48} style={{ marginTop: 32 }}>
        <View style={col(1, 420)}>
          {card}
          {quote ? <Text style={{ marginTop: 24, fontSize: 18, lineHeight: 27 }}>{`“${quote}”`}</Text> : null}
          {by ? <Text variant="caption" muted style={{ marginTop: 8 }}>{by}</Text> : null}
          <View style={{ flexDirection: 'row', marginTop: 24 }}>{cta}</View>
        </View>
        <View style={[col(1, 320), { flexDirection: 'row', flexWrap: 'wrap', gap: 32 }]}>
          {list('Strengths', strengths, 'check')}
          {list('Working on', working, 'trending-up')}
        </View>
      </Columns>
    </Page>
  );
}

function RecordedResult({ e }: { e: LogEntry }) {
  const { c } = useTheme();
  const top = useTop();
  const dog = useDog();
  const a = e.assessment!;
  const type = a.type === 'social' ? 'Social' : 'Herding';
  const cleared = a.outcome === 'cleared';
  const wide = useWide();
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

  const card = cleared ? (
    <ClearedCard
      title={`${type} cleared`}
      sub={a.type === 'herding' ? `Assessed at ${e.partner}. Herding stays with this partner.` : `${e.partner}. Counts at every PackPass partner.`}
    />
  ) : (
    <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: wide ? 24 : 20, gap: wide ? 12 : 8 }}>
      <Text variant="wide" color={c.turf}>{`${type} · Working on it`}</Text>
      <Text variant="displayMd">{a.type === 'social' ? "Not yet. Here's the path." : 'Not yet.'}</Text>
      <Text variant="caption" muted>{a.type === 'social' ? `Calm around dogs gets ${dog.name} ready for a re-check.` : `Book another Herding assessment at ${e.partner} when ${dog.name} is ready.`}</Text>
    </View>
  );
  const cta = (block: boolean) => (cleared ? (
    <Button block={block} onPress={() => router.push(`/passport/${a.type}`)}>{`See ${dog.name}'s Passport`}</Button>
  ) : a.type === 'social' ? (
    <Button block={block} onPress={() => router.push('/goal/calm-around-dogs')}>See the path</Button>
  ) : (
    <Button block={block} onPress={close}>Back to Log</Button>
  ));

  if (wide) {
    return (
      <DesktopResult
        date={monthDay(e.startsAt)}
        title={`${type} assessment.`}
        sub={[e.partner, a.assessor, e.title].join(' · ')}
        card={card}
        quote={a.quote}
        by={a.quote ? `${a.assessor}, ${e.partner}` : null}
        cta={cta(false)}
        strengths={a.strengths}
        working={a.workingOn}
      />
    );
  }

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
          {card}
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
      <Footer>{cta(true)}</Footer>
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
  const wide = useWide();
  const notYetCard = (
    <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: wide ? 24 : 20, gap: 12 }}>
      <Text variant="wide" color={c.turf}>Social · Working on it</Text>
      <Text variant="displayMd">Not yet. Here’s the path.</Text>
      <Bars total={4} done={1} />
      <Text variant="caption" muted>Calm around dogs · Step 2 of 4. A private session and a small-group play, then a re-check.</Text>
    </View>
  );
  const clearedCard = <ClearedCard title="Social cleared" sub="Eastside Dog Club · Sep 2026 · Expires Sep 2027" />;
  const cta = (block: boolean) => (cleared ? (
    <Button block={block} onPress={() => router.push(social === 'earned' ? '/clearance-earned' : '/passport/social')}>See Juno’s Passport</Button>
  ) : (
    <Button block={block} onPress={() => router.push('/goal/calm-around-dogs')}>See the path</Button>
  ));

  if (wide) {
    return (
      <DesktopResult
        date={cleared ? 'Sep 29' : 'Sep 12'}
        title={cleared ? 'Social re-check.' : 'Social assessment.'}
        sub="Eastside Dog Club · Sam Reyes · Small-group play"
        card={cleared ? clearedCard : notYetCard}
        quote={cleared ? RECHECK_QUOTE : FIRST_QUOTE}
        by="Sam Reyes, Eastside Dog Club"
        cta={cta(false)}
        strengths={strengths}
        working={working}
      />
    );
  }

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ backgroundColor: c.pitch, paddingTop: top + 10, paddingHorizontal: 20, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="wide" color={c.onPitchMuted}>{`Assessment result · ${cleared ? 'Sep 29' : 'Sep 12'}`}</Text>
            <IconButton icon="x" label="Close" onPress={close} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>
          <Text variant="displayXl" color={c.onPitch} style={{ marginTop: 18 }} accessibilityRole="header">{cleared ? 'Social re-check.' : 'Social assessment.'}</Text>
          <Text variant="label" color={c.onPitchMuted} style={{ marginTop: 8 }}>Eastside Dog Club · Sam Reyes · Small-group play</Text>
        </View>

        <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 32 }}>
          {cleared ? (
            <>
              {clearedCard}
              <Text style={{ marginTop: 24 }}>{`“${RECHECK_QUOTE}”`}</Text>
            </>
          ) : (
            <>
              {notYetCard}
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
      <Footer>{cta(true)}</Footer>
    </Screen>
  );
}
