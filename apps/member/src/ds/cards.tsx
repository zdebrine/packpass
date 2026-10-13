import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PhotoSource } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';
import { StatusBadge, Tag } from './controls';
import { Press } from './Press';
import { Glass, Gradient, Photo, PhotoFill } from './Surface';
import { Text } from './Text';

const spotsCopy = (n: number) => (n === 0 ? 'Full. Waitlist open' : n === 1 ? 'Last spot' : `${n} spots left`);
const creditLabel = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`;

// ---- ClassCard -----------------------------------------------------------------------------

export interface ClassCardProps {
  layout?: 'tile' | 'row';
  image: PhotoSource;
  discipline?: string;
  premium?: boolean;
  /** Owners leave the dog with the trainer (tile layout; Book's rows show it as a pill). */
  dropOff?: boolean;
  title: string;
  partner?: string;
  place?: string;
  time?: string;
  duration?: string;
  credits: number;
  spotsLeft?: number;
  onPress?: () => void;
}

export function ClassCard({ layout = 'tile', image, discipline, premium, dropOff, title, partner, place, time, duration, credits, spotsLeft, onPress }: ClassCardProps) {
  const { c } = useTheme();
  const hasSpots = typeof spotsLeft === 'number';
  const low = hasSpots && spotsLeft! <= 2;
  const dot = () => <View style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: low ? '#ff7a62' : c.agility }} />;

  if (layout === 'row') {
    return (
      <Press onPress={onPress} scale={!!onPress} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }} accessibilityLabel={title}>
        <View style={{ width: 64, height: 64, borderRadius: radius.thumb, overflow: 'hidden', backgroundColor: c.surfaceSunken }}>
          <Photo name={image} style={StyleSheet.absoluteFill} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="heading" numberOfLines={2}>{title}</Text>
          <Text variant="caption" muted numberOfLines={1}>{[time, duration, partner, place].filter(Boolean).join(' · ')}</Text>
          {hasSpots ? <Text variant="caption" color={spotsLeft! <= 1 ? c.kennelRed : c.inkMuted}>{spotsCopy(spotsLeft!)}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text variant="heading" weight="600" num>{credits}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, lineHeight: 14 }} color={c.inkMuted}>{credits === 1 ? 'credit' : 'credits'}</Text>
        </View>
      </Press>
    );
  }

  return (
    <Press onPress={onPress} style={{ width: 232, height: 280, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: c.surfaceSunken }} accessibilityLabel={title}>
      <PhotoFill name={image} />
      <Gradient stops={[['rgba(0,0,0,0.18)', 0], ['rgba(0,0,0,0)', 0.3], ['rgba(0,0,0,0)', 0.45], ['rgba(0,0,0,0.66)', 1]]} />
      <View style={styles.tileTop}>
        <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1 }}>
          {premium ? <Tag tone="premium">Premium</Tag> : discipline ? <Tag tone="glass">{discipline}</Tag> : null}
          {dropOff ? <Tag tone="glass">Drop-off</Tag> : null}
        </View>
        <Tag tone="glass">{creditLabel(credits)}</Tag>
      </View>
      <View style={styles.tileBody}>
        <Text variant="title" color="#fff">{title}</Text>
        <Text variant="caption" color="rgba(255,255,255,0.84)">{[time, partner, place].filter(Boolean).join(' · ')}</Text>
        {hasSpots ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {dot()}
            <Text variant="caption" weight="500" color="#fff">{spotsCopy(spotsLeft!)}</Text>
          </View>
        ) : null}
      </View>
    </Press>
  );
}

// ---- AthleteCard ---------------------------------------------------------------------------

export interface AthleteCardProps {
  name: string;
  photo?: PhotoSource;
  breed?: string;
  age?: string;
  stage?: string;
  since?: number;
  streak?: number;
  stats?: { value: number | string; label: string }[];
  compact?: boolean;
  /** Compact only: replaces the streak badge (Today puts the credit count here). */
  trailing?: ReactNode;
}

export function AthleteCard({ name, photo, breed, age, stage, since, streak, stats = [], compact, trailing }: AthleteCardProps) {
  const { c } = useTheme();
  const sub = [breed, age, stage].filter(Boolean).join(' · ');
  const streakTag = streak ? <Tag tone="signal">{`${streak} day streak`}</Tag> : null;

  if (compact) {
    return (
      <View style={{ height: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingRight: 12, borderRadius: radius.card, backgroundColor: c.surfaceRaised }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.thumb, overflow: 'hidden', backgroundColor: c.pitch, alignItems: 'center', justifyContent: 'center' }}>
          {photo ? <PhotoFill name={photo} /> : <Text style={{ fontFamily: fonts.wideBold, fontSize: 28, color: 'rgba(255,255,255,0.5)' }}>{name.charAt(0)}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 24, letterSpacing: -0.44 }} numberOfLines={1}>{name}</Text>
          {sub ? <Text variant="caption" muted style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {trailing ?? (streak ? <StatusBadge tone="signal">{`${streak} day streak`}</StatusBadge> : null)}
      </View>
    );
  }

  return (
    <View style={{ width: 320, height: 460, borderRadius: radius.card, overflow: 'hidden', backgroundColor: c.pitch, boxShadow: c.shadowCard }}>
      {photo ? (
        <PhotoFill name={photo} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontFamily: fonts.wideBold, fontSize: 180, lineHeight: 200, color: 'rgba(255,255,255,0.12)' }}>{name.charAt(0)}</Text>
        </View>
      )}
      <Gradient stops={[['rgba(0,0,0,0.28)', 0], ['rgba(0,0,0,0)', 0.22], ['rgba(0,0,0,0)', 0.42], ['rgba(0,0,0,0.78)', 1]]} />
      <View style={{ position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tag tone="glass">{since ? `Member since ${since}` : 'PackPass athlete'}</Tag>
        {streakTag}
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 52, letterSpacing: -1.68, color: '#fff' }} numberOfLines={1} adjustsFontSizeToFit>{name}</Text>
        <Text variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 8 }}>{sub}</Text>
        {stats.length ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {stats.map((s) => (
              <Glass key={s.label} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: '#fff', fontVariant: ['tabular-nums'] }}>{s.value}</Text>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 14, marginTop: 2 }} color="rgba(255,255,255,0.78)">{s.label}</Text>
              </Glass>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tileTop: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  tileBody: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 },
});
