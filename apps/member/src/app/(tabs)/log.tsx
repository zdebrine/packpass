import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { isLive } from '@/api/client';
import { Badge, IconButton, Meter, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { col, Columns, Page, useWide } from '@/ds/responsive';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { liveLog, monthHeader, sampleLog, type LogSession } from '@/lib/log';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** 07 Log */
export default function Log() {
  const juno = useDog();
  const { c } = useTheme();
  const wide = useWide();
  const social = useApp((s) => s.social);
  const entries = useApp((s) => s.log);
  const missed = useApp((s) => s.missed);
  // Sample mode's log is the designs' Juno; another sample dog's is empty until it books.
  const view = useMemo(
    () => (isLive && entries ? liveLog(entries, missed, juno.id, juno.name, social) : juno.id === 'juno' ? sampleLog(juno.name, social) : liveLog([], [], juno.id, juno.name, social)),
    [entries, missed, juno.id, juno.name, social],
  );
  const [m, setM] = useState(1);
  const month = view.months[m];
  const shade = [c.bg, `${c.turf}4d`, `${c.turf}a6`, c.turf];
  const balanceColor = { agility: c.agility, turf: c.turf, pitch: c.pitch };
  // Milestones on desktop sit in a `repeat(auto-fill, minmax(130px, 1fr))` grid; the column width sets how many fit.
  const [msWidth, setMsWidth] = useState(0);

  const balanceHead = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: wide ? 16 : 14 }}>
      <Text variant="title">This month’s balance</Text>
      <Text variant="caption" muted>{`Resets ${monthHeader().resets}`}</Text>
    </View>
  );
  const balanceRows = (
    <View style={{ gap: 12 }}>
      {view.balance.map((b) => (
        <View key={b.label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Text variant="label" style={{ width: 72 }}>{b.label}</Text>
          <Meter pct={b.done / b.of} color={balanceColor[b.color]} />
          <Text variant="caption" muted num style={{ width: 44, textAlign: 'right' }}>{`${b.done} of ${b.of}`}</Text>
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
    <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: wide ? 18 : 16 }}>
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
    <View key={ms.label} style={[{ padding: 16, borderRadius: 24, backgroundColor: c.surfaceRaised }, style]}>
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
  const emptySessions = view.sessions.length ? null : (
    <Text muted>{`Sessions show here once they've run, with what the trainer noticed about ${juno.name}.`}</Text>
  );
  const sessionBody = (s: LogSession) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="heading" style={{ flex: 1 }}>{s.title}</Text>
        <Text variant="caption" muted>{s.date}</Text>
      </View>
      <Text variant="caption" muted style={{ marginTop: 2, marginBottom: 6 }}>{s.trainer}</Text>
      {s.missed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: c.kennelRedSoft, justifyContent: 'center' }}>
            <Text variant="caption" weight="600" color={c.kennelRed}>Missed</Text>
          </View>
          <Text variant="caption" muted>Not cancelled in time</Text>
        </View>
      ) : null}
      {s.assessment ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {/* On desktop the session sits on a raised card, so the chip drops to the page colour. */}
          <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: wide ? c.bg : c.surfaceRaised, justifyContent: 'center' }}>
            <Text variant="caption" weight="600">Assessment</Text>
          </View>
          <Text variant="caption" weight="600" color={s.cleared ? c.turf : c.inkMuted}>{s.assessment}</Text>
        </View>
      ) : null}
      {s.missed ? null : s.note ? <Text variant="label">{`“${s.note}”`}</Text> : <Text variant="label" muted>No note yet.</Text>}
    </View>
  );

  if (wide) {
    // 07 Log, desktop: balance and stats side by side, then the calendar and milestones beside the sessions.
    const raised: ViewStyle = { padding: 24, borderRadius: 28, backgroundColor: c.surfaceRaised };
    const msCols = Math.max(1, Math.floor((msWidth + 10) / 140));
    const msTile = msWidth ? (msWidth - 10 * (msCols - 1)) / msCols : 130;
    return (
      <Page top={32}>
        <Text variant="displayXl" accessibilityRole="header">Log</Text>
        <Columns gap={16} align="stretch" style={{ marginTop: 24 }}>
          <View style={col(2, 420, raised)}>
            {balanceHead}
            {balanceRows}
            <Text variant="label" muted style={{ marginTop: 14 }}>{view.hint}</Text>
          </View>
          <View style={col(1, 300, { ...raised, flexDirection: 'row', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' })}>
            {view.stats.map(([n, l]) => (
              <View key={l}>
                <Text variant="displayXl" num>{n}</Text>
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
          <View style={col(999, 420)}>
            <Text variant="title" style={{ marginBottom: 14 }}>Sessions</Text>
            <View style={{ gap: 8 }}>
              {emptySessions}
              {view.sessions.map((s) => (
                <Press
                  key={s.key}
                  scale={!!s.href}
                  onPress={s.href ? () => router.push(s.href as never) : undefined}
                  style={{ flexDirection: 'row', gap: 16, padding: 16, borderRadius: 24, backgroundColor: c.surfaceRaised }}
                >
                  <Photo name={s.img} style={{ width: 64, height: 64, borderRadius: 16 }} />
                  {sessionBody(s)}
                </Press>
              ))}
            </View>
          </View>
        </Columns>
      </Page>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="displayXl" accessibilityRole="header">Log</Text>
          <View style={{ marginTop: 20, padding: 20, borderRadius: 28, backgroundColor: c.surfaceRaised }}>
            {balanceHead}
            {balanceRows}
            <Text variant="label" muted style={{ marginTop: 12 }}>{view.hint}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            {view.stats.map(([n, l]) => (
              <View key={l} style={{ flex: 1 }}>
                <Text variant="displayXl" num>{n}</Text>
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

        <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
          <Text variant="title" style={{ marginBottom: 14 }}>Sessions</Text>
          <View style={{ gap: 20 }}>
            {emptySessions}
            {view.sessions.map((s) => (
              <Press
                key={s.key}
                scale={!!s.href}
                onPress={s.href ? () => router.push(s.href as never) : undefined}
                style={{ flexDirection: 'row', gap: 14 }}
              >
                <Photo name={s.img} style={{ width: 56, height: 56, borderRadius: 16 }} />
                {sessionBody(s)}
              </Press>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
