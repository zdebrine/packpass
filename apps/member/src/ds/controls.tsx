import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Glass } from './Surface';
import { Text } from './Text';

// ---- Button --------------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'signal' | 'quiet' | 'outline' | 'ghost' | 'glass';

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  wide?: boolean;
  block?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  /** Overrides the fill, e.g. quiet buttons on a raised card use `bg`. */
  fill?: string;
  accessibilityLabel?: string;
}

export function Button({ children, onPress, variant = 'primary', size = 'md', wide, block, disabled, icon, style, fill, accessibilityLabel }: ButtonProps) {
  const { c } = useTheme();
  const bg = { primary: c.inverse, signal: c.agility, quiet: c.surfaceRaised, outline: 'transparent', ghost: 'transparent', glass: 'transparent' }[variant];
  const fg = { primary: c.onInverse, signal: c.onAgility, quiet: c.ink, outline: c.ink, ghost: c.ink, glass: c.onGlass }[variant];
  const hover = { primary: { opacity: 0.88 }, signal: { opacity: 0.94 }, quiet: { backgroundColor: c.surfaceSunken }, outline: { backgroundColor: c.hover }, ghost: { backgroundColor: c.hover }, glass: { opacity: 0.9 } }[variant];
  // v3: 48 / 36, sentence-case labels (`wide` is kept for callers but no longer switches to wide caps).
  void wide;
  const h = size === 'sm' ? 36 : 48;
  const label = (
    <View style={styles.btnRow}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.sansSemibold, fontSize: size === 'sm' ? 13 : 15, lineHeight: 20, color: fg }}
      >
        {children}
      </Text>
    </View>
  );
  const box: ViewStyle = {
    height: h,
    paddingHorizontal: size === 'sm' ? 15 : 20,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: block ? 'stretch' : 'auto',
    opacity: disabled ? 0.4 : 1,
  };
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[box, { backgroundColor: fill ?? bg }, variant === 'outline' ? { boxShadow: `inset 0 0 0 1px ${c.lineStrong}` } : null, variant === 'glass' ? { overflow: 'hidden' } : null, style]}
      activeStyle={hover}
    >
      {variant === 'glass' ? <Glass style={[StyleSheet.absoluteFill]} /> : null}
      {label}
    </Press>
  );
}

// ---- Chip ----------------------------------------------------------------------------------

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Leading avatar or custom node. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ children, selected, onPress, icon, leading, style }: ChipProps) {
  const { c } = useTheme();
  const fg = selected ? c.onInverse : c.ink;
  return (
    <Press
      onPress={onPress}
      accessibilityState={{ selected: !!selected }}
      style={[
        { height: 34, paddingLeft: leading ? 4 : 14, paddingRight: 14, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: selected ? c.inverse : c.surfaceRaised },
        style,
      ]}
      activeStyle={selected ? null : { backgroundColor: c.surfaceSunken }}
    >
      {leading}
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="caption" weight="500" color={fg} numberOfLines={1}>{children}</Text>
    </Press>
  );
}

// ---- Tag -----------------------------------------------------------------------------------

export type TagTone = 'neutral' | 'premium' | 'signal' | 'warning' | 'glass';

export function Tag({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: TagTone; icon?: IconName }) {
  const { c } = useTheme();
  const bg = { neutral: c.surfaceRaised, premium: c.pitch, signal: c.agility, warning: c.kennelRedSoft, glass: 'transparent' }[tone];
  const fg = { neutral: c.ink, premium: c.onPitch, signal: c.onAgility, warning: c.kennelRed, glass: c.onGlass }[tone];
  const inner = (
    <>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16, color: fg }} numberOfLines={1}>
        {children}
      </Text>
    </>
  );
  const box: ViewStyle = { height: 24, paddingHorizontal: 10, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' };
  if (tone === 'glass') return <Glass style={box}>{inner}</Glass>;
  return <View style={[box, { backgroundColor: bg }]}>{inner}</View>;
}

// ---- StatusBadge ---------------------------------------------------------------------------

export type BadgeTone = 'neutral' | 'cleared' | 'needs' | 'warning' | 'signal';

/** v3 Badge: a 22pt status label at radius 6 ("Cleared", "Needs assessment", "Drop-off", "Today"). */
export function StatusBadge({ children, tone = 'neutral', icon, dot }: { children: ReactNode; tone?: BadgeTone; icon?: IconName; dot?: boolean }) {
  const { c } = useTheme();
  const bg = { neutral: c.surfaceRaised, cleared: c.pitch, needs: 'transparent', warning: c.kennelRedSoft, signal: c.agility }[tone];
  const fg = { neutral: c.ink, cleared: c.onPitch, needs: c.ink, warning: c.kennelRed, signal: c.onAgility }[tone];
  return (
    <View style={[{ height: 22, paddingHorizontal: 7, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: bg }, tone === 'needs' ? { boxShadow: `inset 0 0 0 1px ${c.lineStrong}` } : null]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: fg }} /> : null}
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 14, color: fg, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{children}</Text>
    </View>
  );
}

/** Status under class rows: "Cleared", "Needs assessment", "Private". Now drawn as a v3 Badge. */
export function Pill({ children, tone = 'raised', icon }: { children: ReactNode; tone?: 'pitch' | 'raised' | 'muted'; icon?: IconName }) {
  return <StatusBadge tone={tone === 'pitch' ? 'cleared' : tone === 'muted' ? 'needs' : 'neutral'} icon={icon}>{children}</StatusBadge>;
}

const styles = StyleSheet.create({
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
