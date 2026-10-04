import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { isLive } from '@/api/client';
import { Badge, IconButton, Meter, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { liveLog, monthHeader, sampleLog } from '@/lib/log';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** 07 Log */
export default function Log() {
  const juno = useDog();
  const { c } = useTheme();
  const social = useApp((s) => s.social);
  const entries = useApp((s) => s.log);
  const view = useMemo(() => (isLive && entries ? liveLog(entries, juno.id, juno.name, social) : sampleLog(juno.name, social)), [entries, juno.id, juno.name, social]);
  const [m, setM] = useState(1);
  const month = view.months[m];
  const shade = [c.bg, `${c.turf}4d`, `${c.turf}a6`, c.turf];
  const balanceColor = { agility: c.agility, turf: c.turf, pitch: c.pitch };

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="displayXl" accessibilityRole="header">Log</Text>
          <View style={{ marginTop: 20, padding: 20, borderRadius: 28, backgroundColor: c.surfaceRaised }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <Text variant="title">This month’s balance</Text>
              <Text variant="caption" muted>{`Resets ${monthHeader().resets}`}</Text>
            </View>
            <View style={{ gap: 12 }}>
              {view.balance.map((b) => (
                <View key={b.label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Text variant="label" style={{ width: 72 }}>{b.label}</Text>
                  <Meter pct={b.done / b.of} color={balanceColor[b.color]} />
                  <Text variant="caption" muted num style={{ width: 44, textAlign: 'right' }}>{`${b.done} of ${b.of}`}</Text>
                </View>
              ))}
            </View>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text variant="title">{month.name}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <IconButton icon="chevron-left" size={36} label="Previous month" onPress={() => setM(0)} style={m === 0 ? { opacity: 0.4 } : undefined} />
              <IconButton icon="chevron-right" size={36} label="Next month" onPress={() => setM(1)} style={m === 1 ? { opacity: 0.4 } : undefined} />
            </View>
          </View>
          <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 16 }}>
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
                      <Text style={{ fontSize: 11, lineHeight: 14 }} weight="500" color={a >= 2 ? '#fff' : c.inkMuted}>{d}</Text>
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
        </View>

        <View style={{ marginTop: 32 }}>
          <Text variant="title" style={{ marginHorizontal: 20, marginBottom: 14 }}>Milestones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {view.milestones.map((ms) => (
              <View key={ms.label} style={{ width: 132, padding: 16, borderRadius: 24, backgroundColor: c.surfaceRaised }}>
                <Badge
                  icon={ms.kind === 'on' ? 'award' : ms.kind === 'clr' ? 'shield-check' : 'lock'}
                  bg={ms.kind === 'on' ? c.agility : ms.kind === 'clr' ? c.pitch : c.surfaceSunken}
                  fg={ms.kind === 'on' ? c.onAgility : ms.kind === 'clr' ? c.onPitch : c.inkFaint}
                  iconSize={20}
                />
                <Text variant="label" weight="600" color={ms.kind === 'off' ? c.inkMuted : c.ink} style={{ marginTop: 24 }}>{ms.label}</Text>
                <Text variant="caption" muted style={{ marginTop: 2 }}>{ms.date}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
          <Text variant="title" style={{ marginBottom: 14 }}>Sessions</Text>
          <View style={{ gap: 20 }}>
            {view.sessions.length ? null : (
              <Text muted>{`Sessions show here once they've run, with what the trainer noticed about ${juno.name}.`}</Text>
            )}
            {view.sessions.map((s) => (
              <Press
                key={s.key}
                scale={!!s.href}
                onPress={s.href ? () => router.push(s.href as never) : undefined}
                style={{ flexDirection: 'row', gap: 14 }}
              >
                <Photo name={s.img} style={{ width: 56, height: 56, borderRadius: 16 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text variant="heading" style={{ flex: 1 }}>{s.title}</Text>
                    <Text variant="caption" muted>{s.date}</Text>
                  </View>
                  <Text variant="caption" muted style={{ marginTop: 2, marginBottom: 6 }}>{s.trainer}</Text>
                  {s.assessment ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: c.surfaceRaised, justifyContent: 'center' }}>
                        <Text variant="caption" weight="600">Assessment</Text>
                      </View>
                      <Text variant="caption" weight="600" color={s.cleared ? c.turf : c.inkMuted}>{s.assessment}</Text>
                    </View>
                  ) : null}
                  {s.note ? <Text variant="label">{`“${s.note}”`}</Text> : <Text variant="label" muted>No note yet.</Text>}
                </View>
              </Press>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
