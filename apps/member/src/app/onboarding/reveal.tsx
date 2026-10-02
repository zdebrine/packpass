import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { NOW } from '@/data/fixtures';
import { AthleteCard } from '@/ds/cards';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Screen, useBottom, themed } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { comingWithAccounts } from '@/lib/notice';
import { Intro, StepHeader } from '@/features/onboarding/parts';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

/** 01i Step 5 · Athlete Card reveal */
function Reveal() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const d = useApp((s) => s.draft);
  const name = d.dogName.trim() || 'Your dog';
  const yrs = NOW.getFullYear() - d.birthYear - (NOW.getMonth() < d.birthMonth ? 1 : 0);

  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(200, withTiming(1, { duration: 1100, easing: Easing.bezier(...motion.easeOut) }));
  }, [t]);
  const card = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.55, 1], [0, 1, 1]),
    transform: [
      { perspective: 1200 },
      { translateY: interpolate(t.value, [0, 1], [80, 0]) },
      { rotateX: `${interpolate(t.value, [0, 1], [24, 0])}deg` },
      { scale: interpolate(t.value, [0, 1], [0.9, 1]) },
    ],
  }));

  return (
    <Screen theme="dark">
      <StepHeader step={5} showBack={false} />
      <View style={{ paddingTop: 22, paddingHorizontal: 20 }}>
        <Intro eyebrow="Step 5 of 5 · Athlete Card" title={`${name} is on the roster.`} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={card}>
          <AthleteCard
            name={name}
            photo={d.photo ? 'juno' : undefined}
            breed={d.mixed ? 'Mixed breed' : d.breed || undefined}
            age={yrs < 1 ? 'Puppy' : `${yrs} yrs`}
            stage={yrs < 1 ? undefined : yrs < 8 ? 'Prime' : 'Senior'}
            since={NOW.getFullYear()}
            stats={[{ value: 0, label: 'Sessions' }, { value: 0, label: 'Hours active' }, { value: 0, label: 'Disciplines' }]}
          />
        </Animated.View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: bottom, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Icon name="syringe" />
          <Text variant="label" style={{ flex: 1 }}>{`Upload ${name}'s vaccination records before the first booking.`}</Text>
        </View>
        <Button block onPress={() => comingWithAccounts('Upload vaccination records')}>Upload records</Button>
        <Button variant="quiet" block onPress={() => router.push('/onboarding/month')}>{`See ${name}'s month`}</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', Reveal);
