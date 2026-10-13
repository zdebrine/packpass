import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { RECHECK_QUOTE, SOCIAL_UNLOCKS } from '@/data/passport';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { IconButton, Screen, useBottom, useTop, themed } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { col, useWide, web } from '@/ds/responsive';
import { Press } from '@/ds/Press';
import { Glass, Gradient, Photo, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { catalog } from '@/data/catalog';
import { monthYear, useClearances } from '@/lib/clearances';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

const ease = Easing.bezier(...motion.easeOut);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const C = 415; // circumference of r=66

/** Rises in after a delay (pkRise: 700ms, 18px). */
function Rise({ delay, children }: { delay: number; children: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 700, easing: ease }));
  }, [t, delay]);
  const s = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: interpolate(t.value, [0, 1], [18, 0]) }] }));
  return <Animated.View style={s}>{children}</Animated.View>;
}

function Ring({ delay, agility }: { delay: number; agility: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1400, easing: ease }));
  }, [t, delay]);
  const s = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 1], [0.7, 0]), transform: [{ scale: interpolate(t.value, [0, 1], [1, 2.1]) }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 9999, borderWidth: 2, borderColor: agility }, s]} />;
}

function Badge({ arc, pop }: { arc: SharedValue<number>; pop: SharedValue<number> }) {
  const { c } = useTheme();
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - arc.value) }));
  const badge = useAnimatedStyle(() => ({
    opacity: interpolate(pop.value, [0, 0.6, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(pop.value, [0, 0.6, 1], [0.4, 1.08, 1]) }],
  }));
  return (
    <View style={{ width: 148, height: 148 }} accessibilityRole="image" accessibilityLabel="Social clearance badge">
      <Ring delay={900} agility={c.agility} />
      <Ring delay={1400} agility={c.agility} />
      <Svg width={148} height={148} viewBox="0 0 148 148" style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Circle cx={74} cy={74} r={66} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={4} />
        <AnimatedCircle cx={74} cy={74} r={66} fill="none" stroke={c.agility} strokeWidth={4} strokeLinecap="round" strokeDasharray={C} animatedProps={arcProps} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, borderRadius: 9999, backgroundColor: c.pitch, alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.6)' }, badge]}>
        <Icon name="shield-check" size={52} color={c.onPitch} />
      </Animated.View>
    </View>
  );
}

/**
 * 13 Clearance earned. Opening it is the moment Juno's Passport switches from "Working on it" to "Cleared".
 * Ring draws (900ms), badge pops, two rings pulse, then the headline rises in.
 */
function ClearanceEarned() {
  const social = useApp((s) => s.social);
  if (social === 'working') return <Redirect href="/passport/social" />;
  return <Celebration />;
}

function Celebration() {
  const juno = useDog();
  const wide = useWide();
  const top = useTop();
  const bottom = useBottom(32);
  const see = useApp((s) => s.seeSocialClearance);
  const markRead = useApp((s) => s.markRead);
  const arc = useSharedValue(0);
  const pop = useSharedValue(0);

  // Desktop's Replay runs the ring, badge and headline again (the Rise and Ring timers restart on remount).
  const [run, setRun] = useState(0);
  const play = useCallback(() => {
    arc.set(0);
    pop.set(0);
    arc.set(withDelay(250, withTiming(1, { duration: 900, easing: ease })));
    pop.set(withDelay(700, withTiming(1, { duration: 800, easing: ease })));
  }, [arc, pop]);
  const replay = () => {
    setRun((n) => n + 1);
    play();
  };

  useEffect(() => {
    see();
    markRead(['n-recheck']);
    play();
    if (Platform.OS !== 'web') {
      const t = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 900);
      return () => clearTimeout(t);
    }
  }, [see, markRead, play]);

  const close = () => router.dismissTo('/dog');
  const share = () => Share.share({ message: `${juno.name} is Social cleared on PackPass. Group sport, play and group skills are open.` }).catch(() => {});

  if (wide) {
    return (
      <Overlay kind="dialog" width={760} dim={0.6} onClose={close}>
        <View style={{ height: 420, overflow: 'hidden' }}>
          <PhotoFill name="dogs_meeting_on_leash" />
          <Gradient stops={[['rgba(0,0,0,0.45)', 0], ['rgba(0,0,0,0.2)', 0.3], ['rgba(0,0,0,0.35)', 0.6], ['#0e0f0e', 1]]} />
          <View style={{ position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 }}>
            <IconButton glass icon="x" label="Close" onPress={close} />
            <Press onPress={replay} accessibilityLabel="Replay" style={{ height: 44, paddingHorizontal: 16, borderRadius: 9999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <Glass style={web({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 })} />
              <Text variant="caption" weight="600" color="#fff" style={{ fontSize: 13 }}>Replay</Text>
            </Press>
          </View>
          <View key={run} style={{ position: 'absolute', left: 0, right: 0, top: 60, bottom: 0 }}>
            <View style={{ alignItems: 'center' }}>
              <Badge arc={arc} pop={pop} />
            </View>
            <View style={{ position: 'absolute', left: 32, right: 32, bottom: 24, alignItems: 'center' }}>
              <ThemeAgility />
              <Rise delay={1250}>
                <Text variant="displayXl" color="#fff" center style={{ marginTop: 10 }} accessibilityRole="header">{`${juno.name} is Social cleared.`}</Text>
              </Rise>
              <Rise delay={1400}>
                <Text variant="label" color="rgba(255,255,255,0.88)" center style={{ marginTop: 10 }}>Four steps of Calm around dogs, done. Group sport is open at every PackPass partner.</Text>
              </Rise>
            </View>
          </View>
        </View>

        <View style={{ paddingTop: 8, paddingHorizontal: 32, paddingBottom: 32 }}>
          <Facts />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: 28 }}>
            <View style={col(1, 300)}>
              <Text variant="title" style={{ marginBottom: 14 }}>{`Open to ${juno.name} now`}</Text>
              <Unlocks />
            </View>
            <View style={col(1, 260, { gap: 16 })}>
              <Quote style={{ marginTop: 0 }} />
              <Text variant="caption" muted>{`Added to ${juno.name}'s Passport. Partners see it when you book.`}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
            <Button variant="quiet" style={{ flex: 1 }} onPress={share}>Share</Button>
            <Button variant="signal" style={{ flex: 2 }} onPress={() => { router.dismissTo('/book'); }}>Book group sport</Button>
          </View>
        </View>
      </Overlay>
    );
  }

  return (
    <Screen theme="dark" bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: 392, overflow: 'hidden' }}>
          <PhotoFill name="dogs_meeting_on_leash" />
          <Gradient stops={[['rgba(0,0,0,0.45)', 0], ['rgba(0,0,0,0.2)', 0.3], ['rgba(0,0,0,0.35)', 0.6], ['#0e0f0e', 1]]} />
          <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton glass icon="x" label="Close" onPress={close} />
            <IconButton glass icon="share" label="Share" onPress={share} />
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, top: top + 54, alignItems: 'center' }}>
            <Badge arc={arc} pop={pop} />
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 24, alignItems: 'center' }}>
            <ThemeAgility />
            <Rise delay={1250}>
              <Text variant="displayXl" color="#fff" center style={{ marginTop: 10 }} accessibilityRole="header">{`${juno.name} is Social cleared.`}</Text>
            </Rise>
            <Rise delay={1400}>
              <Text variant="label" color="rgba(255,255,255,0.88)" center style={{ marginTop: 10 }}>Four steps of Calm around dogs, done. Group sport is open at every PackPass partner.</Text>
            </Rise>
          </View>
        </View>

        <View style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 32 }}>
          <Facts />
          <Text variant="title" style={{ marginTop: 28, marginBottom: 14 }}>{`Open to ${juno.name} now`}</Text>
          <Unlocks />
          <Quote />
          <Text variant="caption" muted center style={{ marginTop: 20 }}>{`Added to ${juno.name}'s Passport. Partners see it when you book.`}</Text>
        </View>
      </ScrollView>
      <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: bottom, flexDirection: 'row', gap: 8 }}>
        <Button variant="quiet" style={{ flex: 1 }} onPress={share}>Share</Button>
        <Button variant="signal" style={{ flex: 2 }} onPress={() => { router.dismissTo('/book'); }}>Book group sport</Button>
      </View>
    </Screen>
  );
}

function ThemeAgility() {
  const { c } = useTheme();
  return (
    <Rise delay={1100}>
      <Text variant="wide" color={c.agility} center>New clearance</Text>
    </Rise>
  );
}

/** The real clearance in live mode; the designs' Eastside re-check in sample mode. */
function useEarned() {
  const k = useClearances().socialRecord;
  if (!k) return { issuer: 'Eastside', issuerFull: 'Eastside Dog Club', earned: 'Today', validTo: 'Sep 2027', quote: RECHECK_QUOTE, assessor: 'Sam Reyes' };
  const p = catalog.partners[k.partnerId];
  return {
    issuer: p?.short ?? p?.name ?? 'PackPass', issuerFull: p?.name ?? 'PackPass partner', earned: monthYear(k.assessedOn),
    validTo: k.expiresOn ? monthYear(k.expiresOn) : 'No expiry', quote: k.quote, assessor: k.assessor,
  };
}

function Facts() {
  const { c } = useTheme();
  const e = useEarned();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[['Issued by', e.issuer], ['Earned', e.earned], ['Valid to', e.validTo]].map(([k, v]) => (
        <View key={k} style={{ flex: 1, backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 14 }}>
          <Text variant="caption" muted>{k}</Text>
          <Text variant="label" weight="600" style={{ marginTop: 4 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Unlocks() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {SOCIAL_UNLOCKS.map((u) => (
        <View key={u.label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingLeft: 10, paddingRight: 14, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
          <Photo name={u.photo} style={{ width: 52, height: 52, borderRadius: 12 }} />
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="600">{u.label}</Text>
            <Text variant="caption" muted>{u.ex}</Text>
          </View>
          <Icon name="lock-open" />
        </View>
      ))}
    </View>
  );
}

function Quote({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  const e = useEarned();
  if (!e.quote) return null;
  return (
    <View style={[{ marginTop: 28, padding: 20, borderRadius: 16, backgroundColor: c.surfaceRaised }, style]}>
      <Text variant="wide" muted>From the assessor</Text>
      <Text style={{ marginTop: 10 }}>{`“${e.quote}”`}</Text>
      <Text variant="caption" muted style={{ marginTop: 8 }}>{[e.assessor, e.issuerFull].filter(Boolean).join(', ')}</Text>
    </View>
  );
}

export default themed('dark', ClearanceEarned);
