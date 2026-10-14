import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { catalog } from '@/data/catalog';
import type { Category, SessionType } from '@/data/types';
import { Chip, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Screen, useTop } from '@/ds/layout';
import { DetentSheet } from '@/ds/sheet';
import { Press } from '@/ds/Press';
import { col, Page, useWide } from '@/ds/responsive';
import { PhotoFill, Scrim } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { ClassRow } from '@/features/book/ClassRow';
import { centerOf, Map, useMe } from '@/features/Map';
import { eligibility, sessionsFor, timeLabel, view, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { addMinutes, dayOffset, shortDay } from '@/lib/dates';
import { useApp, useDog, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const CATS: Category[] = ['Sport', 'Scent', 'Play', 'Skills'];
const TYPES: SessionType[] = ['Class', 'Private', 'Assessment'];
const HERO_CLASS = 'herding-livestock';

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

/** Desktop List/Map control: taller, with icons. */
function WideSegmented({ value, onChange }: { value: 'List' | 'Map'; onChange: (v: 'List' | 'Map') => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 9999, backgroundColor: c.surfaceRaised }}>
      {(['List', 'Map'] as const).map((m) => {
        const fg = value === m ? c.onInverse : c.ink;
        return (
          <Press
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === m }}
            style={{ height: 40, paddingHorizontal: 18, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: value === m ? c.inverse : 'transparent' }}
          >
            <Icon name={m === 'List' ? 'list' : 'map'} size={16} color={fg} />
            <Text variant="label" weight="600" color={fg}>{m}</Text>
          </Press>
        );
      })}
    </View>
  );
}

const pinLabel = (id: string, n: number) => (id === 'eastfield' ? 'Open field' : `${n} ${n === 1 ? 'class' : 'classes'}`);
/** Partners with coordinates, as map pins. */
const partnerPins = () => Object.values(catalog.partners).filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, title: p.name }));

/** Book's label pin: a pill with the class count, the picked partner in ink with a pointer under it. */
function LabelPin({ label, on, onPress, a11y }: { label: string; on: boolean; onPress: () => void; a11y: string }) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={a11y} style={{ alignItems: 'center', marginBottom: on ? 34 : 0 }}>
      <View style={{ height: on ? 40 : 32, paddingHorizontal: on ? 16 : 12, borderRadius: 9999, backgroundColor: on ? c.inverse : c.bg, boxShadow: c.shadowFloat, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {on ? <Icon name="map-pin" size={16} color={c.onInverse} /> : null}
        <Text variant={on ? 'label' : 'caption'} weight="600" color={on ? c.onInverse : c.ink} numberOfLines={1}>{label}</Text>
      </View>
      {on ? <View style={{ width: 10, height: 10, backgroundColor: c.inverse, transform: [{ rotate: '45deg' }], marginTop: -6 }} /> : null}
    </Press>
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
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [partnerId, setPartnerId] = useState(() => (catalog.partners.ridgeline ? 'ridgeline' : Object.keys(catalog.partners)[0]));
  // Tapping a pin brings a collapsed map sheet back up.
  const [opened, setOpened] = useState(0);
  const sociability = useApp((s) => s.draft.social);
  const rules = useRules();
  const dog = useDog();
  const wide = useWide();
  const me = useMe();
  const pins = partnerPins();
  const [gridW, setGridW] = useState(0);

  const fitsDog = (v: SessionView) => !(sociability === 'Prefers solo' && v.cls.sessionType === 'Class' && v.cls.groupSize > 1);
  const q = query.trim().toLowerCase();
  const matches = (v: SessionView) =>
    (!types.length || types.includes(v.cls.sessionType)) &&
    (!fits || fitsDog(v)) &&
    (!q || [v.cls.title, v.partner.name, v.trainer.name, v.cls.discipline].some((s) => s.toLowerCase().includes(q)));

  // Classes the dog is outside of (age, size, spayed or neutered) hide while "Fits" is on, with a line saying so.
  const notFor = (v: SessionView) => { const e = eligibility(v, rules, dog.name); return !e.ok && e.needs === 'fit' ? e.label : null; };
  const inDay = sessionsFor(cat, day).filter(matches);
  const outside = fits ? inDay.filter((v) => notFor(v)) : [];
  const all = showHidden ? inDay : inDay.filter((v) => !outside.includes(v));
  const outsideClasses = [...new Set(outside.map((v) => v.cls.id))];
  const outsideWhy = [...new Set(outside.map((v) => notFor(v)!.replace(/^./, (x) => x.toLowerCase())))];
  const hiddenLine = outside.length ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
      <Icon name="ban" size={18} color={c.inkMuted} />
      <Text variant="caption" muted style={{ flex: 1 }}>
        {showHidden
          ? `Showing classes ${dog.name} can't join, greyed out.`
          : `Hiding ${outsideClasses.length === 1 ? '1 class' : `${outsideClasses.length} classes`} ${dog.name} can't join: ${outsideWhy.join(', ')}.`}
      </Text>
      <Press onPress={() => setShowHidden((x) => !x)} accessibilityRole="button" style={{ height: 32, paddingHorizontal: 12, borderRadius: 9999, justifyContent: 'center', backgroundColor: c.bg }}>
        <Text variant="label" weight="600">{showHidden ? 'Hide' : 'Show'}</Text>
      </Press>
    </View>
  ) : null;
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

  if (wide) {
    const mapMode = mode === 'Map';
    const heroEl = hero ? eligibility(hero, rules, dog.name) : null;
    // repeat(auto-fill, minmax(380px, 1fr)) with a 24 column gap, measured so a lone last card keeps its column width.
    const cols = Math.max(1, Math.floor((gridW + 24) / (380 + 24)));
    const cell = gridW ? Math.floor((gridW - 24 * (cols - 1)) / cols) : '100%';
    const p = catalog.partners[partnerId] ?? Object.values(catalog.partners)[0];
    const here = byPartner[p.id] ?? [];
    return (
      <Page top={32}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="pageTitle" accessibilityRole="header">Book</Text>
          <WideSegmented value={mapMode ? 'Map' : 'List'} onChange={setMode} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
          <View style={col(1, 320)}>
            <Field search value={query} onChangeText={setQuery} placeholder="Search classes, trainers, places" left={<Icon name="search" size={18} color={c.inkMuted} />} returnKeyType="search" />
          </View>
          <View style={col(1, 380, { flexDirection: 'row', padding: 4, borderRadius: 9999, backgroundColor: c.surfaceRaised })}>
            {CATS.map((k) => (
              <Press key={k} onPress={() => setCat(k)} accessibilityRole="tab" accessibilityState={{ selected: cat === k }} style={{ flex: 1, height: 44, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: cat === k ? c.inverse : 'transparent' }}>
                <Text variant="label" weight="600" color={cat === k ? c.onInverse : c.ink}>{k}</Text>
              </Press>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 24, marginTop: 14, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: 7 }, (_, d) => (
              <Chip key={d} selected={day === d} onPress={() => setDay(d)}>{d === 0 ? 'Today' : shortDay(addMinutes(now(), d * 1440))}</Chip>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip selected={fits} onPress={() => setFits((f) => !f)}>{`Fits ${dog.name}`}</Chip>
            {TYPES.map((t) => (
              <Chip key={t} selected={types.includes(t)} onPress={() => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</Chip>
            ))}
          </View>
        </View>

        {mapMode ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap-reverse', gap: 20, marginTop: 24 }}>
            <View style={col(1, 360, { maxWidth: 440, padding: 20, borderRadius: 16, boxShadow: `inset 0 0 0 1px ${c.line}` })}>
              <Text variant="eyebrow" muted>{`${dayLabel} · ${p.distanceMi} mi · ${p.street}`}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <Text variant="displayLg" style={{ flex: 1 }}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="star" size={14} />
                  <Text variant="label" num>{p.rating.toFixed(1)}</Text>
                </View>
              </View>
              <View style={{ gap: 14, marginTop: 20 }}>
                {here.length ? here.map((v) => <ClassRow key={v.session.id} v={v} showPartnerAsCoach />) : <Text muted>Nothing on this day.</Text>}
              </View>
            </View>
            <Map
              center={centerOf(pins, [30.2849, -97.719])}
              zoom={12}
              height={560}
              me={me}
              style={col(999, 420, { minHeight: 560 })}
              pins={pins.map((pin) => ({ ...pin, active: pin.id === p.id }))}
              renderPin={(pin) => {
                const id = pins.find((x) => x.lat === pin.lat && x.lng === pin.lng)!.id;
                const n = byPartner[id]?.length ?? 0;
                const on = id === p.id;
                return <LabelPin on={on} label={on ? `${catalog.partners[id].short} · ${n}` : pinLabel(id, n)} a11y={`${catalog.partners[id].name}, ${n} sessions`} onPress={() => setPartnerId(id)} />;
              }}
            />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 32, marginBottom: 16 }}>
              <Text variant="title">{`${dayLabel} near you`}</Text>
              <Text variant="caption" muted>{count === 1 ? '1 session' : `${count} sessions`}</Text>
            </View>
            {hero ? (
              <Press onPress={() => router.push(`/class/${hero.session.id}`)} scale={false} accessibilityLabel={hero.cls.title} style={{ height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                <PhotoFill name={hero.cls.image} />
                <Scrim />
                <View style={{ position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
                  {hero.cls.premium ? <Tag tone="premium">Premium</Tag> : <View />}
                  <Tag tone="glass">{`${hero.cls.credits} credits`}</Tag>
                </View>
                <View style={{ position: 'absolute', left: 24, right: 24, bottom: 22 }}>
                  <Text variant="displayLg" color="#fff">{hero.cls.title}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, marginTop: 6 }} color="rgba(255,255,255,0.85)">
                    {[timeLabel(hero), `${hero.cls.durationMin} min`, hero.partner.name, `${hero.partner.distanceMi} mi`, hero.session.spotsLeft === 0 ? 'Full. Waitlist open' : hero.session.spotsLeft === 1 ? 'Last spot' : `${hero.session.spotsLeft} spots left`].join(' · ')}
                  </Text>
                  {heroEl && !heroEl.ok ? <View style={{ marginTop: 10, flexDirection: 'row' }}><Tag tone="glass" icon="shield">{heroEl.needs === 'herding' ? 'Needs assessment' : heroEl.needs === 'social' ? 'Needs Social' : 'Vaccines due'}</Tag></View> : null}
                </View>
              </Press>
            ) : null}
            <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, columnGap: 24 }}>
              {list.map((v) => (
                <View key={v.session.id} style={{ width: cell, minWidth: 0 }}>
                  <ClassRow v={v} />
                </View>
              ))}
            </View>
            {count === 0 ? <Text muted>Nothing matches these filters. Clear one to see more.</Text> : null}
            {hiddenLine ? <View style={{ marginTop: 20 }}>{hiddenLine}</View> : null}
          </>
        )}
      </Page>
    );
  }

  if (mode === 'Map') {
    const p = catalog.partners[partnerId] ?? Object.values(catalog.partners)[0];
    const here = byPartner[partnerId] ?? [];
    return (
      <Screen bleed>
        <Map
          center={centerOf(pins, [30.2849, -97.719])}
          zoom={12}
          radius={0}
          inset={{ top: 40, bottom: 380 }}
          me={me}
          style={{ flex: 1 }}
          pins={pins.map((pin) => ({ ...pin, active: pin.id === partnerId }))}
          renderPin={(pin) => {
            const id = pins.find((x) => x.lat === pin.lat && x.lng === pin.lng)!.id;
            const n = byPartner[id]?.length ?? 0;
            const on = id === partnerId;
            return <LabelPin on={on} label={on ? `${catalog.partners[id].short} · ${n}` : pinLabel(id, n)} a11y={`${catalog.partners[id].name}, ${n} sessions`} onPress={() => { setPartnerId(id); setOpened((n) => n + 1); }} />;
          }}
        >
          <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', gap: 8, zIndex: 5 }}>
            <Press onPress={() => setMode('List')} style={{ flex: 1, height: 52, borderRadius: 9999, backgroundColor: c.bg, boxShadow: c.shadowFloat, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
              <Icon name="search" color={c.inkMuted} />
              <Text color={c.inkMuted}>{`${dayLabel} · ${cat}`}</Text>
            </Press>
            <Segmented value="Map" onChange={setMode} float />
          </View>
          <DetentSheet peek={132} half={0.48} gap={top + 72} open={opened} contentStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
              <Text variant="eyebrow" muted>{`${dayLabel} · ${p.distanceMi} mi · ${p.street}`}</Text>
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
          </DetentSheet>
        </Map>
      </Screen>
    );
  }

  const heroEl = hero ? eligibility(hero, rules, dog.name) : null;

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="pageTitle" accessibilityRole="header">Book</Text>
          <Segmented value="List" onChange={setMode} />
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <Field search value={query} onChangeText={setQuery} placeholder="Search classes, trainers, places" left={<Icon name="search" size={18} color={c.inkMuted} />} returnKeyType="search" />
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
            <Press onPress={() => router.push(`/class/${hero.session.id}`)} accessibilityLabel={hero.cls.title} style={{ height: 220, borderRadius: 16, overflow: 'hidden' }}>
              <PhotoFill name={hero.cls.image} />
              <Scrim />
              <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                {hero.cls.premium ? <Tag tone="premium">Premium</Tag> : <View />}
                <Tag tone="glass">{`${hero.cls.credits} credits`}</Tag>
              </View>
              <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
                <Text variant="title" color="#fff">{hero.cls.title}</Text>
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
          {hiddenLine}
        </View>
      </ScrollView>
    </Screen>
  );
}
