import type { ReactNode } from 'react';
import { Platform, ScrollView, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** Browser width where the desktop layout takes over (Pack Member App Desktop, drawn at 1280). */
export const DESKTOP_MIN = 1024;

/** True in a desktop-width browser: sidebar nav, wide pages, dialogs in place of sheets. */
export function useWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN;
}

/** Web-only style keys React Native's types don't know (sticky, fixed, grid-free wrapping). */
export const web = (s: Record<string, unknown>) => s as ViewStyle;

/** A desktop page: scrolls, centered at 1280 max with the design's 32pt gutters. */
export function Page({ children, top = 24, style }: { children: ReactNode; top?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: top, paddingHorizontal: 32, paddingBottom: 64 }}>
      <View style={[{ width: '100%', maxWidth: 1216, alignSelf: 'center' }, style]}>{children}</View>
    </ScrollView>
  );
}

/**
 * Flex columns that wrap, like the design's `display:flex;flex-wrap:wrap` rows: each child gets a
 * `grow`/`basis` pair, so columns sit side by side when there's room and stack when there isn't.
 */
export function Columns({ children, gap = 32, align = 'flex-start', style }: { children: ReactNode; gap?: number; align?: ViewStyle['alignItems']; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: align }, style]}>{children}</View>;
}

export const col = (grow: number, basis: number, extra?: ViewStyle): ViewStyle => ({ flexGrow: grow, flexShrink: 1, flexBasis: basis, minWidth: 0, ...extra });

/** `repeat(auto-fill, minmax(min, 1fr))` as wrapping flex: put `tile(min)` on each child of a wrapping row. */
export const tile = (min: number, extra?: ViewStyle): ViewStyle => ({ flexGrow: 1, flexShrink: 1, flexBasis: min, minWidth: 0, ...extra });
