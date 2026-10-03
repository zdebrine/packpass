import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { TRAIT_SPECIAL } from '@/data/fixtures';
import { isComplete, STATUS_LABEL, stepIndex, type Clearance } from '@/data/passport';
import { useClearances } from '@/lib/clearances';
import { useGoals } from '@/lib/paths';
import { useDogStats } from '@/lib/stats';
import { isLive } from '@/api/client';
import { AthleteCard } from '@/ds/cards';
import { Button, Chip, Tag } from '@/ds/controls';
import { Badge, Bars, IconButton, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { dayOffset, expiryLabel, fromIso } from '@/lib/dates';
import { notice } from '@/lib/notice';
import { pickDogPhoto } from '@/lib/photos';
import { useApp, useDog } from '@/store/app';
import { useClearanceStyle } from '@/features/passport/style';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';


function FlipCard() {
  const juno = useDog();
  const stats = useDogStats();
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
          streak={stats.streak >= 2 ? stats.streak : undefined}
          stats={[{ value: stats.sessions, label: 'Sessions' }, { value: stats.hours, label: 'Hours active' }, { value: stats.disciplines, label: 'Disciplines' }]}
        />
      </Animated.View>
      <Animated.View style={[face, back, { borderRadius: 28, backgroundColor: c.pitch, paddingVertical: 28, paddingHorizontal: 24, boxShadow: c.shadowCard }]}>
        <Text variant="wide" color={c.onPitchMuted}>{`${juno.name} · Discipline levels`}</Text>
        <Text variant="displayXl" color={c.onPitch} style={{ marginTop: 10 }}>{stats.levelsTitle}</Text>
        <View style={{ gap: 20, marginTop: 30 }}>
          {stats.levels.map((l) => (
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

/** Not in the designs: a quiet link under the Athlete Card to add or replace the dog's photo. */
function ChangePhoto() {
  const { c } = useTheme();
  const dog = useDog();
  const setDogPhoto = useApp((s) => s.setDogPhoto);
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const change = async () => {
    const uri = await pickDogPhoto().catch(() => null);
    if (!uri) return;
    setState('saving');
    try {
      await setDogPhoto(dog.id, uri);
      setState('idle');
    } catch {
      setState('failed');
    }
  };
  return (
    <Press onPress={change} disabled={state === 'saving'} scale={false} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 14, paddingVertical: 4 }}>
      <Text variant="label" weight="600" color={state === 'failed' ? c.kennelRed : undefined} style={{ textDecorationLine: state === 'saving' ? 'none' : 'underline' }} accessibilityLiveRegion="polite">
        {state === 'saving' ? 'Uploading photo…' : state === 'failed' ? "Couldn't upload. Try again" : dog.photo ? 'Change photo' : `Add a photo of ${dog.name}`}
      </Text>
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
  const juno = useDog();
  const { c } = useTheme();
  const social = useApp((s) => s.social);
  const draftTraits = useApp((s) => s.draft.traits);
  const traits = (juno.traits ?? draftTraits).filter((t) => !TRAIT_SPECIAL.includes(t));
  const styleFor = useClearanceStyle();
  const dogs = useApp((s) => s.dogs);
  const vaccines = useApp((s) => s.vaccines);
  const passport = useClearances();
  const paths = useGoals();
  const clearances = [passport.social, passport.herding];

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {dogs.map((d) => (
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
        <ChangePhoto />

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
            {paths.goals.length ? null : <Text variant="label" muted>{`No path started yet. Pick one below and ${juno.name} works through it a class at a time.`}</Text>}
            {paths.goals.map((g) => {
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
                    {isLive
                      ? done ? g.steps[g.steps.length - 1].stateLabel : `Next: ${next.title} · ${next.meta}`
                      : done ? 'Done. Social cleared.' : g.id === 'calm-around-dogs' ? `Next: ${next.title} · private session · Earns Social` : `Next: ${next.title} with Ana Ruiz`}
                  </Text>
                </Press>
              );
            })}
            {paths.available.map((g) => (
              <Press key={g.id} onPress={() => router.push(`/goal/${g.id}`)} style={{ paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: c.surfaceSunken, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <Text variant="heading" style={{ flex: 1 }}>{g.title}</Text>
                  <Text variant="caption" muted>{`${g.steps.length} steps`}</Text>
                </View>
                <Text variant="caption" muted>{g.lede}</Text>
              </Press>
            ))}
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

        <Section title="Health and care" right={<Button variant="quiet" size="sm" onPress={() => router.push('/vaccines')}>Update</Button>}>
          <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 16 }}>
            {(['Rabies', 'DHPP', 'Bordetella'] as const).map((type) => {
              const rec = vaccines.find((v) => v.type === type);
              const exp = rec ? fromIso(rec.expires) : null;
              const days = exp ? dayOffset(exp) : -1;
              const status = !exp ? 'Not on file' : days < 0 ? 'Expired' : days <= 30 ? 'Due soon' : 'Current';
              return (
                <View key={type} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text variant="label" weight="600">{type}</Text>
                    <Text variant="caption" muted>{exp ? `${days < 0 ? 'Expired' : 'Expires'} ${expiryLabel(exp)}` : 'Add the date from the vet record'}</Text>
                  </View>
                  <Tag tone={status === 'Current' ? 'neutral' : 'warning'}>{status}</Tag>
                </View>
              );
            })}
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
