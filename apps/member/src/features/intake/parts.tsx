import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IntakeSpecialist } from '@/data/types';
import { StatusBadge } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { now } from '@/lib/clock';
import { time, weekday } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

export const firstName = (name: string | null | undefined) => (name ? name.split(' ')[0] : 'your specialist');

/** "Thursday 12:30 pm" for a call, or the day only past the next week. */
export const callTime = (d: Date) => `${weekday(d)} ${time(d)}`;

/** A raised notice with an icon: what the specialist sees, who stays, the cancel window. */
export function Notice({ icon, title, body }: { icon: IconName; title: string; body?: string | null }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, backgroundColor: c.surfaceRaised }}>
      <Icon name={icon} size={18} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text variant="label" weight="600">{title}</Text>
        {body ? <Text variant="caption" muted>{body}</Text> : null}
      </View>
    </View>
  );
}

/** Two-column facts: When, Where, Length, Credits. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.line }}>
      {items.map(([k, v]) => (
        <View key={k} style={{ width: '50%', paddingVertical: 12, paddingRight: 12, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: c.line }}>
          <Text variant="caption" muted>{k}</Text>
          <Text variant="label" weight="600">{v}</Text>
        </View>
      ))}
    </View>
  );
}

/** A specialist's photo, name and line. */
export function SpecialistRow({ sp, sub }: { sp: Pick<IntakeSpecialist, 'name' | 'photo'>; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Photo name={sp.photo} style={{ width: 48, height: 48, borderRadius: 9999 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="heading">{sp.name}</Text>
        <Text variant="caption" muted>{sub}</Text>
      </View>
    </View>
  );
}

/** Book › Skills › "1:1 with a specialist": each specialist, starting with a free intake call (23a). */
export function SpecialistGroup({ dogId }: { dogId: string }) {
  const { c } = useTheme();
  const specialists = useApp((s) => s.intake.specialists);
  const calls = useApp((s) => s.intake.calls);
  const shown = specialists.filter((sp) => sp.calendly || sp.slots.length || calls.some((x) => x.trainerId === sp.trainerId));
  if (!shown.length) return null;
  return (
    <View style={{ minWidth: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Text variant="label" weight="600" style={{ flex: 1 }} numberOfLines={1}>1:1 with a specialist</Text>
        <Text variant="caption" muted>Starts with a free intake call</Text>
      </View>
      {shown.map((sp, i) => {
        const booked = calls.find((x) => x.trainerId === sp.trainerId && x.dogId === dogId && x.status === 'booked' && (!x.startsAt || x.startsAt > now()));
        return (
          <Press key={sp.trainerId} onPress={() => router.push(`/intake/${sp.trainerId}`)} scale={false} accessibilityRole="button" accessibilityLabel={`Intake call with ${sp.name}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0, borderTopColor: c.line }}>
            <Photo name={sp.photo} style={{ width: 44, height: 44, borderRadius: 9999 }} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="heading">{sp.name}</Text>
              <Text variant="caption" muted numberOfLines={2}>{[sp.focus ? sp.focus.charAt(0).toUpperCase() + sp.focus.slice(1) : null, sp.partner].filter(Boolean).join(' · ')}</Text>
            </View>
            {booked?.startsAt ? <StatusBadge tone="cleared">{`${weekday(booked.startsAt).slice(0, 3)} ${time(booked.startsAt)}`}</StatusBadge> : <StatusBadge>0 credits</StatusBadge>}
            <Icon name="chevron-right" size={18} color={c.inkMuted} />
          </Press>
        );
      })}
    </View>
  );
}
