import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { disciplineLevels, dogs, TRAIT_SPECIAL } from '@/data/fixtures';
import { goals, HERDING, isComplete, socialClearance, STATUS_LABEL, stepIndex, type Clearance } from '@/data/passport';
import { AthleteCard } from '@/ds/cards';
import { Button, Chip, Tag } from '@/ds/controls';
import { Badge, Bars, IconButton, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { notice } from '@/lib/notice';
import { useApp } from '@/store/app';
import { useClearanceStyle } from '@/features/passport/style';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

const juno = dogs.juno;

function FlipCard() {
  const { c } = useTheme();
  const [flipped, setFlipped] = useState(false);
  const deg = useDerivedValue(() => withTiming(flipped ? 180 : 0, { duration: motion.slow, easing: Easing.bezier(...motion.easeOut) }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1400 }, { rotateY: `${deg.value}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1400 }, { rotateY: `${deg.value + 180}deg` }] }));
  const face = { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' as const };

  return (
    <Press
      onPress={() => setFlipped((f) => !f)}
      scale={false}
      accessibilityLabel={flipped ? `${juno.name}'s discipline levels. Tap to flip back.` : `${juno.name}'s Athlete Card. Tap to see discipline levels.`}
      style={{ width: 320, height: 460, alignSelf: 'center' }}
    >
      <Animated.View style={[face, front]}>
        <AthleteCard
          name={juno.name}
          photo={juno.photo}
          breed={juno.breed}
          age={juno.age}
          stage={juno.stage}
          since={juno.since}
          streak={9}
          stats={[{ value: 42, label: 'Sessions' }, { value: 38, label: 'Hours active' }, { value: 5, label: 'Disciplines' }]}
        />
      </Animated.View>
      <Animated.View style={[face, back, { borderRadius: 28, backgroundColor: c.pitch, paddingVertical: 28, paddingHorizontal: 24, boxShadow: c.shadowCard }]}>
        <Text variant="wide" color={c.onPitchMuted}>{`${juno.name} · Discipline levels`}</Text>
        <Text variant="displayXl" color={c.onPitch} style={{ marginTop: 10 }}>Five disciplines.</Text>
        <View style={{ gap: 20, marginTop: 30 }}>
          {disciplineLevels.map((l) => (
            <View key={l.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label" color={c.onPitch}>{l.name}</Text>
                <Text variant="label" num color={c.onPitchMuted}>{`Level ${l.level}`}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 8 }}>
                <View style={{ width: `${l.pct * 100}%`, height: '100%', borderRadius: 9999, backgroundColor: '#7fb592' }} />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    </Press>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Text variant="title">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** 08 Dog profile · Passport */
export default function DogProfile() {
  const { c } = useTheme();
  const social = useApp((s) => s.social);
  const expired = useApp((s) => s.socialExpired);
  const traits = useApp((s) => s.draft.traits).filter((t) => !TRAIT_SPECIAL.includes(t));
  const styleFor = useClearanceStyle();
  const clearances = [socialClearance(social, expired), HERDING];

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {Object.values(dogs).map((d) => (
              <Chip
                key={d.id}
                selected={d.id === juno.id}
                leading={<Photo name={d.photo} style={{ width: 28, height: 28, borderRadius: 9999 }} />}
                onPress={d.id === juno.id ? undefined : () => notice(`${d.name} has no Passport yet`, `Book ${d.name} into a class to start one.`)}
              >
                {d.name}
              </Chip>
            ))}
          </View>
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        <FlipCard />

        <View style={{ marginTop: 32 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, marginBottom: 6 }}>
            <Text variant="title">Passport</Text>
            <Text variant="caption" muted>Verified by partners</Text>
          </View>
          <Text variant="caption" muted style={{ marginHorizontal: 20, marginBottom: 14 }}>{`Clearances travel with ${juno.name} to every PackPass partner. Tap one for details.`}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {clearances.map((k) => {
              const st = styleFor(k);
              return (
                <Press key={k.type} onPress={() => router.push(`/passport/${k.type}`)} accessibilityLabel={`${k.name}: ${STATUS_LABEL[k.status]}`} style={{ width: 148, padding: 16, borderRadius: 24, backgroundColor: c.surfaceRaised }}>
                  <Badge icon={st.icon} bg={st.bg} fg={st.fg} size={36} iconSize={18} />
                  <Text variant="label" weight="600" style={{ marginTop: 18 }}>{k.name}</Text>
                  <Text variant="caption" weight="600" color={st.color}>{STATUS_LABEL[k.status]}</Text>
                  <Text variant="caption" muted style={{ marginTop: 2 }}>{k.sub}</Text>
                </Press>
              );
            })}
          </ScrollView>
        </View>

        <Section title="Next goals">
          <View style={{ gap: 8 }}>
            {goals(social).map((g) => {
              const i = stepIndex(g);
              const done = isComplete(g);
              const next = g.steps[i];
              return (
                <Press key={g.id} onPress={() => router.push(`/goal/${g.id}`)} style={{ paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <Text variant="heading" style={{ flex: 1 }}>{g.title}</Text>
                    <Text variant="caption" muted>{done ? 'Complete' : `Step ${i + 1} of ${g.steps.length}`}</Text>
                  </View>
                  <Bars total={g.steps.length} done={done ? g.steps.length : i} />
                  <Text variant="caption" muted>
                    {done ? 'Done. Social cleared.' : g.id === 'calm-around-dogs' ? `Next: ${next.title} · private session · Earns Social` : `Next: ${next.title} with Ana Ruiz`}
                  </Text>
                </Press>
              );
            })}
          </View>
        </Section>

        <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text variant="title">Traits</Text>
            <Button variant="quiet" size="sm" onPress={() => router.push('/onboarding/traits?edit=1')}>Edit</Button>
          </View>
          <Text variant="caption" muted style={{ marginBottom: 12 }}>From you. Used to suggest classes and trainers, never to grant access.</Text>
          <View style={{ gap: 8 }}>
            {traits.map((t) => (
              <View key={t} style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <Text variant="label" style={{ flex: 1 }}>{t}</Text>
                <Text variant="caption" muted>From you</Text>
              </View>
            ))}
            {traits.length === 0 ? <Text variant="label" muted>No traits added.</Text> : null}
          </View>
        </View>

        <Section title="Health and care">
          <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 16 }}>
            {[['Rabies', 'Expires Mar 2028', false], ['DHPP', 'Expires Jan 2027', false], ['Bordetella', 'Expires Oct 14', true]].map(([n, e, due]) => (
              <View key={n as string} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text variant="label" weight="600">{n as string}</Text>
                  <Text variant="caption" muted>{e as string}</Text>
                </View>
                <Tag tone={due ? 'warning' : 'neutral'}>{due ? 'Due soon' : 'Current'}</Tag>
              </View>
            ))}
          </View>
          <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 14, marginTop: 8 }}>
            {[['Allergies', 'Chicken'], ['Medication', 'None'], ['Triggers', 'Nervous around men in hats']].map(([k, v]) => (
              <View key={k}>
                <Text variant="caption" muted>{k}</Text>
                <Text variant="label" weight="600">{v}</Text>
              </View>
            ))}
          </View>
          <Text variant="caption" muted style={{ marginTop: 10, marginHorizontal: 4 }}>Vet: Cedar Animal Clinic · (555) 014-2290</Text>
        </Section>

        <Section title="Life stage">
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[['Puppy', true, false], ['Prime · now', true, true], ['Senior', false, false]].map(([l, on, now]) => (
              <View key={l as string} style={{ flex: 1 }}>
                <View style={{ height: 6, borderRadius: 9999, backgroundColor: on ? c.ink : c.surfaceSunken }} />
                <Text variant="caption" muted={!now} weight={now ? '600' : undefined} style={{ marginTop: 8 }}>{l as string}</Text>
              </View>
            ))}
          </View>
          <Text variant="label" muted style={{ marginTop: 12 }}>Senior starts around age 8. Programming shifts to swim, scent work and slow walks.</Text>
        </Section>

        <View style={{ marginTop: 32, paddingHorizontal: 20, gap: 10 }}>
          <Button block onPress={() => Share.share({ message: `${juno.name}'s PackPass Passport: clearances, vaccines and care notes.` }).catch(() => {})}>Share Passport with a partner</Button>
          <Text variant="caption" muted center>Partners see clearances, vaccines and care notes.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
