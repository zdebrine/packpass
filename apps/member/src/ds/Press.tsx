import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ease = Easing.bezier(...motion.easeOut);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Extra style while hovered (web) or pressed. */
  activeStyle?: StyleProp<ViewStyle>;
  /** Press scale 0.97 at 140ms, per the design system. */
  scale?: boolean;
  children?: ReactNode;
}

export function Press({ style, activeStyle, scale = true, disabled, children, onPressIn, onPressOut, ...rest }: Props) {
  const s = useSharedValue(1);
  const [active, setActive] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={(e) => {
        if (scale) s.value = withTiming(motion.pressScale, { duration: motion.fast, easing: ease });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: motion.fast, easing: ease });
        onPressOut?.(e);
      }}
      onHoverIn={() => setActive(true)}
      onHoverOut={() => setActive(false)}
      style={[style, active && !disabled ? activeStyle : null, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
