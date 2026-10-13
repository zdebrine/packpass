import { useState, type ReactNode } from 'react';
import { Image, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { areaNamed } from '@/lib/location';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

export type LatLng = [number, number];

export interface MapPin {
  lat: number;
  lng: number;
  /** Text inside the 28pt pin (a count); empty draws a plain dot. */
  label?: string;
  active?: boolean;
  /** Accessible name. */
  title?: string;
  onPress?: () => void;
}

const TILE = 256;
const LIGHT = 'grayscale(1) brightness(1.04) contrast(.9)';
const DARK = 'grayscale(1) invert(.92) contrast(.9)';

/** Web Mercator tile coordinates (fractional) of a point. */
function tileXY(lat: number, lng: number, z: number): [number, number] {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
}

/** The middle of a set of points, for a map that should show all of them. */
export function centerOf(points: { lat?: number; lng?: number }[], fallback: LatLng): LatLng {
  const ok = points.filter((p): p is { lat: number; lng: number } => p.lat != null && p.lng != null);
  if (!ok.length) return fallback;
  const lats = ok.map((p) => p.lat), lngs = ok.map((p) => p.lng);
  return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
}

/**
 * The design system's Map: monochrome OpenStreetMap tiles around `center`, 28pt pins at real
 * coordinates and a "me" dot. `renderPin` swaps the round pin for custom content (Book's label pins),
 * centred on the point. Tiles are static: no pan or zoom, like the design.
 */
export function Map({ center, zoom = 14, pins = [], me, height, radius = 16, renderPin, inset, style, children }: {
  center: LatLng;
  zoom?: number;
  pins?: MapPin[];
  me?: LatLng | null;
  height?: ViewStyle['height'];
  radius?: number;
  renderPin?: (pin: MapPin, i: number) => ReactNode;
  /** Parts of the map covered by overlays (a bottom sheet, a search bar): `center` lands in the middle of the rest. */
  inset?: { top?: number; bottom?: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { c, name } = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [cx, cy0] = tileXY(center[0], center[1], zoom);
  // Moving the centre tile row shifts the whole map, so an inset is a fractional tile offset.
  const cy = cy0 - ((inset?.top ?? 0) - (inset?.bottom ?? 0)) / 2 / TILE;
  const at = (lat: number, lng: number) => {
    const [x, y] = tileXY(lat, lng, zoom);
    return { left: (size?.w ?? 0) / 2 + (x - cx) * TILE, top: (size?.h ?? 0) / 2 + (y - cy) * TILE };
  };

  const tiles: ReactNode[] = [];
  if (size) {
    const n = 2 ** zoom;
    const x0 = Math.floor(cx - size.w / 2 / TILE), x1 = Math.floor(cx + size.w / 2 / TILE);
    const y0 = Math.max(0, Math.floor(cy - size.h / 2 / TILE)), y1 = Math.min(n - 1, Math.floor(cy + size.h / 2 / TILE));
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      const wx = ((tx % n) + n) % n;
      tiles.push(
        <Image
          key={`${tx}_${ty}`}
          source={{ uri: `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png`, headers: Platform.OS === 'web' ? undefined : { 'User-Agent': 'PackPass/1.0 (packpass.app)' } }}
          style={{ position: 'absolute', width: TILE, height: TILE, left: size.w / 2 + (tx - cx) * TILE, top: size.h / 2 + (ty - cy) * TILE }}
          accessibilityIgnoresInvertColors
        />,
      );
    }
  }
  const filter = Platform.OS === 'web' ? ({ filter: name === 'dark' ? DARK : LIGHT, opacity: 0.92 } as ViewStyle) : null;

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: name === 'dark' ? '#1b1c1b' : '#f2f2ef' }, style]}
      accessibilityLabel="Map"
    >
      <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, filter]}>{tiles}</View>
      {size && me ? (
        <View
          style={{ position: 'absolute', ...shift(at(me[0], me[1]), 16), width: 16, height: 16, borderRadius: 9999, backgroundColor: c.turf, boxShadow: `0 0 0 3px ${c.surface}, 0 0 0 9px rgba(63,107,79,0.18)` }}
          accessibilityLabel="You are here"
        />
      ) : null}
      {size ? pins.map((p, i) => {
        const pos = at(p.lat, p.lng);
        if (renderPin) {
          return (
            <View key={i} style={{ position: 'absolute', left: pos.left, top: pos.top, width: 0, height: 0, alignItems: 'center', justifyContent: 'center', zIndex: p.active ? 3 : 2 }}>
              {renderPin(p, i)}
            </View>
          );
        }
        const s = 28;
        return (
          <Press
            key={i}
            onPress={p.onPress}
            disabled={!p.onPress}
            accessibilityLabel={p.title}
            style={{ position: 'absolute', ...shift(pos, s), width: s, height: s, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', zIndex: p.active ? 3 : 2, backgroundColor: p.active ? c.agility : c.inverse, boxShadow: `0 0 0 2px ${c.surface}, 0 4px 10px rgba(0,0,0,0.25)`, transform: p.active ? [{ scale: 1.14 }] : undefined }}
          >
            {p.label ? <Text style={{ fontSize: 11, lineHeight: 14 }} weight="600" color={p.active ? c.onAgility : c.onInverse}>{p.label}</Text> : null}
          </Press>
        );
      }) : null}
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 4 + (inset?.bottom ?? 0), zIndex: 4, paddingHorizontal: 4, borderRadius: 3, backgroundColor: name === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)' }}>
        <Text style={{ fontSize: 9, lineHeight: 12 }} color={c.inkMuted}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const shift = (p: { left: number; top: number }, s: number) => ({ left: p.left - s / 2, top: p.top - s / 2 });

/** Where the member is measuring from (picked location, else their area), for the map's "me" dot. */
export function useMe(): LatLng | null {
  const origin = useApp((s) => s.origin);
  const area = useApp((s) => s.area);
  const o = origin ?? areaNamed(area) ?? null;
  return o ? [o.lat, o.lng] : null;
}
