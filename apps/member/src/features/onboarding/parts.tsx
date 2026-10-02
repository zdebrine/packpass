import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { IconButton } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { useTheme } from '@/theme/ThemeProvider';

const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

export function BackButton() {
  return <IconButton icon="chevron-left" label="Back" onPress={back} />;
}

/** Back button plus the 5-step progress bar (01e to 01i). */
export function StepHeader({ step, showBack = true }: { step: number; showBack?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: showBack ? 6 : 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {showBack ? <BackButton /> : null}
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 9999, backgroundColor: i < step ? c.ink : c.surfaceSunken }} />
        ))}
      </View>
    </View>
  );
}

export function Intro({ eyebrow, title, lede, titleSize }: { eyebrow: string; title: string; lede?: string; titleSize?: number }) {
  return (
    <View>
      <Text variant="wide" muted>{eyebrow}</Text>
      <Text variant="displayLg" style={[{ marginTop: 10 }, titleSize ? { fontSize: titleSize, lineHeight: titleSize } : null]}>{title}</Text>
      {lede ? <Text muted style={{ marginTop: 10 }}>{lede}</Text> : null}
    </View>
  );
}

export function Body({ children, gap = 22, top = 22 }: { children: ReactNode; gap?: number; top?: number }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: top, paddingHorizontal: 20, paddingBottom: 20, gap }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function FieldGroup({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label" weight="600">{label}</Text>
      {children}
      {note ? <Text variant="caption" muted>{note}</Text> : null}
    </View>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

/** Pill that opens an inline list of options. */
export function Select<T extends string | number>({ value, label, options, onPick }: { value: T; label: string; options: T[]; onPick: (v: T) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Press
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={{ height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text>{String(value)}</Text>
        <Icon name="chevron-down" size={18} color={c.inkMuted} />
      </Press>
      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {options.map((o) => (
            <Chip key={o} selected={o === value} onPress={() => { onPick(o); setOpen(false); }}>{String(o)}</Chip>
          ))}
        </View>
      ) : null}
    </View>
  );
}

