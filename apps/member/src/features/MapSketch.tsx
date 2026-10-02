import type { ReactNode } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/ds/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Road = { left: DimensionValue; top: DimensionValue; w: DimensionValue; h: DimensionValue; rotate: number };
type Park = { left: DimensionValue; top: DimensionValue; w: DimensionValue; h: DimensionValue; r?: number };

const LAYOUTS: Record<'card' | 'detail' | 'full', { roads: Road[]; parks: Park[] }> = {
  card: {
    roads: [
      { left: '-10%', top: '52%', w: '120%', h: 10, rotate: -8 },
      { left: '38%', top: '-20%', w: 8, h: '140%', rotate: 14 },
      { left: '72%', top: '-20%', w: 6, h: '140%', rotate: -4 },
    ],
    parks: [{ left: '6%', top: '10%', w: '26%', h: '34%', r: 12 }],
  },
  detail: {
    roads: [
      { left: '-10%', top: '40%', w: '120%', h: 12, rotate: 6 },
      { left: '58%', top: '-20%', w: 8, h: '140%', rotate: -12 },
    ],
    parks: [{ left: '8%', top: '58%', w: '40%', h: '34%', r: 12 }],
  },
  full: {
    roads: [
      { left: '-20%', top: '30%', w: '140%', h: 14, rotate: -12 },
      { left: '-20%', top: '58%', w: '140%', h: 10, rotate: 6 },
      { left: '30%', top: '-10%', w: 12, h: '120%', rotate: 10 },
      { left: '68%', top: '-10%', w: 8, h: '120%', rotate: -6 },
      { left: '-20%', top: '14%', w: '140%', h: 6, rotate: 4 },
    ],
    parks: [
      { left: '8%', top: '36%', w: '34%', h: '16%', r: 20 },
      { left: '62%', top: '8%', w: '30%', h: '14%', r: 20 },
    ],
  },
};

/** Drawn map placeholder from the design. A real map (Mapbox / react-native-maps) replaces it in phase 2. */
export function MapSketch({ variant, pin, style, children }: { variant: keyof typeof LAYOUTS; pin?: { left: DimensionValue; top: DimensionValue; size?: number }; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const { c } = useTheme();
  const { roads, parks } = LAYOUTS[variant];
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: c.surfaceSunken }, style]} accessibilityLabel="Map" accessibilityRole="image">
      {roads.map((r, i) => (
        <View key={i} style={{ position: 'absolute', left: r.left, top: r.top, width: r.w, height: r.h, backgroundColor: c.bg, transform: [{ rotate: `${r.rotate}deg` }] }} />
      ))}
      {parks.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.left, top: p.top, width: p.w, height: p.h, borderRadius: p.r ?? 12, backgroundColor: c.turfSoft }} />
      ))}
      {pin ? (
        <View style={{ position: 'absolute', left: pin.left, top: pin.top, width: pin.size ?? 30, height: pin.size ?? 30, borderRadius: 9999, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 4px rgba(14,15,14,0.12)' }}>
          <Icon name="map-pin" size={16} color={c.onInverse} />
        </View>
      ) : null}
      {children}
    </View>
  );
}
