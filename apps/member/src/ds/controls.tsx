import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Glass } from './Surface';
import { Text } from './Text';

// ---- Button --------------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'signal' | 'quiet' | 'glass';

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
  const bg = { primary: c.inverse, signal: c.agility, quiet: c.surfaceRaised, glass: 'transparent' }[variant];
  const fg = { primary: c.onInverse, signal: c.onAgility, quiet: c.ink, glass: c.onGlass }[variant];
  const hover = { primary: { opacity: 0.88 }, signal: { opacity: 0.94 }, quiet: { backgroundColor: c.surfaceSunken }, glass: { opacity: 0.9 } }[variant];
  const h = size === 'sm' ? 40 : 52;
  const label = (
    <View style={styles.btnRow}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text
        numberOfLines={1}
        style={wide
          ? { fontFamily: fonts.wide, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: 'uppercase', color: fg }
          : { fontFamily: fonts.sansSemibold, fontSize: size === 'sm' ? 14 : 15, lineHeight: 20, color: fg }}
      >
        {children}
      </Text>
    </View>
  );
  const box: ViewStyle = {
    height: h,
    paddingHorizontal: size === 'sm' ? 18 : 24,
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
      style={[box, { backgroundColor: fill ?? bg }, variant === 'glass' ? { overflow: 'hidden' } : null, style]}
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
        { height: 38, paddingLeft: leading ? 5 : 16, paddingRight: 16, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: selected ? c.inverse : c.surfaceRaised },
        style,
      ]}
      activeStyle={selected ? null : { backgroundColor: c.surfaceSunken }}
    >
      {leading}
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" color={fg} numberOfLines={1}>{children}</Text>
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
      <Text style={{ fontFamily: fonts.wide, fontSize: 10, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: fg }} numberOfLines={1}>
        {children}
      </Text>
    </>
  );
  const box: ViewStyle = { height: 24, paddingHorizontal: 10, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' };
  if (tone === 'glass') return <Glass style={box}>{inner}</Glass>;
  return <View style={[box, { backgroundColor: bg }]}>{inner}</View>;
}

/** Small status pill used under class rows: "Cleared", "Needs assessment", "Private". */
export function Pill({ children, tone = 'raised', icon }: { children: ReactNode; tone?: 'pitch' | 'raised' | 'muted'; icon?: IconName }) {
  const { c } = useTheme();
  const bg = tone === 'pitch' ? c.pitch : c.surfaceRaised;
  const fg = tone === 'pitch' ? c.onPitch : tone === 'muted' ? c.inkMuted : c.ink;
  return (
    <View style={{ height: 24, paddingLeft: icon ? 8 : 10, paddingRight: 10, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: bg }}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Text variant="caption" weight={tone === 'muted' ? '500' : '600'} color={fg}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
