import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { catalog } from '@/data/catalog';
import type { Category, SessionType } from '@/data/types';
import { Chip } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Field, Screen, useTop } from '@/ds/layout';
import { DetentSheet } from '@/ds/sheet';
import { Press } from '@/ds/Press';
import { col, Page, useWide } from '@/ds/responsive';
import { Text } from '@/ds/Text';
import { BookRowView, bookRow, dogLine, HiddenLine, OpenCard, PlaceGroup, SectionHead, UnlockCard, type BookRow } from '@/features/book/parts';
import { useFit } from '@/features/book/useFit';
import { useImpressions } from '@/features/book/useImpressions';
import { centerOf, Map, useMe } from '@/features/Map';
import { view, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { addMinutes, dayOffset, shortDay } from '@/lib/dates';
import { useApp, useDog, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const CATS: Category[] = ['Sport', 'Scent', 'Play', 'Skills'];
const TYPES: SessionType[] = ['Class', 'Private', 'Assessment'];

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

const SUBS: Record<Category, string> = { Sport: 'Agility, sprints, herding', Scent: 'Nosework and sniff spaces', Play: 'Open field and small groups', Skills: 'Focus, recall, privates' };
const minuteOfDay = (v: SessionView) => v.session.startsAt.getHours() * 60 + v.session.startsAt.getMinutes();

/** Open first, then nearest, then soonest (03 Book · browse sections). */
const nearestOpen = (a: BookRow, b: BookRow) =>
  Number(b.access === 'open') - Number(a.access === 'open') || a.v.partner.distanceMi - b.v.partner.distanceMi || minuteOfDay(a.v) - minuteOfDay(b.v);

/** 03 Book · browse, 03b Book · category and 04 Book · map */
export default function Book() {
  useOriginLabel(); // re-render when distances are measured from somewhere new
  const { c } = useTheme();
  const top = useTop();
  const [mode, setMode] = useState<'List' | 'Map'>('List');
  const [cat, setCat] = useState<Category | null>(null);
  const [day, setDay] = useState(0);
  const [types, setTypes] = useState<SessionType[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [partnerId, setPartnerId] = useState(() => (catalog.partners.ridgeline ? 'ridgeline' : Object.keys(catalog.partners)[0]));
  // Tapping a pin brings a collapsed map sheet back up.
  const [opened, setOpened] = useState(0);
  const activePaths = useApp((s) => s.activePaths);
  const rules = useRules();
  const dog = useDog();
  const fit = useFit();
  const wide = useWide();
  const me = useMe();
  const pins = partnerPins();
  // Desktop grids: auto-fill columns of at least `min`, measured so a lone last cell keeps its column width.
  const [gridW, setGridW] = useState(0);
  const cell = (min: number, gap: number) => {
    const cols = Math.max(1, Math.floor((gridW + gap) / (min + gap)));
    return { width: gridW ? Math.floor((gridW - gap * (cols - 1)) / cols) : ('100%' as const), minWidth: 0 };
  };
  const dayLabel = day === 0 ? 'Today' : shortDay(addMinutes(now(), day * 1440));

  // Every session on the day that hasn't started, with what it means for the dog.
  const rows = useMemo(
    () =>
      catalog.sessions
        .filter((s) => dayOffset(s.startsAt) === day && s.startsAt > now())
        .sort((a, b) => +a.startsAt - +b.startsAt)
        .map((s) => view(s.id)!)
        .filter(Boolean)
        .map((v) => bookRow(v, rules, dog.name, fit(v.cls), (id) => activePaths.includes(id as never))),
    [day, rules, dog.name, fit, activePaths],
  );
  const q = query.trim().toLowerCase();
  const found = q ? rows.filter((r) => [r.v.cls.title, r.v.partner.name, r.v.trainer.name, r.v.cls.discipline].some((s) => s.toLowerCase().includes(q))) : rows;

  // Browse: what the dog can book now, ranked by fit (src/lib/fit.ts); what's one step away; then each category.
  const open = found.filter((r) => r.access === 'open');
  const forDog = open.filter((r) => r.v.session.spotsLeft > 0).sort((a, b) => b.fit.score - a.fit.score || a.v.partner.distanceMi - b.v.partner.distanceMi).slice(0, 6);
  // One card per step: the best-fitting class each assessment, path or vaccine update would open.
  const unlock = found
    .filter((r) => r.access === 'unlock')
    .sort((a, b) => b.fit.score - a.fit.score)
    .filter((r, i, all) => all.findIndex((x) => x.fix?.href === r.fix?.href) === i);
  const sections = CATS.map((k) => {
    const rs = found.filter((r) => r.v.cls.category === k && r.access !== 'no').sort(nearestOpen);
    return { k, count: rs.length, rows: rs.slice(0, 3) };
  });

  // Category: one category, the session types picked, grouped by place, nearest first. Classes the dog is outside of
  // (age, size, breed, spayed or neutered) hide behind a line saying so.
  const inCat = cat ? found.filter((r) => r.v.cls.category === cat && (!types.length || types.includes(r.v.cls.sessionType))) : [];
  const hidden = inCat.filter((r) => r.access === 'no');
  const shown = showHidden ? inCat : inCat.filter((r) => r.access !== 'no');
  const groups = [...new Set(shown.map((r) => r.v.partner.id))]
    .map((id) => shown.filter((r) => r.v.partner.id === id).sort((a, b) => Number(a.access === 'no') - Number(b.access === 'no') || minuteOfDay(a.v) - minuteOfDay(b.v)))
    .sort((a, b) => a[0].v.partner.distanceMi - b[0].v.partner.distanceMi);
  const openShown = shown.filter((r) => r.access === 'open').length;
  const countLine = `${shown.length === 1 ? '1 class' : `${shown.length} classes`} · ${openShown} open to ${dog.name}`;

  const logged = cat ? shown : q ? found : [...forDog, ...unlock, ...sections.flatMap((s) => s.rows)];
  useImpressions(dog.id, logged.map((r) => r.v), rules, (v) => fit(v.cls));

  // Map: every session at each partner on the selected day, any category.
  const byPartner = useMemo(() => {
    const m: Record<string, BookRow[]> = {};
    rows.forEach((r) => (m[r.v.partner.id] ??= []).push(r));
    return m;
  }, [rows]);

  const pick = (k: Category) => { setCat(k); setTypes([]); setShowHidden(false); };
  const dayChips = Array.from({ length: 7 }, (_, d) => (
    <Chip key={d} selected={day === d} onPress={() => setDay(d)}>{d === 0 ? 'Today' : shortDay(addMinutes(now(), d * 1440))}</Chip>
  ));
  const typeChips = TYPES.map((t) => (
    <Chip key={t} selected={types.includes(t)} onPress={() => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</Chip>
  ));
  const search = <Field search value={query} onChangeText={setQuery} placeholder="Search classes, trainers, places" left={<Icon name="search" size={18} color={c.inkMuted} />} returnKeyType="search" />;
  const lines = (rs: BookRow[]) => rs.map((r, i) => <BookRowView key={r.v.session.id} row={r} dogName={dog.name} first={i === 0} />);
  const pad = wide ? 0 : 20;
  const empty = <Text muted>Nothing matches these filters. Clear one to see more.</Text>;

  const browse = (
    <>
      <View style={{ paddingHorizontal: pad, marginTop: 32, marginBottom: 16 }}>
        <SectionHead title={`Open to ${dog.name}`} count={open.length} sub={dogLine(dog, rules.hasSocial)} />
      </View>
      {forDog.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12, paddingHorizontal: pad }}>
          {forDog.map((r) => <OpenCard key={r.v.session.id} row={r} dogName={dog.name} dayLabel={dayLabel} />)}
        </ScrollView>
      ) : (
        <Text muted style={{ paddingHorizontal: pad }}>{`Nothing open to ${dog.name} on this day. Try another day.`}</Text>
      )}
      {unlock.length ? (
        <>
          <View style={{ paddingHorizontal: pad, marginTop: 36, marginBottom: 14 }}>
            <SectionHead title="Unlock next" sub={`One step away for ${dog.name}`} />
          </View>
          {wide ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {unlock.map((r) => <View key={r.v.session.id} style={cell(340, 16)}><UnlockCard row={r} dogName={dog.name} dayLabel={dayLabel} /></View>)}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12, paddingHorizontal: pad }}>
              {unlock.map((r) => <UnlockCard key={r.v.session.id} row={r} dogName={dog.name} dayLabel={dayLabel} width={300} />)}
            </ScrollView>
          )}
        </>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 48, rowGap: wide ? 28 : 0, paddingHorizontal: pad }}>
        {sections.map((s) => (
          <View key={s.k} style={wide ? [cell(460, 48), { marginTop: 36 }] : { width: '100%', marginTop: 36 }}>
            <SectionHead title={s.k} count={s.count} sub={SUBS[s.k]} onMore={() => pick(s.k)} moreLabel={`See all ${s.k}`} />
            <View style={{ marginTop: 4 }}>{s.rows.length ? lines(s.rows) : <Text variant="caption" muted style={{ paddingVertical: 12 }}>Nothing on this day.</Text>}</View>
          </View>
        ))}
      </View>
    </>
  );

  const results = (
    <View style={{ paddingHorizontal: pad, marginTop: 28 }}>
      <SectionHead title="Results" count={found.length} />
      <View style={{ marginTop: 4 }}>{found.length ? lines(found) : empty}</View>
    </View>
  );

  const category = (
    <View style={{ paddingHorizontal: pad }}>
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 8 }}>
          <Press onPress={() => setCat(null)} accessibilityRole="button" accessibilityLabel="Back to Book" style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-left" size={16} />
          </Press>
          <Text variant="headline" accessibilityRole="header">{cat}</Text>
          <Text variant="caption" muted style={{ marginLeft: 'auto' }}>{`${countLine} · nearest first`}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 24 }}>
          <Text variant="title">Nearest first</Text>
          <Text variant="caption" muted>{countLine}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 48, rowGap: wide ? 28 : 0 }}>
        {groups.map((g) => (
          <View key={g[0].v.partner.id} style={wide ? [cell(460, 48), { marginTop: 12 }] : { width: '100%', marginTop: 20 }}>
            <PlaceGroup title={`${g[0].v.partner.distanceMi.toFixed(1)} mi · ${g[0].v.partner.name}`} n={g.length}>{lines(g)}</PlaceGroup>
          </View>
        ))}
      </View>
      {shown.length ? null : <View style={{ marginTop: 16 }}>{empty}</View>}
      {hidden.length ? <View style={{ marginTop: 28 }}><HiddenLine rows={hidden} dogName={dog.name} showing={showHidden} onToggle={() => setShowHidden((x) => !x)} /></View> : null}
    </View>
  );

  const list = cat ? category : q ? results : browse;
  const partnerCard = (p: (typeof catalog.partners)[string], here: BookRow[]) => (
    <>
      <Text variant="eyebrow" muted>{`${dayLabel} · ${p.distanceMi} mi · ${p.street}`}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <Text variant="displayLg" style={{ flex: 1 }}>{p.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="star" size={wide ? 14 : 16} />
          <Text variant="label" num>{p.rating.toFixed(1)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>{here.length ? lines(here) : <Text muted>Nothing on this day.</Text>}</View>
    </>
  );
  const renderPin = (onPick: (id: string) => void) => function BookPin(pin: { lat: number; lng: number }) {
    const id = pins.find((x) => x.lat === pin.lat && x.lng === pin.lng)!.id;
    const n = byPartner[id]?.length ?? 0;
    const on = id === partnerId;
    return <LabelPin on={on} label={on ? `${catalog.partners[id].short} · ${n}` : pinLabel(id, n)} a11y={`${catalog.partners[id].name}, ${n} sessions`} onPress={() => onPick(id)} />;
  };

  if (wide) {
    const mapMode = mode === 'Map';
    const p = catalog.partners[partnerId] ?? Object.values(catalog.partners)[0];
    return (
      <Page top={32}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="pageTitle" accessibilityRole="header">Book</Text>
          <WideSegmented value={mapMode ? 'Map' : 'List'} onChange={setMode} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <View style={col(1, 280, { maxWidth: 420 })}>{search}</View>
          {cat && !mapMode ? (
            <View style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 9999, backgroundColor: c.surfaceRaised }}>
              {CATS.map((k) => (
                <Press key={k} onPress={() => pick(k)} accessibilityRole="tab" accessibilityState={{ selected: cat === k }} style={{ height: 30, paddingHorizontal: 14, borderRadius: 9999, justifyContent: 'center', backgroundColor: cat === k ? c.inverse : 'transparent' }}>
                  <Text variant="caption" weight="500" color={cat === k ? c.onInverse : c.ink}>{k}</Text>
                </Press>
              ))}
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 16, marginTop: 10, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{dayChips}</View>
          {cat && !mapMode ? (
            <>
              <View style={{ width: 1, height: 18, backgroundColor: c.line }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{typeChips}</View>
            </>
          ) : null}
        </View>

        {mapMode ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap-reverse', gap: 20, marginTop: 24 }}>
            <View style={col(1, 360, { maxWidth: 440, padding: 20, borderRadius: 16, boxShadow: `inset 0 0 0 1px ${c.line}` })}>
              {partnerCard(p, byPartner[p.id] ?? [])}
            </View>
            <Map
              center={centerOf(pins, [30.2849, -97.719])}
              zoom={12}
              height={560}
              me={me}
              style={col(999, 420, { minHeight: 560 })}
              pins={pins.map((pin) => ({ ...pin, active: pin.id === p.id }))}
              renderPin={renderPin(setPartnerId)}
            />
          </View>
        ) : <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>{list}</View>}
      </Page>
    );
  }

  if (mode === 'Map') {
    const p = catalog.partners[partnerId] ?? Object.values(catalog.partners)[0];
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
          renderPin={renderPin((id) => { setPartnerId(id); setOpened((n) => n + 1); })}
        >
          <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', gap: 8, zIndex: 5 }}>
            <Press onPress={() => setMode('List')} style={{ flex: 1, height: 52, borderRadius: 9999, backgroundColor: c.bg, boxShadow: c.shadowFloat, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
              <Icon name="search" color={c.inkMuted} />
              <Text color={c.inkMuted} numberOfLines={1}>{cat ? `${dayLabel} · ${cat}` : dayLabel}</Text>
            </Press>
            <Segmented value="Map" onChange={setMode} float />
          </View>
          <DetentSheet peek={132} half={0.48} gap={top + 72} open={opened} contentStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
            {partnerCard(p, byPartner[partnerId] ?? [])}
          </DetentSheet>
        </Map>
      </Screen>
    );
  }

  const scroller = (children: ReactNode) => <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>{children}</ScrollView>;
  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {cat ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <Press onPress={() => setCat(null)} accessibilityRole="button" accessibilityLabel="Back to Book" style={{ width: 44, height: 44, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chevron-left" />
              </Press>
              <Text variant="pageTitle" accessibilityRole="header" numberOfLines={1}>{cat}</Text>
            </View>
          ) : (
            <Text variant="pageTitle" accessibilityRole="header">Book</Text>
          )}
          <Segmented value="List" onChange={setMode} />
        </View>
        {cat ? null : <View style={{ paddingHorizontal: 20, marginTop: 18 }}>{search}</View>}
        <View style={{ marginTop: cat ? 18 : 12 }}>{scroller(dayChips)}</View>
        {cat ? <View style={{ marginTop: 10 }}>{scroller(typeChips)}</View> : null}
        {list}
      </ScrollView>
    </Screen>
  );
}
