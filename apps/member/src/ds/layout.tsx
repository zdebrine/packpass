import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeScope, useTheme } from '@/theme/ThemeProvider';
import { fonts, type ThemeName } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Glass } from './Surface';
import { Text } from './Text';

/** Top padding that clears the status bar (the designs draw a 50pt bar). */
export function useTop() {
  const { top } = useSafeAreaInsets();
  return Math.max(top, 12);
}
/** Bottom padding that clears the home indicator (the designs use 34). */
export function useBottom(min = 20) {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, min);
}

interface ScreenProps {
  children: ReactNode;
  /** Force a theme, like `data-theme` on the design's phone frame. */
  theme?: ThemeName;
  /** Content runs under the status bar (photo heroes). */
  bleed?: boolean;
  /** Status bar text color: light over photos and dark grounds. */
  statusLight?: boolean;
  style?: StyleProp<ViewStyle>;
}

function ScreenInner({ children, bleed, statusLight, style }: Omit<ScreenProps, 'theme'>) {
  const { c, name } = useTheme();
  const top = useTop();
  return (
    <View style={[{ flex: 1, backgroundColor: c.bg, paddingTop: bleed ? 0 : top }, style]}>
      <StatusBar style={statusLight || name === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

export function Screen({ theme, ...rest }: ScreenProps) {
  return theme ? (
    <ThemeScope name={theme}>
      <ScreenInner {...rest} />
    </ThemeScope>
  ) : (
    <ScreenInner {...rest} />
  );
}

/** Sticky footer with the floating shadow (booking bar, onboarding Continue). */
export function Footer({ children, shadow = true, style }: { children: ReactNode; shadow?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bottom = useBottom();
  return (
    <View style={[{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: bottom, gap: 10, backgroundColor: c.bg }, shadow ? { boxShadow: c.shadowFloat } : null, style]}>
      {children}
    </View>
  );
}

/** 44pt round icon button: glass over photos, raised elsewhere. */
export function IconButton({ icon, onPress, glass, size = 44, label, style }: { icon: IconName; onPress?: () => void; glass?: boolean; size?: number; label: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const box: ViewStyle = { width: size, height: size, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' };
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={[box, glass ? { overflow: 'hidden' } : { backgroundColor: c.surfaceRaised }, style]}>
      {glass ? <Glass style={[box, { position: 'absolute' }]} /> : null}
      <Icon name={icon} size={size > 40 ? 20 : 18} color={glass ? '#fff' : c.ink} />
    </Press>
  );
}

/** Section title with the round arrow button (the design's replacement for "See all"). */
export function SectionTitle({ title, onMore, right, style }: { title: string; onMore?: () => void; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, style]}>
      <Text variant="title">{title}</Text>
      {right ?? (onMore ? <IconButton icon="arrow-right" size={36} onPress={onMore} label={`More ${title}`} /> : null)}
    </View>
  );
}

/** Segmented progress bars (steps, intensity, credits). */
export function Bars({ total, done, height = 6, color, gap = 4, style }: { total: number; done: number; height?: number; color?: string; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', gap }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height, borderRadius: 9999, backgroundColor: i < done ? color ?? c.turf : c.surfaceSunken }} />
      ))}
    </View>
  );
}

/** Horizontal fill bar (monthly balance). */
export function Meter({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, height, borderRadius: 9999, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(1, pct) * 100}%`, height: '100%', borderRadius: 9999, backgroundColor: color }} />
    </View>
  );
}

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      style={{ width: 52, height: 32, padding: 3, borderRadius: 9999, backgroundColor: on ? c.inverse : c.surfaceSunken, alignItems: on ? 'flex-end' : 'flex-start' }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 9999, backgroundColor: on ? c.onInverse : c.bg }} />
    </Press>
  );
}

/** Pill text input on a raised fill. */
export function Field({ label, right, left, style, ...input }: TextInputProps & { label?: string; right?: ReactNode; left?: ReactNode }) {
  const { c } = useTheme();
  const box = (
    <View style={{ height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', paddingLeft: left ? 18 : 20, paddingRight: right ? 8 : 20, gap: 10 }}>
      {left}
      <TextInput
        placeholderTextColor={c.inkFaint}
        {...input}
        style={[{ flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.sans, fontSize: 16, color: c.ink, outlineStyle: 'none' } as never, style]}
      />
      {right}
    </View>
  );
  if (!label) return box;
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" weight="600">{label}</Text>
      {box}
    </View>
  );
}

/** Small pill button inside a field or row ("Show", "Change", "Swap"). */
export function MiniButton({ children, onPress, fill }: { children: ReactNode; onPress?: () => void; fill?: string }) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} style={{ height: 36, paddingHorizontal: 14, borderRadius: 9999, backgroundColor: fill ?? c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </Press>
  );
}

/** Grabber at the top of a sheet. */
export function Grabber() {
  const { c } = useTheme();
  return <View style={{ width: 40, height: 5, borderRadius: 9999, backgroundColor: c.surfaceSunken, alignSelf: 'center' }} />;
}

/** Raised row with a 44 to 52pt thumbnail, used across Today, 01j, 13. */
export function Card({ children, style, radius = 28, fill }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; fill?: string }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: fill ?? c.surfaceRaised, borderRadius: radius }, style]}>{children}</View>;
}

/** Round badge with an icon (clearances, milestones, notifications). */
export function Badge({ icon, bg, fg, size = 40, iconSize }: { icon: IconName; bg: string; fg: string; size?: number; iconSize?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 9999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.46)} color={fg} />
    </View>
  );
}

/** Renders a whole route inside a forced theme, so `useTheme()` in the route body gets that palette too. */
export function themed<P extends object>(name: ThemeName, C: (p: P) => React.ReactElement | null) {
  return function Themed(p: P) {
    return (
      <ThemeScope name={name}>
        <C {...p} />
      </ThemeScope>
    );
  };
}
