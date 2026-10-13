import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeScope, useTheme } from '@/theme/ThemeProvider';
import { fonts, type ThemeName } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Glass } from './Surface';
import { useWide } from './responsive';
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
  const wide = useWide();
  const screen = (
    <View style={[{ flex: 1, backgroundColor: c.bg, paddingTop: bleed ? 0 : wide ? 24 : top }, wide ? { width: '100%', maxWidth: 640, alignSelf: 'center' } : null, style]}>
      <StatusBar style={statusLight || name === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
  // Desktop pages have their own layouts; a screen without one (settings, plan) keeps the phone column, centered.
  return wide ? <View style={{ flex: 1, backgroundColor: c.bg }}>{screen}</View> : screen;
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

/** 44pt round icon button: glass over photos, raised elsewhere. `dot` marks something unread. */
export function IconButton({ icon, onPress, glass, size = 44, label, style, dot }: { icon: IconName; onPress?: () => void; glass?: boolean; size?: number; label: string; style?: StyleProp<ViewStyle>; dot?: boolean }) {
  const { c } = useTheme();
  const box: ViewStyle = { width: size, height: size, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' };
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={[box, glass ? { overflow: 'hidden' } : { backgroundColor: c.surfaceRaised }, style]}>
      {glass ? <Glass style={[box, { position: 'absolute' }]} /> : null}
      <Icon name={icon} size={size > 40 ? 20 : 18} color={glass ? '#fff' : c.ink} />
      {dot ? <View style={{ position: 'absolute', top: '22%', right: '22%', width: 7, height: 7, borderRadius: 9999, backgroundColor: c.kennelRed, boxShadow: `0 0 0 2px ${glass ? 'transparent' : c.bg}` }} /> : null}
    </Press>
  );
}

/** Section title with the round arrow button (the design's replacement for "See all"). */
export function SectionTitle({ title, onMore, right, style }: { title: string; onMore?: () => void; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, style]}>
      <Text variant="title">{title}</Text>
      {right ?? (onMore ? (
        <Press onPress={onMore} accessibilityLabel={`More ${title}`} style={{ width: 32, height: 32, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-right" size={16} color={c.inkMuted} />
        </Press>
      ) : null)}
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

/** v3 text field: 48pt, radius 12, a strong hairline on the surface (`fill` overrides the surface). `search` is the 44pt raised pill. */
export function Field({ label, right, left, fill, search, style, ...input }: TextInputProps & { label?: string; right?: ReactNode; left?: ReactNode; fill?: string; search?: boolean }) {
  const { c } = useTheme();
  const shape: ViewStyle = search
    ? { height: 44, borderRadius: 9999, backgroundColor: fill ?? c.surfaceRaised, paddingLeft: 14, paddingRight: 14 }
    : { height: 48, borderRadius: 12, backgroundColor: fill ?? c.surface, boxShadow: `inset 0 0 0 1px ${c.lineStrong}`, paddingLeft: left ? 12 : 14, paddingRight: right ? 6 : 14 };
  const box = (
    <View style={[shape, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
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
    <View style={{ gap: 6 }}>
      <Text variant="heading">{label}</Text>
      {box}
    </View>
  );
}

/** Small pill button inside a field or row ("Show", "Change", "Swap"). */
export function MiniButton({ children, onPress, fill }: { children: ReactNode; onPress?: () => void; fill?: string }) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} style={{ height: 34, paddingHorizontal: 12, borderRadius: 9999, backgroundColor: fill ?? c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </Press>
  );
}

/** Grabber at the top of a sheet. */
export function Grabber() {
  const { c } = useTheme();
  return <View style={{ width: 40, height: 5, borderRadius: 9999, backgroundColor: c.surfaceSunken, alignSelf: 'center' }} />;
}

/** v3 card: radius 16, filled on `surfaceRaised`, or a hairline on the page with `line`. */
export function Card({ children, style, radius = 16, fill, line }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; fill?: string; line?: boolean }) {
  const { c } = useTheme();
  return <View style={[line ? { boxShadow: `inset 0 0 0 1px ${c.line}` } : { backgroundColor: fill ?? c.surfaceRaised }, { borderRadius: radius }, style]}>{children}</View>;
}

/** v3 list row: 60pt min, hairline under it, a 44pt thumb, title, meta and a trailing slot. */
export function Row({ title, meta, thumb, trail, onPress, last, style }: { title: ReactNode; meta?: ReactNode; thumb?: ReactNode; trail?: ReactNode; onPress?: () => void; last?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const body = (
    <>
      {thumb ? <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>{thumb}</View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof title === 'string' ? <Text variant="heading" numberOfLines={1}>{title}</Text> : title}
        {typeof meta === 'string' ? <Text variant="caption" muted numberOfLines={1}>{meta}</Text> : meta}
      </View>
      {trail ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{trail}</View> : null}
    </>
  );
  const box: StyleProp<ViewStyle> = [{ minHeight: 60, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, last ? null : { borderBottomWidth: 1, borderBottomColor: c.line }, style];
  return onPress ? <Press onPress={onPress} scale={false} style={box} activeStyle={{ backgroundColor: c.hover }}>{body}</Press> : <View style={box}>{body}</View>;
}

/** v3 empty state: icon in a 44pt circle, a title, a muted line and an optional action. */
export function EmptyState({ icon, title, body, children }: { icon?: IconName; title: string; body?: string; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 }}>
      {icon ? <View style={{ width: 44, height: 44, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}><Icon name={icon} color={c.inkMuted} /></View> : null}
      <Text variant="title" center>{title}</Text>
      {body ? <Text muted center style={{ maxWidth: 300 }}>{body}</Text> : null}
      {children ? <View style={{ marginTop: 8 }}>{children}</View> : null}
    </View>
  );
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
