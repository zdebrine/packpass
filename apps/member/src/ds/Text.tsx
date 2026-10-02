import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type as typeScale, type TypeVariant } from '@/theme/tokens';

type Weight = '400' | '500' | '600' | '700';
const GEIST: Record<Weight, string> = {
  '400': fonts.sans,
  '500': fonts.sansMedium,
  '600': fonts.sansSemibold,
  '700': 'Geist_700Bold',
};

export interface Props extends TextProps {
  variant?: TypeVariant;
  /** Overrides the Geist weight (sans variants only). */
  weight?: Weight;
  color?: string;
  muted?: boolean;
  /** Tabular numbers. */
  num?: boolean;
  center?: boolean;
}

export function Text({ variant = 'body', weight, color, muted, num, center, style, ...rest }: Props) {
  const { c } = useTheme();
  const base = typeScale[variant] as TextStyle;
  const isSans = !variant.startsWith('display') && variant !== 'wide';
  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: color ?? (muted ? c.inkMuted : c.ink) },
        weight && isSans ? { fontFamily: GEIST[weight] } : null,
        variant === 'wide' && weight === '700' ? { fontFamily: fonts.wideBold } : null,
        num ? { fontVariant: ['tabular-nums'] } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    />
  );
}
