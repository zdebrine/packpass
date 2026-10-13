import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import type { PhotoSource } from '@/data/types';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { BackButton, Progress } from '@/features/onboarding/parts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Desktop frame for sign-up, sign-in, verify and the onboarding steps (01b to 01j in Pack Member App Desktop):
 * a photo half with the wordmark and "Make your dog a good hang.", and a form half with a 480 column that starts
 * with the back button and the 5-step progress bars. The step's buttons sit at the end of the column.
 */
export function Split({ photo, step, back = true, gap = 22, children }: { photo: PhotoSource; step?: number; back?: boolean; gap?: number; children: ReactNode }) {
  const { c } = useTheme();
  const header = back || step;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, overflow: 'hidden', backgroundColor: '#0e0f0e' }}>
        <PhotoFill name={photo} />
        <Gradient stops={[['rgba(0,0,0,0.42)', 0], ['rgba(0,0,0,0)', 0.22], ['rgba(0,0,0,0)', 0.55], ['rgba(0,0,0,0.66)', 1]]} />
        <Text variant="wide" weight="700" color="#fff" style={{ position: 'absolute', top: 36, left: 40, fontSize: 15, lineHeight: 18 }}>PackPass</Text>
        <Text variant="displayXl" color="#fff" accessibilityRole="header" style={{ position: 'absolute', left: 40, right: 40, bottom: 40 }}>Make your dog a good hang.</Text>
      </View>
      <ScrollView
        style={{ flexGrow: 1, flexShrink: 1, flexBasis: 520, minWidth: 0 }}
        contentContainerStyle={{ paddingTop: 36, paddingHorizontal: 48, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 24 }}>
          {header ? (
            <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {back ? <BackButton /> : null}
              {step ? <Progress step={step} /> : null}
            </View>
          ) : null}
          <View style={{ gap }}>{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}
