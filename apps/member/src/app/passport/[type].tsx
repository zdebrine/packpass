import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';

import { dogs } from '@/data/fixtures';
import { HERDING, socialClearance, STATUS_LABEL } from '@/data/passport';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Badge, Grabber, useBottom, useTop } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useClearanceStyle } from '@/features/passport/style';
import { comingWithAccounts } from '@/lib/notice';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

const juno = dogs.juno;
const close = () => (router.canGoBack() ? router.back() : router.replace('/dog'));

/** 09 Clearance detail (sheet over the Passport) */
export default function ClearanceDetail() {
  const { c } = useTheme();
  const top = useTop();
  const bottom = useBottom(34);
  const { type } = useLocalSearchParams<{ type: string }>();
  const social = useApp((s) => s.social);
  const expired = useApp((s) => s.socialExpired);
  const k = type === 'herding' ? HERDING : socialClearance(social, expired);
  const st = useClearanceStyle()(k);
  const facts: [string, string, string][] = [['Status', STATUS_LABEL[k.status], st.color], ...k.facts.map(([a, b]) => [a, b, c.ink] as [string, string, string])];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Photo name="juno" style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 460 }} />
      <Animated.View entering={FadeIn.duration(motion.base)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(motion.base).easing(Easing.bezier(...motion.easeOut))}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: top + 42, backgroundColor: c.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
        accessibilityViewIsModal
      >
        <View style={{ paddingTop: 10 }}><Grabber /></View>
        <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: bottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Badge icon={st.icon} bg={st.bg} fg={st.fg} size={52} iconSize={24} />
            <View style={{ flex: 1 }}>
              <Text variant="wide" muted>{k.eyebrow}</Text>
              <Text variant="displayLg" style={{ marginTop: 4 }}>{k.name}</Text>
            </View>
          </View>

          {k.status === 'expired' ? (
            <View style={{ marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: c.kennelRedSoft, gap: 12 }}>
              <Text variant="label" weight="600" color={c.kennelRed}>Social clearance expired. Book a quick re-check to keep group classes open.</Text>
              <Button block onPress={() => comingWithAccounts('Book a re-check')}>Book a re-check · 1 credit</Button>
            </View>
          ) : null}
          {k.status === 'working' && social === 'earned' ? (
            <View style={{ marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: c.turfSoft, gap: 12 }}>
              <Text variant="label"><Text variant="label" weight="600" color={c.turf}>{`${juno.name} passed the re-check.`}</Text>{' Open the result to add Social to the Passport.'}</Text>
              <Button block onPress={() => router.replace('/clearance-earned')}>See what's unlocked</Button>
            </View>
          ) : k.status === 'working' ? (
            <View style={{ marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: c.turfSoft, gap: 12 }}>
              <Text variant="label"><Text variant="label" weight="600" color={c.turf}>{`${juno.name} is working on this.`}</Text>{' Finish Calm around dogs to earn a Social clearance.'}</Text>
              <Button block onPress={() => router.replace('/goal/calm-around-dogs')}>See the path</Button>
            </View>
          ) : null}
          {k.status === 'needs' ? (
            <View style={{ marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised, gap: 12 }}>
              <Text variant="label">{k.note}</Text>
              <Button block onPress={() => router.replace('/book/herding-assessment.0.1845')}>Book assessment</Button>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
            {facts.map(([a, b, color]) => (
              <View key={a} style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: c.surfaceRaised, borderRadius: 20, padding: 14 }}>
                <Text variant="caption" muted>{a}</Text>
                <Text variant="label" weight="600" color={color} style={{ marginTop: 4 }}>{b}</Text>
              </View>
            ))}
          </View>

          <Text variant="title" style={{ marginTop: 28, marginBottom: 12 }}>What this unlocks</Text>
          <View style={{ gap: 14 }}>
            {k.unlocks.map((u) => (
              <View key={u.label} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <Badge icon={u.icon} bg={c.surfaceRaised} fg={c.ink} iconSize={18} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" weight="600">{u.label}</Text>
                  <Text variant="caption" muted>{u.ex}</Text>
                </View>
              </View>
            ))}
          </View>

          {k.strengths ? (
            <>
              <Text variant="title" style={{ marginTop: 28, marginBottom: 4 }}>Assessor notes</Text>
              <Text variant="caption" muted style={{ marginBottom: 14 }}>{k.assessor}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: c.surfaceRaised, borderRadius: 20, padding: 14, gap: 8 }}>
                  <Text variant="caption" weight="600">Strengths</Text>
                  {k.strengths.map((x) => (
                    <View key={x} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                      <Icon name="check" size={14} />
                      <Text variant="caption" style={{ flex: 1 }}>{x}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1, backgroundColor: c.surfaceRaised, borderRadius: 20, padding: 14, gap: 8 }}>
                  <Text variant="caption" weight="600" color={c.turf}>Working on</Text>
                  {k.working?.map((x) => (
                    <View key={x} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                      <Icon name="trending-up" size={14} color={c.turf} />
                      <Text variant="caption" style={{ flex: 1 }}>{x}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
