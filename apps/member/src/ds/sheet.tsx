import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Grabber } from './layout';

const ease = Easing.bezier(...motion.easeOut);
// A settle with a touch of give, like the system sheets: no visible bounce, carries the finger's speed.
const SPRING = { damping: 34, stiffness: 340, mass: 0.9, overshootClamping: true };

interface Drag {
  /** The sheet's offset down from fully open, in points. */
  y: SharedValue<number>;
  /** Resting offsets, most open first. */
  detents: number[];
  /** Where the sheet goes when dragged closed, or null if it can't be closed (the Book map sheet). */
  closedAt: number | null;
  onClose?: () => void;
  onSnap?: (i: number) => void;
  /** How far the sheet's list is scrolled: a pull down only moves the sheet once the list is at its top. */
  scrollTop: React.RefObject<number>;
}

/**
 * Touch tracking for a bottom sheet. The finger moves the sheet 1:1 (with resistance past fully open),
 * and on release it springs to the nearest resting point, or closes, taking the flick's speed into account.
 * Claims vertical drags only, so taps and sideways scrolls inside the sheet still work.
 */
function useDrag(d: Drag) {
  const ref = useRef(d);
  useLayoutEffect(() => { ref.current = d; });
  const start = useRef(0);

  // The handlers read the refs only in touch callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const claim = (dy: number, dx: number) => {
      if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx) * 1.2) return false;
      const { y, detents, scrollTop } = ref.current;
      if (dy > 0) return (scrollTop.current ?? 0) <= 0;
      // Dragging up expands a sheet that isn't fully open; once it is, the list scrolls instead.
      return y.get() > detents[0] + 1;
    };
    const release = (vy: number) => {
      const { y, detents, closedAt, onClose, onSnap } = ref.current;
      const v = vy * 1000; // points per second
      const projected = y.get() + v * 0.12;
      const last = detents[detents.length - 1];
      if (closedAt != null && (projected > last + (closedAt - last) * 0.4 || (v > 1100 && y.get() > last))) {
        y.set(withTiming(closedAt, { duration: 220, easing: ease }, (done) => {
          if (done && onClose) runOnJS(onClose)();
        }));
        return;
      }
      let i = 0;
      detents.forEach((p, k) => { if (Math.abs(p - projected) < Math.abs(detents[i] - projected)) i = k; });
      y.set(withSpring(detents[i], { ...SPRING, velocity: v }));
      onSnap?.(i);
    };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => claim(g.dy, g.dx),
      onMoveShouldSetPanResponder: (_, g) => claim(g.dy, g.dx),
      onPanResponderGrant: () => {
        cancelAnimation(ref.current.y);
        start.current = ref.current.y.get();
      },
      onPanResponderMove: (_, g) => {
        const { y, detents } = ref.current;
        const next = start.current + g.dy;
        // Past fully open the sheet resists, the way a native sheet does.
        y.set(next < detents[0] ? detents[0] - Math.sqrt(detents[0] - next) * 3 : next);
      },
      onPanResponderRelease: (_, g) => release(g.vy),
      onPanResponderTerminate: (_, g) => release(g.vy),
      onPanResponderTerminationRequest: () => false,
    });
  });
  return pan;
}

const useScrollTop = () => {
  const top = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => { top.current = e.nativeEvent.contentOffset.y; };
  return [top, onScroll] as const;
};

/**
 * A phone sheet over a dimmed screen: slides up on open, follows the finger, and closes when dragged or
 * flicked down or when the backdrop is tapped. `scroll` puts the content in a list that hands a pull-down
 * at its top back to the sheet.
 */
export function ModalSheet({ children, onClose, behind, top, scroll, padding, style }: {
  children: ReactNode;
  onClose: () => void;
  /** Drawn under the backdrop (the photo behind a sheet). */
  behind?: ReactNode;
  /** Pins the sheet's top edge this far down (a tall sheet); otherwise it sizes to its content. */
  top?: number;
  scroll?: boolean;
  /** Padding inside the sheet, under the grabber. */
  padding?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const { height: screen } = useWindowDimensions();
  const [h, setH] = useState(0);
  const y = useSharedValue(screen);
  const [scrollTop, onScroll] = useScrollTop();
  const opened = useRef(false);
  const pan = useDrag({ y, detents: [0], closedAt: h || screen, onClose, scrollTop });

  const dismiss = () => {
    y.set(withTiming(h || screen, { duration: 220, easing: ease }, (done) => {
      if (done) runOnJS(onClose)();
    }));
  };
  useEffect(() => {
    if (!h || opened.current) return;
    opened.current = true;
    y.set(h);
    y.set(withTiming(0, { duration: motion.base, easing: ease }));
  }, [h, y]);

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, h || screen], [1, 0], 'clamp') }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {behind}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }, dim]}>
        <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, top, backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 }, style, sheet]}
        accessibilityViewIsModal
      >
        <Grabber />
        {scroll ? (
          <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={padding}>{children}</ScrollView>
        ) : (
          <View style={padding}>{children}</View>
        )}
      </Animated.View>
    </View>
  );
}

/**
 * A sheet that rests at several heights over a map, like Google Maps: `peek` shows just its header, `half`
 * the default, and full up to `gap` below the top of its parent. It never closes. The list inside only
 * scrolls once the sheet is fully open; until then dragging it moves the sheet.
 */
export function DetentSheet({ children, peek, half, gap, open, style, contentStyle }: {
  children: ReactNode;
  /** Visible height when collapsed. */
  peek: number;
  /** Visible share of the parent at the middle rest point. */
  half: number;
  /** Space left above the sheet when fully open (the search bar). */
  gap: number;
  /** Change it to bring a collapsed sheet up to `half` (a pin was tapped). */
  open?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [parent, setParent] = useState(0);
  // Which rest point the sheet is at; only "fully open" changes what renders (the list scrolls).
  const at = useRef(1);
  const [expanded, setExpanded] = useState(false);
  const [scrollTop, onScroll] = useScrollTop();
  const list = useRef<ScrollView>(null);
  const full = Math.max(0, parent - gap);
  const detents = [0, Math.max(0, full - parent * half), Math.max(0, full - peek)];
  const y = useSharedValue(detents[1]);
  const pan = useDrag({
    y, detents, closedAt: null, scrollTop,
    onSnap: (i) => {
      at.current = i;
      setExpanded(i === 0);
      if (i) list.current?.scrollTo({ y: 0, animated: true });
    },
  });

  // First measure, rotation or resize: rest where the member left it.
  useEffect(() => {
    if (parent) y.set(detents[at.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent]);
  useEffect(() => {
    if (!open || at.current !== 2) return;
    at.current = 1;
    y.set(withSpring(detents[1], SPRING));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 5, overflow: 'hidden' }]} onLayout={(e) => setParent(e.nativeEvent.layout.height)}>
      {parent ? (
        <Animated.View
          {...pan.panHandlers}
          style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height: full, backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, boxShadow: c.shadowFloat }, style, sheet]}
        >
          <Grabber />
          <ScrollView ref={list} scrollEnabled={expanded} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={contentStyle}>
            {children}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}
