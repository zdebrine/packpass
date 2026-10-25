import { router } from 'expo-router';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { errorCopy } from '@/api/errors';
import { drillById } from '@/data/practice';
import type { ReportCard } from '@/data/types';
import { Icon } from '@/ds/Icon';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { now } from '@/lib/clock';
import { weekday } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** The dog's newest report card with homework still open (until its next class starts). */
export const useOpenHomework = (dogId: string) =>
  useApp((s) => s.reportCards.find((r) => r.dogId === dogId && r.homework.length > 0 && r.openUntil > now()) ?? null);

/** "until Saturday" while the next class is within a week, else "until Oct 18". */
export const untilLabel = (r: ReportCard) => `until ${r.openUntil.getTime() - now().getTime() < 6 * 86_400_000 ? `next ${weekday(r.openUntil)}` : r.openUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

export const firstName = (name: string | null) => (name ? name.split(' ')[0] : 'your trainer');

/**
 * The homework checklist (22a after class, 22b Today). Ticking an item logs it to the dog's Log as practice; a drill
 * item also opens that drill, step by step.
 */
export function HomeworkList({ card, style }: { card: ReportCard; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const tick = useApp((s) => s.tickHomework);
  const [error, setError] = useState<string | null>(null);
  const toggle = (i: number) => {
    setError(null);
    tick(card.bookingId, i, !card.done.includes(i)).catch((e) => setError(errorCopy(e)));
  };
  return (
    <View style={style}>
      {card.homework.map((h, i) => {
        const done = card.done.includes(i);
        const drill = h.drill ? drillById(h.drill) : undefined;
        return (
          <View key={`${i}-${h.text}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, boxShadow: i ? `inset 0 1px 0 ${c.line}` : undefined }}>
            <Press onPress={() => toggle(i)} scale={false} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={h.text}
              style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.ink : 'transparent',
                boxShadow: done ? undefined : `inset 0 0 0 1.5px ${c.lineStrong}` }}>
                {done ? <Icon name="check" size={16} color={c.bg} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="label" color={done ? c.inkMuted : c.ink} style={done ? { textDecorationLine: 'line-through' } : null}>{h.text}</Text>
                {drill ? <Text variant="caption" muted>{`${drill.setting} · ${drill.minutes} min`}</Text> : null}
              </View>
            </Press>
            {drill ? (
              <Press onPress={() => router.push(`/practice/${drill.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${drill.title}`}
                style={{ width: 52, height: 44, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <Photo name={drill.image} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <View style={{ width: 24, height: 24, borderRadius: 9999, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={12} color="#fff" />
                </View>
              </Press>
            ) : null}
          </View>
        );
      })}
      {error ? <Text variant="caption" color={c.kennelRed} style={{ marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

/** Today's homework section (22b): from the dog's newest report card, until its next class. */
export function HomeworkSection({ dogId, dogName, style }: { dogId: string; dogName: string; style?: StyleProp<ViewStyle> }) {
  const card = useOpenHomework(dogId);
  if (!card) return null;
  return (
    <View style={style}>
      <Press onPress={() => router.push(`/after-class/${card.bookingId}`)} scale={false} accessibilityRole="button" accessibilityLabel={`Homework from ${firstName(card.trainer)}. See the note`}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <Text variant="title">{`Homework from ${firstName(card.trainer)}`}</Text>
        <Text variant="caption" muted>{`${card.done.length} of ${card.homework.length} done`}</Text>
      </Press>
      <HomeworkList card={card} />
      <Text variant="caption" muted>{`Ticked items go to ${dogName}'s Log. The list clears ${card.openUntil.getTime() - now().getTime() < 6 * 86_400_000 ? `after ${weekday(card.openUntil)}'s class` : 'at the next class'}.`}</Text>
    </View>
  );
}
