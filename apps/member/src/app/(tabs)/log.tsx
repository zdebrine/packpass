import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { Button, Chip, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Badge, IconButton, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { col, Columns, Page, useWide } from '@/ds/responsive';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useLogView } from '@/features/log/view';
import { countLabel, monthHeader, type BalanceRow, type FeedRow } from '@/lib/log';
import { useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
type Filter = 'all' | 'classes' | 'home';
const FILTERS: [Filter, string][] = [['all', 'All'], ['classes', 'Classes'], ['home', 'At home']];

/** 07 Log: practice between classes and the classes themselves, one month and one feed. */
export default function Log() {
  const juno = useDog();
  const { c } = useTheme();
  const wide = useWide();
  const view = useLogView(juno);
  const [m, setM] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const month = view.months[m];
  const shade = [c.bg, `${c.turf}4d`, `${c.turf}a6`, c.turf];
  const balanceColor = { agility: c.agility, turf: c.turf, pitch: c.pitch };
  // Milestones on desktop sit in a `repeat(auto-fill, minmax(130px, 1fr))` grid; the column width sets how many fit.
  const [msWidth, setMsWidth] = useState(0);
  const openLog = () => router.push('/log-activity' as Href);

  const header = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Text variant="pageTitle" accessibilityRole="header">Log</Text>
      <Button size="sm" icon="plus" onPress={openLog}>Log activity</Button>
    </View>
  );
  const balanceHead = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: wide ? 16 : 14 }}>
      <Text variant="title">This month’s balance</Text>
      <Text variant="caption" muted>{`Resets ${monthHeader().resets}`}</Text>
    </View>
  );
  // A two-part bar: classes solid, home time lighter in the same colour.
  const splitMeter = (b: BalanceRow) => {
    const color = balanceColor[b.color];
    const cls = Math.min(b.classes, b.of) / b.of;
    const home = Math.min(b.home * 0.5, Math.max(0, b.of - b.classes)) / b.of;
    return (
      <View style={{ flex: 1, height: 8, borderRadius: 9999, backgroundColor: c.surfaceSunken, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${cls * 100}%`, backgroundColor: color }} />
        <View style={{ width: `${home * 100}%`, backgroundColor: color, opacity: 0.45 }} />
      </View>
    );
  };
  const balanceRows = (
    <View style={{ gap: 12 }}>
      {view.balance.map((b) => (
        <View key={b.label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} accessibilityLabel={`${b.label}: ${countLabel(b.done)} of ${b.of}, ${b.classes} from classes, ${b.home} at home`}>
          <Text variant="label" style={{ width: 72 }}>{b.label}</Text>
          {splitMeter(b)}
          <Text variant="caption" muted num style={{ width: 56, textAlign: 'right' }}>{`${countLabel(Math.min(b.done, b.of))} of ${b.of}`}</Text>
        </View>
      ))}
    </View>
  );
  const balanceLegend = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 14 }}>
      {[['Classes', 1], ['At home, two count as one', 0.45]].map(([l, o]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 6, borderRadius: 9999, backgroundColor: c.inkMuted, opacity: o as number }} />
          <Text variant="caption" muted>{l}</Text>
        </View>
      ))}
    </View>
  );
  const monthHead = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <Text variant="title">{month.name}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <IconButton icon="chevron-left" size={36} label="Previous month" onPress={() => setM(0)} style={m === 0 ? { opacity: 0.4 } : undefined} />
        <IconButton icon="chevron-right" size={36} label="Next month" onPress={() => setM(1)} style={m === 1 ? { opacity: 0.4 } : undefined} />
      </View>
    </View>
  );
  const calendar = (
    <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 16, padding: wide ? 18 : 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center' }}><Text variant="caption" muted>{w}</Text></View>
        ))}
        {Array.from({ length: month.firstWeekday + month.days }, (_, i) => {
          const d = i - month.firstWeekday + 1;
          if (d < 1) return <View key={i} style={{ width: `${100 / 7}%` }} />;
          const a = month.active[d] ?? 0;
          const today = d === month.today;
          return (
            <View key={i} style={{ width: `${100 / 7}%`, paddingHorizontal: 3 }}>
              <View style={{ aspectRatio: 1, borderRadius: 9999, backgroundColor: shade[a], alignItems: 'center', justifyContent: 'center', boxShadow: today ? `0 0 0 2px ${c.surfaceRaised}, 0 0 0 3.5px ${c.ink}` : undefined }}>
                <Text style={wide ? { fontSize: 12, lineHeight: 16 } : { fontSize: 11, lineHeight: 14 }} weight="500" color={a >= 2 ? '#fff' : c.inkMuted}>{d}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14 }}>
        <Text variant="caption" muted>Less</Text>
        {shade.map((s, i) => <View key={i} style={{ width: 12, height: 12, borderRadius: 9999, backgroundColor: s }} />)}
        <Text variant="caption" muted>More</Text>
      </View>
    </View>
  );
  const milestoneCard = (ms: (typeof view.milestones)[number], style: ViewStyle) => (
    <View key={ms.label} style={[{ padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }, style]}>
      <Badge
        icon={ms.kind === 'on' ? 'award' : ms.kind === 'clr' ? 'shield-check' : 'lock'}
        bg={ms.kind === 'on' ? c.agility : ms.kind === 'clr' ? c.pitch : c.surfaceSunken}
        fg={ms.kind === 'on' ? c.onAgility : ms.kind === 'clr' ? c.onPitch : c.inkFaint}
        iconSize={20}
      />
      <Text variant="label" weight="600" color={ms.kind === 'off' ? c.inkMuted : c.ink} style={{ marginTop: 24 }}>{ms.label}</Text>
      <Text variant="caption" muted style={{ marginTop: 2 }}>{ms.date}</Text>
    </View>
  );

  const feed = view.feed
    .map((g) => ({ ...g, rows: g.rows.filter((r) => filter === 'all' || (filter === 'home') === (r.type === 'home')) }))
    .filter((g) => g.rows.length);
  const chip = (t: string) => (
    // On desktop the row sits on a raised card, so the chip drops to the page colour.
    <View key={t} style={{ height: 24, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: wide ? c.bg : c.surfaceRaised, justifyContent: 'center' }}>
      <Text variant="caption" weight="600">{t}</Text>
    </View>
  );
  const rowBody = (r: FeedRow) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <Text variant="heading" style={{ flex: 1 }}>{r.title}</Text>
        <Text variant="caption" muted>{r.type === 'home' ? r.time : r.date}</Text>
      </View>
      <Text variant="caption" muted style={{ marginTop: 2 }}>{r.type === 'home' ? r.sub : r.trainer}</Text>
      {r.type === 'home' && r.tags.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{r.tags.map((t) => <Tag key={t}>{t}</Tag>)}</View> : null}
      {r.type === 'class' && r.missed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: c.kennelRedSoft, justifyContent: 'center' }}>
            <Text variant="caption" weight="600" color={c.kennelRed}>Missed</Text>
          </View>
          <Text variant="caption" muted>Not cancelled in time</Text>
        </View>
      ) : null}
      {r.type === 'class' && r.assessment ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {chip('Assessment')}
          <Text variant="caption" weight="600" color={r.cleared ? c.turf : c.inkMuted}>{r.assessment}</Text>
        </View>
      ) : null}
      {r.type === 'class' && r.missed ? null
        : r.note ? <Text variant="label" style={{ marginTop: 8 }}>{`“${r.note}”`}</Text>
        : r.type === 'class' ? <Text variant="label" muted style={{ marginTop: 8 }}>No note yet.</Text> : null}
    </View>
  );
  const row = (r: FeedRow) => {
    const href = r.type === 'home' ? `/log-activity?edit=${r.id}` : r.href;
    return (
      <Press
        key={r.type + (r.type === 'home' ? r.id : r.key)}
        scale={!!href}
        onPress={href ? () => router.push(href as Href) : undefined}
        accessibilityLabel={r.type === 'home' ? `${r.title}. Edit` : undefined}
        style={wide ? { flexDirection: 'row', gap: 16, padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised } : { flexDirection: 'row', gap: 14 }}
      >
        {r.type === 'home' ? (
          <View style={{ width: wide ? 64 : 56, height: wide ? 64 : 56, borderRadius: 9999, backgroundColor: wide ? c.bg : c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={r.icon} size={22} />
          </View>
        ) : <Photo name={r.img} style={{ width: wide ? 64 : 56, height: wide ? 64 : 56, borderRadius: wide ? 16 : 12 }} />}
        {rowBody(r)}
      </Press>
    );
  };
  const activity = (
    <View>
      <Text variant="title" style={{ marginBottom: 14 }}>Activity</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([id, label]) => <Chip key={id} selected={filter === id} onPress={() => setFilter(id)}>{label}</Chip>)}
      </View>
      {!feed.length ? (
        <View style={{ marginTop: 16, padding: 20, borderRadius: 16, backgroundColor: c.surfaceRaised, alignItems: 'flex-start', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 9999, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="activity" /></View>
          <Text>{view.feed.length
            ? 'Nothing here yet for this filter.'
            : `Nothing logged yet. Log a walk, a park trip or a patio visit and it shows up here next to ${juno.name}'s classes.`}</Text>
          <Button size="sm" icon="plus" onPress={openLog}>Log activity</Button>
        </View>
      ) : null}
      {feed.map((g) => (
        <View key={g.key}>
          <Text variant="caption" weight="600" muted style={{ marginTop: 24, marginBottom: 12 }}>{g.day}</Text>
          <View style={{ gap: wide ? 8 : 20 }}>{g.rows.map(row)}</View>
        </View>
      ))}
    </View>
  );

  if (wide) {
    // 07 Log, desktop: balance and stats side by side, then the calendar and milestones beside the activity feed.
    const raised: ViewStyle = { padding: 24, borderRadius: 16, backgroundColor: c.surfaceRaised };
    const msCols = Math.max(1, Math.floor((msWidth + 10) / 140));
    const msTile = msWidth ? (msWidth - 10 * (msCols - 1)) / msCols : 130;
    return (
      <Page top={32}>
        {header}
        <Columns gap={16} align="stretch" style={{ marginTop: 24 }}>
          <View style={col(2, 420, raised)}>
            {balanceHead}
            {balanceRows}
            {balanceLegend}
            <Text variant="label" muted style={{ marginTop: 12 }}>{view.hint}</Text>
          </View>
          <View style={col(1, 300, { ...raised, flexDirection: 'row', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' })}>
            {view.stats.map(([n, l]) => (
              <View key={l} style={{ flexShrink: 1 }}>
                <Text variant="statNum" num>{n}</Text>
                <Text variant="caption" muted style={{ marginTop: 4 }}>{l}</Text>
              </View>
            ))}
          </View>
        </Columns>
        <Columns gap={40} style={{ marginTop: 40 }}>
          <View style={col(1, 340, { maxWidth: 440 })}>
            {monthHead}
            {calendar}
            <Text variant="title" style={{ marginTop: 40, marginBottom: 14 }}>Milestones</Text>
            <View onLayout={(e) => setMsWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {view.milestones.map((ms) => milestoneCard(ms, { width: msTile }))}
            </View>
          </View>
          <View style={col(999, 420)}>{activity}</View>
        </Columns>
      </Page>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 20 }}>
          {header}
          <View style={{ marginTop: 20, padding: 20, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
            {balanceHead}
            {balanceRows}
            {balanceLegend}
            <Text variant="label" muted style={{ marginTop: 12 }}>{view.hint}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            {view.stats.map(([n, l]) => (
              <View key={l} style={{ flex: 1 }}>
                <Text variant="statNum" num>{n}</Text>
                <Text variant="caption" muted style={{ marginTop: 4 }}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
          {monthHead}
          {calendar}
        </View>

        <View style={{ marginTop: 32 }}>
          <Text variant="title" style={{ marginHorizontal: 20, marginBottom: 14 }}>Milestones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {view.milestones.map((ms) => milestoneCard(ms, { width: 132 }))}
          </ScrollView>
        </View>

        <View style={{ marginTop: 32, paddingHorizontal: 20 }}>{activity}</View>
      </ScrollView>
    </Screen>
  );
}
