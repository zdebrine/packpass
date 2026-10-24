import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { forDog, LEVEL_LABEL, skillById, type Rating } from '@/data/practice';
import { ClassCard } from '@/ds/cards';
import { Icon } from '@/ds/Icon';
import { IconButton, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { col, Columns, Page, useWide } from '@/ds/responsive';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useSkillNotes, useSkillTiles } from '@/features/log/view';
import { nextSession } from '@/lib/booking';
import { weekday } from '@/lib/dates';
import { skillDrills, skillWeeks, TREND } from '@/lib/focus';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** 07k Skill detail: why it matters, the last four weeks of practice, drills, trainers' notes and classes that help. */
export default function SkillDetail() {
  const { c } = useTheme();
  const wide = useWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dog = useDog();
  const homeLog = useApp((s) => s.homeLog);
  const tiles = useSkillTiles(dog);
  const notes = useSkillNotes(dog, id);
  const skill = skillById(id);
  const home = useMemo(() => homeLog.filter((h) => h.dogId === dog.id), [homeLog, dog.id]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/log'));
  if (!skill) return <Screen><View style={{ padding: 20 }}><Text muted>That skill isn’t available.</Text></View></Screen>;

  const tile = tiles.find((t) => t.id === id);
  const trend = TREND[tile?.trend ?? 'none'];
  const weeks = skillWeeks(home, id);
  const { drills, next } = skillDrills(home, id);
  const classes = skill.classIds.map((cid) => nextSession(cid)).filter((v): v is NonNullable<typeof v> => !!v);

  const dot = (r: Rating, i: number) => (
    <View key={i} style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: r === 'good' ? c.turf : r === 'mixed' ? c.inkMuted : 'transparent', borderWidth: r === 'tough' ? 2 : 0, borderColor: c.inkMuted }} />
  );
  const head = (
    <View>
      <Text variant="wide" muted>{tile ? `Working on · ${tile.source}` : 'Skill'}</Text>
      <Text variant={wide ? 'hero' : 'displayXl'} style={{ marginTop: 8 }} accessibilityRole="header">{skill.label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Icon name={trend.icon} size={16} color={tile?.trend === 'up' ? c.turf : c.inkMuted} />
        <Text variant="label" weight="600" color={tile?.trend === 'up' ? c.turf : c.inkMuted}>{trend.label}</Text>
        {tile ? <Text variant="label" muted>{`· ${tile.done} of ${tile.target} this week`}</Text> : null}
      </View>
      <Text style={{ marginTop: 14 }}>{forDog(skill.why, dog.name)}</Text>
      {skill.trainerLed ? (
        <View style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised, flexDirection: 'row', gap: 12 }}>
          <Icon name="stethoscope" />
          <Text variant="label" style={{ flex: 1 }}>Practice this with a trainer first. If anything feels off, stop and book a 1:1.</Text>
        </View>
      ) : null}
    </View>
  );
  const practice = (
    <View>
      <Text variant="title" style={{ marginBottom: 14 }}>Your practice</Text>
      <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {weeks.map((w, i) => (
            <View key={w.key} style={{ flex: 1, alignItems: 'center', gap: 8 }} accessibilityLabel={`${w.label}: ${w.count} sessions`}>
              <View style={{ height: 72, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                <View style={{ width: 28, height: `${Math.min(w.count, 3) / 3 * 100}%`, minHeight: w.count ? 8 : 0, borderRadius: 8, backgroundColor: i === 3 ? c.turf : `${c.turf}73` }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 4, minHeight: 8 }}>{w.ratings.slice(0, 4).map(dot)}</View>
              <Text variant="caption" muted style={{ textAlign: 'center' }}>{w.label}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, alignItems: 'center' }}>
          {(['good', 'mixed', 'tough'] as Rating[]).map((r, i) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{dot(r, i)}<Text variant="caption" muted>{r[0].toUpperCase() + r.slice(1)}</Text></View>
          ))}
          <Text variant="caption" muted>Bars are sessions per week</Text>
        </View>
      </View>
    </View>
  );
  const drillList = (
    <View>
      <Text variant="title" style={{ marginBottom: 6 }}>Drills</Text>
      {drills.map((d, i) => (
        <Press key={d.id} onPress={() => router.push(`/log-activity?drill=${d.id}` as Href)} accessibilityLabel={`${d.title}, ${d.minutes} minutes. Log it`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: c.surfaceSunken }}>
          <Photo name={d.image} style={{ width: 56, height: 56, borderRadius: 12 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="heading">{d.title}</Text>
            <Text variant="caption" muted style={{ marginTop: 2 }}>{`${d.minutes} min · ${d.setting}`}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {d.id === next ? <Pill bg={c.turf} fg={c.onTurf}>Next up</Pill> : null}
            <Pill bg={c.surfaceRaised} fg={c.ink}>{LEVEL_LABEL[d.level]}</Pill>
          </View>
        </Press>
      ))}
    </View>
  );
  const noteList = notes.length ? (
    <View>
      <Text variant="title" style={{ marginBottom: 14 }}>From your trainers</Text>
      <View style={{ gap: 8 }}>
        {notes.map((n) => (
          <View key={n.key} style={{ padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
            <Text variant="label">{`“${n.note}”`}</Text>
            <Text variant="caption" muted style={{ marginTop: 8 }}>{n.by}</Text>
          </View>
        ))}
      </View>
    </View>
  ) : null;
  const classList = classes.length ? (
    <View>
      <Text variant="title" style={{ marginBottom: 14 }}>Classes that help</Text>
      <View style={{ gap: 8 }}>
        {classes.map((v) => (
          <ClassCard key={v.session.id} layout="row" image={v.cls.image} title={v.cls.title}
            partner={v.cls.sessionType === 'Private' ? v.trainer.name : v.partner.name}
            time={`${weekday(v.session.startsAt).slice(0, 3)}`} credits={v.cls.credits} spotsLeft={v.session.spotsLeft}
            onPress={() => router.push(`/class/${v.session.id}` as Href)} />
        ))}
      </View>
    </View>
  ) : null;

  if (wide) {
    return (
      <Page>
        <Press onPress={back} accessibilityRole="button" accessibilityLabel="Back to Log" style={{ alignSelf: 'flex-start', height: 40, paddingLeft: 10, paddingRight: 16, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="chevron-left" size={18} />
          <Text variant="label" weight="600">Log</Text>
        </Press>
        <View style={{ maxWidth: 720, marginTop: 24 }}>{head}</View>
        <Columns gap={48} style={{ marginTop: 36 }}>
          <View style={col(1, 380, { gap: 32 })}>{practice}{drillList}</View>
          <View style={col(1, 380, { gap: 32 })}>{noteList}{classList}</View>
        </Columns>
      </Page>
    );
  }
  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 40, paddingHorizontal: 20, gap: 32 }}>
        <View>
          <IconButton icon="chevron-left" label="Back" onPress={back} />
          <View style={{ marginTop: 20 }}>{head}</View>
        </View>
        {practice}
        {drillList}
        {noteList}
        {classList}
      </ScrollView>
    </Screen>
  );
}

function Pill({ children, bg, fg }: { children: string; bg: string; fg: string }) {
  return (
    <View style={{ height: 22, paddingHorizontal: 9, borderRadius: 9999, backgroundColor: bg, justifyContent: 'center' }}>
      <Text style={{ fontSize: 11, lineHeight: 14 }} weight="600" color={fg}>{children}</Text>
    </View>
  );
}
