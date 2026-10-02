import { BlurView } from 'expo-blur';
import { Image, type ImageStyle } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photos } from '@/data/fixtures';
import type { PhotoKey } from '@/data/types';

/** Glass capsule: white 22% over a 20px blur with 1.4 saturate. Only use over photography. */
export function Glass({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  if (Platform.OS === 'web') {
    // Exact CSS from the design system; expo-blur's web tint is heavier than --glass.
    const web = { backgroundColor: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' } as ViewStyle;
    return <View style={[{ overflow: 'hidden' }, web, style]}>{children}</View>;
  }
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView tint="default" intensity={40} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      {children}
    </View>
  );
}

export function Photo({ name, style, position }: { name: PhotoKey; style?: StyleProp<ImageStyle>; position?: { top?: string; left?: string } }) {
  return (
    <Image
      source={photos[name]}
      style={style}
      contentFit="cover"
      contentPosition={position as never}
      transition={200}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Full-bleed photo filling its parent. */
export function PhotoFill({ name, position }: { name: PhotoKey; position?: { top?: string; left?: string } }) {
  return <Photo name={name} style={StyleSheet.absoluteFill} position={position} />;
}

type Stop = [string, number];
/** Vertical gradient. Stops are [color, 0..1] pairs, same as the CSS linear-gradient(180deg …) in the designs. */
export function Gradient({ stops, style }: { stops: Stop[]; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={stops.map((s) => s[0]) as [string, string, ...string[]]}
      locations={stops.map((s) => s[1]) as [number, number, ...number[]]}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

/** --scrim: transparent from 40%, 62% black at the bottom. */
export const Scrim = () => <Gradient stops={[['rgba(0,0,0,0)', 0.4], ['rgba(0,0,0,0.62)', 1]]} />;

/** Hero scrim used on photo headers: top for the status bar, bottom for the text. */
export const HeroScrim = ({ bottom = 0.66, mid = 0.45 }: { bottom?: number; mid?: number }) => (
  <Gradient
    stops={[
      ['rgba(0,0,0,0.4)', 0],
      ['rgba(0,0,0,0)', 0.26],
      ['rgba(0,0,0,0)', mid],
      [`rgba(0,0,0,${bottom})`, 1],
    ]}
  />
);
