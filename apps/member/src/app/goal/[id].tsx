import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { goals, isComplete, PATH_TRAINERS, stepIndex, type StepState } from '@/data/passport';
import { Button, Chip } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Badge, Bars, IconButton, Screen } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { activeBookings, credits as creditsLabel, nextSession } from '@/lib/booking';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** 10 Goal detail · training path */
export default function GoalDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const social = useApp((s) => s.social);
  const behaviorNote = useApp((s) => s.behaviorNote);
  const bookings = useApp((s) => s.bookings);
  const [who, setWho] = useState<'Behaviorist' | 'Trainer'>('Behaviorist');
  const g = goals(social).find((x) => x.id === id) ?? goals(social)[0];
  const i = stepIndex(g);
  const done = isComplete(g);

  const dot: Record<StepState, { bg: string; fg: string; icon: IconName; line: string; color: string }> = {
    done: { bg: c.turf, fg: c.onTurf, icon: 'check', line: c.turf, color: c.turf },
    next: { bg: c.inverse, fg: c.onInverse, icon: 'arrow-right', line: c.surfaceSunken, color: c.ink },
    locked: { bg: c.surfaceRaised, fg: c.inkFaint, icon: 'lock', line: c.surfaceSunken, color: c.inkMuted },
    final: { bg: c.surfaceRaised, fg: c.inkFaint, icon: 'shield', line: 'transparent', color: c.inkMuted },
  };
  const showBehaviorist = behaviorNote && g.id === 'calm-around-dogs';
  const trainers = showBehaviorist && who === 'Behaviorist' ? PATH_TRAINERS.behaviorist : PATH_TRAINERS[g.trainers];

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dog'))} />
          <IconButton icon="share" label="Share" onPress={() => Share.share({ message: `Juno's training path on PackPass: ${g.title}.` }).catch(() => {})} />
        </View>
        <View style={{ paddingTop: 20, paddingHorizontal: 20 }}>
          <Text variant="wide" muted>Training path · From you</Text>
          <Text variant="displayXl" style={{ marginTop: 10 }} accessibilityRole="header">{`${g.title}.`}</Text>
          <Text style={{ marginTop: 10 }}>{g.lede}</Text>
          <Bars total={g.steps.length} done={done ? g.steps.length : i} style={{ marginTop: 18 }} />
          <Text variant="caption" muted style={{ marginTop: 8 }}>{done ? g.updated : `Step ${i + 1} of ${g.steps.length} · ${g.updated}`}</Text>
        </View>

        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          {g.steps.map((s, n) => {
            const d = dot[s.state];
            const isLast = n === g.steps.length - 1;
            const next = s.classId ? nextSession(s.classId) : undefined;
            const booked = !!s.classId && activeBookings(bookings).some((x) => x.booking.status === 'booked' && x.v.cls.id === s.classId);
            return (
              <View key={s.title} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center', width: 36 }}>
                  <Badge icon={d.icon} bg={d.bg} fg={d.fg} size={36} iconSize={16} />
                  <View style={{ flex: 1, width: 2, minHeight: 14, borderRadius: 2, backgroundColor: isLast ? 'transparent' : d.line }} />
                </View>
                <View style={{ flex: 1, paddingTop: 6, paddingBottom: 22 }}>
                  <Text variant="heading">{s.title}</Text>
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
          })}
        </View>

        {showBehaviorist ? (
          <View style={{ marginTop: 12, paddingHorizontal: 20 }}>
            <View style={{ padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised, flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <Icon name="stethoscope" />
              <Text variant="label" style={{ flex: 1 }}>Some of this can need more than a trainer. A certified behaviorist works with Juno's vet on a plan, and can join the path at any step.</Text>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <Text variant="title" style={{ marginBottom: 14 }}>Trainers for this</Text>
          {showBehaviorist ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <Chip selected={who === 'Behaviorist'} onPress={() => setWho('Behaviorist')}>Behaviorist</Chip>
              <Chip selected={who === 'Trainer'} onPress={() => setWho('Trainer')}>Trainer</Chip>
            </View>
          ) : null}
          <View style={{ gap: 8 }}>
            {trainers.map((t) => (
              <View key={t.name} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12, paddingLeft: 12, paddingRight: 14, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
                <Photo name={t.photo} style={{ width: 52, height: 52, borderRadius: 9999 }} />
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
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
