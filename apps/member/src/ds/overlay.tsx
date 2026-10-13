import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, SlideInRight } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { web } from './responsive';

interface Props {
  children: ReactNode;
  onClose: () => void;
  /** `dialog`: a centered card (booking, check-in). `panel`: a full-height drawer on the right (notifications, clearances). */
  kind?: 'dialog' | 'panel';
  width: number;
  /** Backdrop darkness: .4 over the app, .6 behind the dark celebration and check-in dialogs. */
  dim?: number;
  /** Space above a dialog (the booking dialog sits lower than the photo dialogs). */
  top?: number;
  /** The card scrolls itself; pass false when the child fills a fixed-height card (the scanner). */
  scroll?: boolean;
  /** Fixed card height, e.g. the scanner's min(760px, 100%). */
  height?: ViewStyle['height'];
  cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Desktop stand-in for the phone's bottom sheets and full-screen modals: the page stays put under a
 * dimmed backdrop, clicking the backdrop or pressing Escape closes.
 */
export function Overlay({ children, onClose, kind = 'dialog', width, dim = 0.4, top = 40, scroll = true, height, cardStyle }: Props) {
  const { c } = useTheme();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const body = scroll ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView> : children;
  return (
    <View style={web({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 })} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(motion.base)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `rgba(0,0,0,${dim})` }}>
        <Pressable style={web({ flex: 1, cursor: 'default' })} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      {kind === 'panel' ? (
        <Animated.View
          entering={SlideInRight.duration(motion.base).easing(Easing.bezier(...motion.easeOut))}
          style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: width, backgroundColor: c.bg, boxShadow: c.shadowFloat }, cardStyle]}
        >
          {body}
        </Animated.View>
      ) : (
        <View pointerEvents="box-none" style={{ flex: 1, paddingTop: top, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' }}>
          <Animated.View
            entering={FadeIn.duration(motion.base)}
            style={[{ width: '100%', maxWidth: width, maxHeight: '100%', height, borderRadius: 24, overflow: 'hidden', backgroundColor: c.bg, boxShadow: c.shadowFloat }, cardStyle]}
          >
            {body}
          </Animated.View>
        </View>
      )}
    </View>
  );
}
