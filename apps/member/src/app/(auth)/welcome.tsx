import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { HERO_HEADLINE, HERO_LEAD, HERO_SLIDES } from '@/data/fixtures';
import type { PhotoKey } from '@/data/types';
import { Button, Tag } from '@/ds/controls';
import { useBottom, useTop, Screen, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { motion } from '@/theme/tokens';

const ease = Easing.bezier(...motion.easeOut);
const PHOTO_MS = 3400;

function CrossfadePhoto({ name, active }: { name: PhotoKey; active: boolean }) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(active ? 1 : 0, { duration: 1100, easing: ease }),
    transform: [{ scale: withTiming(active ? 1 : 1.03, { duration: PHOTO_MS, easing: Easing.out(Easing.quad) }) }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <PhotoFill name={name} />
    </Animated.View>
  );
}

/** The rotating line eases up into place each time it changes. */
function RiseIn({ children }: { children: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 800, easing: ease });
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 12 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** 01a Welcome. "The dog you can take" + a line that changes with each cross-fading photo. */
function Welcome() {
  const [i, setI] = useState(0);
  const top = useTop();
  const bottom = useBottom(34);

  // Cycle only while Welcome is on screen; it stays mounted (hidden) under Sign in and Sign up.
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(() => setI((n) => (n + 1) % HERO_SLIDES.length), PHOTO_MS);
      return () => clearInterval(t);
    }, []),
  );

  return (
    <Screen theme="dark" bleed statusLight>
      {HERO_SLIDES.map((s, k) => (
        <CrossfadePhoto key={s.photo} name={s.photo} active={k === i} />
      ))}
      <Gradient stops={[['rgba(0,0,0,0.42)', 0], ['rgba(0,0,0,0)', 0.2], ['rgba(0,0,0,0.28)', 0.42], ['rgba(0,0,0,0.85)', 1]]} />

      <View style={{ position: 'absolute', top: top + 14, left: 0, right: 0, alignItems: 'center' }}>
        <Text variant="wide" weight="700" color="#fff" style={{ fontSize: 15, lineHeight: 18 }}>PackPass</Text>
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom, gap: 12 }}>
        {/* Screen readers hear the full headline once; the changing line is visual. */}
        <View accessible accessibilityRole="header" accessibilityLabel={HERO_HEADLINE}>
          {HERO_LEAD.map((l) => <Text key={l} variant="display2xl" color="#fff" style={styles.h1} numberOfLines={1}>{l}</Text>)}
          {/* One line, shrunk to fit if a line is ever too long, so the copy below never jumps. */}
          <View style={styles.line}>
            <RiseIn key={i}>
              <Text variant="display2xl" color="#fff" style={styles.h1} numberOfLines={1} adjustsFontSizeToFit>{HERO_SLIDES[i].line}</Text>
            </RiseIn>
          </View>
        </View>
        <Text color="rgba(255,255,255,0.88)">{`Drop-in classes across Austin, picked for your dog's energy and quirks.`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 14 }}>
          {['Agility', 'Scent work', 'Reactive-friendly', '1:1 trainers', 'Open play'].map((t) => <Tag key={t} tone="glass">{t}</Tag>)}
        </View>
        <Button variant="glass" wide block onPress={() => router.push('/sign-up')}>Create account</Button>
        <Press onPress={() => router.push('/sign-in')} scale={false} style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text weight="600" color="#fff" style={{ fontSize: 15 }}>I already have an account</Text>
        </Press>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The shadow keeps white type readable over bright photos (the porch).
  h1: { fontSize: 34, lineHeight: 34, letterSpacing: -0.85, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 14 },
  line: { minHeight: 34 },
});

export default themed('dark', Welcome);
