import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { isLive } from '@/api/client';
import { catalog } from '@/data/catalog';
import type { Category, SessionType } from '@/data/types';
import { Chip, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Grabber, Screen, useTop } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { PhotoFill, Scrim } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { ClassRow } from '@/features/book/ClassRow';
import { MapSketch } from '@/features/MapSketch';
import { eligibility, sessionsFor, timeLabel, view, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { addMinutes, dayOffset, shortDay } from '@/lib/dates';
import { useApp, useDog, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const CATS: Category[] = ['Sport', 'Scent', 'Play', 'Skills'];
const TYPES: SessionType[] = ['Class', 'Private', 'Assessment'];
const HERO_CLASS = 'herding-livestock';
// The map is a drawn sketch with pins placed for the five sample partners, so it only shows on sample data.
// Live members get the list until a real map (react-native-maps and partner coordinates) is built.
const MAP = !isLive;

function Segmented({ value, onChange, float }: { value: 'List' | 'Map'; onChange: (v: 'List' | 'Map') => void; float?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 9999, backgroundColor: float ? c.bg : c.surfaceRaised, boxShadow: float ? c.shadowFloat : undefined }}>
      {(['List', 'Map'] as const).map((m) => (
        <Press
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === m }}
          style={{ height: float ? 44 : 36, paddingHorizontal: float ? 14 : 16, borderRadius: 9999, justifyContent: 'center', backgroundColor: value === m ? c.inverse : 'transparent' }}
        >
          <Text variant="label" color={value === m ? c.onInverse : c.ink}>{m}</Text>
        </Press>
      ))}
    </View>
  );
}

/** 03 Book · list and 04 Book · map */
export default function Book() {
  useOriginLabel(); // re-render when distances are measured from somewhere new
  const { c } = useTheme();
  const top = useTop();
  const [mode, setMode] = useState<'List' | 'Map'>('List');
  const [cat, setCat] = useState<Category>('Sport');
  const [day, setDay] = useState(0);
  const [types, setTypes] = useState<SessionType[]>([]);
  const [fits, setFits] = useState(true);
  const [query, setQuery] = useState('');
  const [partnerId, setPartnerId] = useState('ridgeline');
  const sociability = useApp((s) => s.draft.social);
  const rules = useRules();
  const dog = useDog();

  const fitsDog = (v: SessionView) => !(sociability === 'Prefers solo' && v.cls.sessionType === 'Class' && v.cls.groupSize > 1);
  const q = query.trim().toLowerCase();
  const matches = (v: SessionView) =>
    (!types.length || types.includes(v.cls.sessionType)) &&
    (!fits || fitsDog(v)) &&
    (!q || [v.cls.title, v.partner.name, v.trainer.name, v.cls.discipline].some((s) => s.toLowerCase().includes(q)));

  const all = sessionsFor(cat, day).filter(matches);
  const hero = all.find((v) => v.cls.id === HERO_CLASS);
  const list = all.filter((v) => v.cls.id !== HERO_CLASS);
  const count = all.length;
  const dayLabel = day === 0 ? 'Today' : shortDay(addMinutes(now(), day * 1440));

  // Map: every session at each partner on the selected day, any category.
  const byPartner = useMemo(() => {
    const m: Record<string, SessionView[]> = {};
    catalog.sessions.filter((s) => dayOffset(s.startsAt) === day).forEach((s) => {
      const v = view(s.id)!;
      (m[v.partner.id] ??= []).push(v);
    });
    Object.values(m).forEach((l) => l.sort((a, b) => +a.session.startsAt - +b.session.startsAt));
    return m;
  }, [day]);

  if (MAP && mode === 'Map') {
    const p = catalog.partners[partnerId] ?? Object.values(catalog.partners)[0];
    const here = byPartner[partnerId] ?? [];
    const PINS: { id: string; left: number; top: number; label: (n: number) => string }[] = [
      { id: 'northside', left: 52, top: 196, label: (n) => `${n} classes` },
      { id: 'southfork', left: 236, top: 262, label: (n) => `${n} ${n === 1 ? 'class' : 'classes'}` },
      { id: 'eastfield', left: 264, top: 150, label: () => 'Open field' },
      { id: 'ridgeline', left: 128, top: 318, label: (n) => `${n} classes` },
      { id: 'eastside', left: 40, top: 420, label: (n) => `${n} classes` },
    ];
    return (
      <Screen bleed>
        <MapSketch variant="full" style={{ flex: 1 }}>
          <View style={{ position: 'absolute', left: 180, top: 246, width: 16, height: 16, borderRadius: 9999, backgroundColor: c.ink, boxShadow: `0 0 0 5px rgba(14,15,14,0.14), inset 0 0 0 2px ${c.bg}` }} accessibilityLabel="You are here" />
          {PINS.filter((pin) => catalog.partners[pin.id]).map((pin) => {
            const n = byPartner[pin.id]?.length ?? 0;
            const on = pin.id === partnerId;
            return (
              <Press key={pin.id} onPress={() => setPartnerId(pin.id)} accessibilityLabel={`${catalog.partners[pin.id].name}, ${n} sessions`} style={{ position: 'absolute', left: pin.left, top: pin.top, alignItems: 'center' }}>
                <View style={{ height: on ? 40 : 32, paddingHorizontal: on ? 16 : 12, borderRadius: 9999, backgroundColor: on ? c.inverse : c.bg, boxShadow: c.shadowFloat, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {on ? <Icon name="map-pin" size={16} color={c.onInverse} /> : null}
                  <Text variant={on ? 'label' : 'caption'} weight="600" color={on ? c.onInverse : c.ink} style={on ? null : { fontSize: 13 }}>
                    {on ? `${catalog.partners[pin.id].short} · ${n}` : pin.label(n)}
                  </Text>
                </View>
                {on ? <View style={{ width: 10, height: 10, backgroundColor: c.inverse, transform: [{ rotate: '45deg' }], marginTop: -6 }} /> : null}
              </Press>
            );
          })}
          <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', gap: 8 }}>
            <Press onPress={() => setMode('List')} style={{ flex: 1, height: 52, borderRadius: 9999, backgroundColor: c.bg, boxShadow: c.shadowFloat, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
              <Icon name="search" color={c.inkMuted} />
              <Text color={c.inkMuted}>{`${dayLabel} · ${cat}`}</Text>
            </Press>
            <Segmented value="Map" onChange={setMode} float />
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '48%', backgroundColor: c.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, boxShadow: c.shadowFloat }}>
            <Grabber />
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
              <Text variant="wide" muted>{`${dayLabel} · ${p.distanceMi} mi · ${p.street}`}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Text variant="displayLg" style={{ flex: 1 }}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="star" size={16} />
                  <Text variant="label" num>{p.rating.toFixed(1)}</Text>
                </View>
              </View>
              <View style={{ gap: 14, marginTop: 18 }}>
                {here.length ? here.map((v) => <ClassRow key={v.session.id} v={v} showPartnerAsCoach />) : <Text muted>Nothing on this day.</Text>}
              </View>
            </ScrollView>
          </View>
        </MapSketch>
      </Screen>
    );
  }

  const heroEl = hero ? eligibility(hero, rules, dog.name) : null;

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="displayXl" accessibilityRole="header">Book</Text>
          {MAP ? <Segmented value="List" onChange={setMode} /> : null}
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <Field value={query} onChangeText={setQuery} placeholder="Search classes, trainers, places" left={<Icon name="search" color={c.inkMuted} />} returnKeyType="search" />
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 9999, backgroundColor: c.surfaceRaised }}>
            {CATS.map((k) => (
              <Press key={k} onPress={() => setCat(k)} accessibilityRole="tab" accessibilityState={{ selected: cat === k }} style={{ flex: 1, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: cat === k ? c.inverse : 'transparent' }}>
                <Text variant="label" weight="600" color={cat === k ? c.onInverse : c.ink}>{k}</Text>
              </Press>
            ))}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {Array.from({ length: 7 }, (_, d) => (
            <Chip key={d} selected={day === d} onPress={() => setDay(d)}>{d === 0 ? 'Today' : shortDay(addMinutes(now(), d * 1440))}</Chip>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          <Chip selected={fits} onPress={() => setFits((f) => !f)}>{`Fits ${dog.name}`}</Chip>
          {TYPES.map((t) => (
            <Chip key={t} selected={types.includes(t)} onPress={() => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}>{t}</Chip>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, marginTop: 28, marginBottom: 16 }}>
          <Text variant="title">{`${dayLabel} near you`}</Text>
          <Text variant="caption" muted>{count === 1 ? '1 session' : `${count} sessions`}</Text>
        </View>

        {hero ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Press onPress={() => router.push(`/class/${hero.session.id}`)} accessibilityLabel={hero.cls.title} style={{ height: 220, borderRadius: 28, overflow: 'hidden' }}>
              <PhotoFill name={hero.cls.image} />
              <Scrim />
              <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                {hero.cls.premium ? <Tag tone="premium">Premium</Tag> : <View />}
                <Tag tone="glass">{`${hero.cls.credits} credits`}</Tag>
              </View>
              <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
                <Text variant="displayMd" color="#fff">{hero.cls.title}</Text>
                <Text style={{ fontSize: 13, lineHeight: 18, marginTop: 6 }} color="rgba(255,255,255,0.85)">
                  {[timeLabel(hero), `${hero.cls.durationMin} min`, hero.partner.name, `${hero.partner.distanceMi} mi`, hero.session.spotsLeft === 0 ? 'Full. Waitlist open' : hero.session.spotsLeft === 1 ? 'Last spot' : `${hero.session.spotsLeft} spots left`].join(' · ')}
                </Text>
                {heroEl && !heroEl.ok ? <View style={{ marginTop: 10, flexDirection: 'row' }}><Tag tone="glass" icon="shield">{heroEl.needs === 'herding' ? 'Needs assessment' : heroEl.needs === 'social' ? 'Needs Social' : 'Vaccines due'}</Tag></View> : null}
              </View>
            </Press>
          </View>
        ) : null}

        <View style={{ gap: 16, paddingHorizontal: 20 }}>
          {list.map((v) => <ClassRow key={v.session.id} v={v} />)}
          {count === 0 ? <Text muted>Nothing matches these filters. Clear one to see more.</Text> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
