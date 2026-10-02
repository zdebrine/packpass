import { StyleSheet, View } from 'react-native';

import type { PhotoKey, PhotoSource } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';
import { Tag } from './controls';
import { Press } from './Press';
import { Glass, Gradient, Photo, PhotoFill, Scrim } from './Surface';
import { Text } from './Text';

const spotsCopy = (n: number) => (n === 0 ? 'Full. Waitlist open' : n === 1 ? 'Last spot' : `${n} spots left`);
const creditLabel = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`;

// ---- ClassCard -----------------------------------------------------------------------------

export interface ClassCardProps {
  layout?: 'tile' | 'row';
  image: PhotoKey;
  discipline?: string;
  premium?: boolean;
  title: string;
  partner?: string;
  place?: string;
  time?: string;
  duration?: string;
  credits: number;
  spotsLeft?: number;
  onPress?: () => void;
}

export function ClassCard({ layout = 'tile', image, discipline, premium, title, partner, place, time, duration, credits, spotsLeft, onPress }: ClassCardProps) {
  const { c } = useTheme();
  const hasSpots = typeof spotsLeft === 'number';
  const low = hasSpots && spotsLeft! <= 2;
  const dot = () => <View style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: low ? '#ff7a62' : c.agility }} />;

  if (layout === 'row') {
    return (
      <Press onPress={onPress} scale={!!onPress} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }} accessibilityLabel={title}>
        <View style={{ width: 88, height: 88, borderRadius: radius.tile, overflow: 'hidden', backgroundColor: c.surfaceSunken }}>
          <Photo name={image} style={StyleSheet.absoluteFill} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.meta} color={c.inkMuted}>{[time, duration].filter(Boolean).join(' · ')}</Text>
          <Text style={[styles.title, { fontSize: 18, lineHeight: 20, marginTop: 4 }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.meta, { marginTop: 6 }]} color={c.inkMuted} numberOfLines={1}>{[partner, place].filter(Boolean).join(' · ')}</Text>
          {hasSpots ? (
            <View style={styles.spots}>
              {dot()}
              <Text variant="caption" weight="600">{spotsCopy(spotsLeft!)}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 20 }}>{credits}</Text>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 14 }} color={c.inkMuted}>{credits === 1 ? 'credit' : 'credits'}</Text>
        </View>
      </Press>
    );
  }

  return (
    <Press onPress={onPress} style={{ width: 260, height: 320, borderRadius: radius.card, overflow: 'hidden', backgroundColor: c.surfaceSunken }} accessibilityLabel={title}>
      <PhotoFill name={image} />
      <Scrim />
      <View style={styles.tileTop}>
        <View>{premium ? <Tag tone="premium">Premium</Tag> : discipline ? <Tag tone="glass">{discipline}</Tag> : null}</View>
        <Tag tone="glass">{creditLabel(credits)}</Tag>
      </View>
      <View style={styles.tileBody}>
        <Text style={[styles.title, { color: '#fff' }]}>{title}</Text>
        <Text style={[styles.meta, { marginTop: 6 }]} color="rgba(255,255,255,0.82)">{[time, partner, place].filter(Boolean).join(' · ')}</Text>
        {hasSpots ? (
          <View style={[styles.spots, { marginTop: 10 }]}>
            {dot()}
            <Text variant="caption" weight="600" color="#fff">{spotsCopy(spotsLeft!)}</Text>
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
}

export function AthleteCard({ name, photo, breed, age, stage, since, streak, stats = [], compact }: AthleteCardProps) {
  const { c } = useTheme();
  const sub = [breed, age, stage].filter(Boolean).join(' · ');
  const streakTag = streak ? <Tag tone="signal">{`${streak} day streak`}</Tag> : null;

  if (compact) {
    return (
      <View style={{ minHeight: 108, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius.card, backgroundColor: c.surfaceRaised }}>
        <View style={{ width: 84, height: 84, borderRadius: radius.tile, overflow: 'hidden', backgroundColor: c.pitch, alignItems: 'center', justifyContent: 'center' }}>
          {photo ? <PhotoFill name={photo} /> : <Text style={{ fontFamily: fonts.wideBold, fontSize: 44, color: 'rgba(255,255,255,0.5)' }}>{name.charAt(0)}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.84 }}>{name}</Text>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, marginTop: 4 }} color={c.inkMuted}>{sub}</Text>
        </View>
        <View style={{ alignSelf: 'flex-start' }}>{streakTag}</View>
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
        <Text style={{ fontFamily: fonts.display, fontSize: 64, lineHeight: 60, letterSpacing: -1.92, color: '#fff' }} numberOfLines={1} adjustsFontSizeToFit>{name}</Text>
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
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 25, letterSpacing: -0.48 },
  meta: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  spots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  tileTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tileBody: { position: 'absolute', left: 18, right: 18, bottom: 18 },
});
