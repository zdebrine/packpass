import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { isComplete, PATH_TRAINERS, stepIndex, type StepState } from '@/data/passport';
import { Button, Chip } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Badge, Bars, IconButton, Screen } from '@/ds/layout';
import { col, Columns, Page, useWide } from '@/ds/responsive';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { activeBookings, credits as creditsLabel, nextSession } from '@/lib/booking';
import { useGoalTrainers, useGoals } from '@/lib/paths';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** 10 Goal detail · training path */
export default function GoalDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const behaviorNote = useApp((s) => s.behaviorNote);
  const bookings = useApp((s) => s.bookings);
  const startPath = useApp((s) => s.startPath);
  const dog = useDog();
  const [who, setWho] = useState<'Behaviorist' | 'Trainer'>('Behaviorist');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wide = useWide();
  const { goals, available } = useGoals();
  const all = [...goals, ...available];
  const g = all.find((x) => x.id === id) ?? all[0];
  const liveTrainers = useGoalTrainers(g);
  if (!g) return <Screen><View style={{ padding: 20 }}><Text muted>That path isn’t available.</Text></View></Screen>;
  const start = async () => {
    setStarting(true); setError(null);
    try { await startPath(dog.id, g.id); } catch (e) { setError(errorCopy(e)); } finally { setStarting(false); }
  };
  const notStarted = g.started === false;
  const i = notStarted ? 0 : stepIndex(g);
  const done = isComplete(g);

  const dot: Record<StepState, { bg: string; fg: string; icon: IconName; line: string; color: string }> = {
    done: { bg: c.turf, fg: c.onTurf, icon: 'check', line: c.turf, color: c.turf },
    next: { bg: c.inverse, fg: c.onInverse, icon: 'arrow-right', line: c.surfaceSunken, color: c.ink },
    locked: { bg: c.surfaceRaised, fg: c.inkFaint, icon: 'lock', line: c.surfaceSunken, color: c.inkMuted },
    final: { bg: c.surfaceRaised, fg: c.inkFaint, icon: 'shield', line: 'transparent', color: c.inkMuted },
  };
  const showBehaviorist = behaviorNote && g.id === 'calm-around-dogs';
  const trainers = liveTrainers ?? (showBehaviorist && who === 'Behaviorist' ? PATH_TRAINERS.behaviorist : PATH_TRAINERS[g.trainers]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/dog'));
  const share = () => Share.share({ message: `${dog.name}'s training path on PackPass: ${g.title}.` }).catch(() => {});
  const stepRows = g.steps.map((s, n) => {
    const d = dot[s.state];
    const isLast = n === g.steps.length - 1;
    const next = s.classId ? nextSession(s.classId) : undefined;
    const booked = !!s.classId && activeBookings(bookings.filter((b) => b.dogId === dog.id)).some((x) => x.booking.status === 'booked' && x.v.cls.id === s.classId);
    return (
      <View key={s.title} style={{ flexDirection: 'row', gap: wide ? 16 : 14 }}>
        <View style={{ alignItems: 'center', width: wide ? 40 : 36 }}>
          <Badge icon={d.icon} bg={d.bg} fg={d.fg} size={wide ? 40 : 36} iconSize={wide ? 18 : 16} />
          <View style={{ flex: 1, width: 2, minHeight: 14, borderRadius: 2, backgroundColor: isLast ? 'transparent' : d.line }} />
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingTop: wide ? 8 : 6, paddingBottom: wide ? 26 : 22 }}>
          <Text variant="heading" weight={wide ? '600' : undefined}>{s.title}</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>{s.meta}</Text>
          <Text variant="caption" weight="600" color={d.color} style={{ marginTop: 4 }}>{booked ? 'Booked' : s.stateLabel}</Text>
          {s.state === 'next' && next && !booked ? (
            <View style={{ marginTop: 12, flexDirection: 'row' }}>
              <Button variant="signal" size="sm" onPress={() => router.push(`/book/${next.session.id}`)}>{`Book step ${n + 1} · ${creditsLabel(next.cls.credits)}`}</Button>
            </View>
          ) : null}
        </View>
      </View>
    );
  });
  const trainerRows = trainers.map((t) => (
    <View key={t.name} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: wide ? 14 : 12, paddingLeft: wide ? 14 : 12, paddingRight: wide ? 16 : 14, borderRadius: wide ? 24 : 20, backgroundColor: c.surfaceRaised }}>
      <Photo name={t.photo} style={{ width: wide ? 56 : 52, height: wide ? 56 : 52, borderRadius: 9999 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" weight="600">{t.name}</Text>
        <Text variant="caption" muted>{t.meta}</Text>
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {t.tags.map((x) => (
            <View key={x} style={{ height: 22, paddingHorizontal: 9, borderRadius: 9999, backgroundColor: c.bg, justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, lineHeight: 14 }} weight="500">{x}</Text>
            </View>
          ))}
        </View>
      </View>
      {t.classId && nextSession(t.classId) ? (
        <Button size="sm" onPress={() => router.push(`/class/${nextSession(t.classId!)!.session.id}`)}>Book</Button>
      ) : (
        <Button size="sm" variant="quiet" fill={c.bg} onPress={() => router.push('/book')}>Find</Button>
      )}
    </View>
  ));
  const startBlock = notStarted ? (
    <View style={{ marginTop: 16, gap: 8 }}>
      <Button block disabled={starting} onPress={start}>{starting ? 'Starting…' : `Start this path with ${dog.name}`}</Button>
      {error ? <Text variant="caption" color={c.kennelRed}>{error}</Text> : <Text variant="caption" muted>{`Step 1 opens right away. Each step finishes when ${dog.name} checks in to that class.`}</Text>}
    </View>
  ) : null;
  const behaviorCard = (
    <View style={{ padding: 18, borderRadius: 12, backgroundColor: c.surfaceRaised, flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
      <Icon name="stethoscope" />
      <Text variant="label" style={{ flex: 1 }}>Some of this can need more than a trainer. {`A certified behaviorist works with ${dog.name}'s vet on a plan, and can join the path at any step.`}</Text>
    </View>
  );
  const whoChips = showBehaviorist ? (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
      <Chip selected={who === 'Behaviorist'} onPress={() => setWho('Behaviorist')}>Behaviorist</Chip>
      <Chip selected={who === 'Trainer'} onPress={() => setWho('Trainer')}>Trainer</Chip>
    </View>
  ) : null;
  const noTrainers = trainers.length ? null : <Text variant="label" muted>No trainers list this specialty yet. Classes on the path are above.</Text>;

  if (wide) {
    return (
      <Page>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Press onPress={back} accessibilityRole="button" accessibilityLabel={`Back to ${dog.name}`} style={{ height: 40, paddingLeft: 10, paddingRight: 16, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="chevron-left" size={18} />
            <Text variant="label" weight="600">{dog.name}</Text>
          </Press>
          <IconButton icon="share" label="Share" onPress={share} />
        </View>
        <View style={{ maxWidth: 720, marginTop: 24 }}>
          <Text variant="wide" muted>Training path · From you</Text>
          <Text variant="hero" style={{ marginTop: 10 }} accessibilityRole="header">{`${g.title}.`}</Text>
          <Text style={{ marginTop: 12 }}>{g.lede}</Text>
          <Bars total={g.steps.length} done={done ? g.steps.length : i} style={{ marginTop: 20 }} />
          <Text variant="caption" muted style={{ marginTop: 8 }}>{done || notStarted ? g.updated : `Step ${i + 1} of ${g.steps.length} · ${g.updated}`}</Text>
          {startBlock}
        </View>
        <Columns gap={48} style={{ marginTop: 36 }}>
          <View style={col(1, 380)}>
            {stepRows}
            {showBehaviorist ? behaviorCard : null}
          </View>
          <View style={col(1, 380)}>
            <Text variant="title" style={{ marginBottom: 14 }}>Trainers for this</Text>
            {whoChips}
            <View style={{ gap: 8 }}>
              {noTrainers}
              {trainerRows}
            </View>
          </View>
        </Columns>
      </Page>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <IconButton icon="chevron-left" label="Back" onPress={back} />
          <IconButton icon="share" label="Share" onPress={share} />
        </View>
        <View style={{ paddingTop: 20, paddingHorizontal: 20 }}>
          <Text variant="wide" muted>Training path · From you</Text>
          <Text variant="displayXl" style={{ marginTop: 10 }} accessibilityRole="header">{`${g.title}.`}</Text>
          <Text style={{ marginTop: 10 }}>{g.lede}</Text>
          <Bars total={g.steps.length} done={done ? g.steps.length : i} style={{ marginTop: 18 }} />
          <Text variant="caption" muted style={{ marginTop: 8 }}>{done || notStarted ? g.updated : `Step ${i + 1} of ${g.steps.length} · ${g.updated}`}</Text>
          {startBlock}
        </View>

        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          {stepRows}
        </View>

        {showBehaviorist ? (
          <View style={{ marginTop: 12, paddingHorizontal: 20 }}>
            {behaviorCard}
          </View>
        ) : null}

        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <Text variant="title" style={{ marginBottom: 14 }}>Trainers for this</Text>
          {whoChips}
          <View style={{ gap: 8 }}>
            {noTrainers}
            {trainerRows}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
