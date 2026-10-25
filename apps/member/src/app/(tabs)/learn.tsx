import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { skillById } from '@/data/practice';
import type { Video, VideoWatch } from '@/data/types';
import { Chip, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { EmptyState, Field, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Page, useWide } from '@/ds/responsive';
import { Glass, Photo, PhotoFill, Scrim } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useFocusSkills } from '@/features/log/view';
import { now } from '@/lib/clock';
import { useDog } from '@/store/app';
import { continueWatching, minutes, useLearn } from '@/store/learn';
import { useTheme } from '@/theme/ThemeProvider';

const WEEK = 7 * 86_400_000;
const open = (v: Video) => router.push(`/video/${v.id}` as Href);
const byLine = (v: Video) => (v.partner ? `${v.trainer} · ${v.partner}` : v.trainer);

/** The newest video, big, with its length and "New this week" while it is. */
function Featured({ v, height }: { v: Video; height: number }) {
  return (
    <Press onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`${v.title}, ${minutes(v.durationS)}. ${byLine(v)}`}
      style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <PhotoFill name={v.poster} />
      <Scrim />
      <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        {now().getTime() - v.publishedAt.getTime() < WEEK ? <Tag tone="glass">New this week</Tag> : <View />}
        <Tag tone="glass">{minutes(v.durationS)}</Tag>
      </View>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="title" color="#fff">{v.title}</Text>
          <Text variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 8 }}>{byLine(v)}</Text>
        </View>
        <Glass style={{ width: 52, height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={22} color="#fff" /></Glass>
      </View>
    </Press>
  );
}

function ContinueRow({ v, w }: { v: Video; w: VideoWatch }) {
  const { c } = useTheme();
  const left = v.durationS - w.positionS;
  return (
    <Press onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`Continue ${v.title}, ${minutes(left)} left`}
      style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 10, paddingRight: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
      <View style={{ width: 112, height: 76, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <PhotoFill name={v.poster} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <Icon name="play" size={22} color="#fff" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text variant="heading" numberOfLines={2}>{v.title}</Text>
        <Text variant="caption" muted>{`${v.trainer} · ${minutes(left)} left`}</Text>
        <View style={{ height: 4, borderRadius: 9999, backgroundColor: c.line, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, (w.positionS / v.durationS) * 100)}%`, height: '100%', backgroundColor: c.agility }} />
        </View>
      </View>
    </Press>
  );
}

function PickCard({ v, width = 220 }: { v: Video; width?: number }) {
  return (
    <Press onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`${v.title}, ${minutes(v.durationS)}`}
      style={{ width, height: Math.round(width * 1.18), borderRadius: 12, overflow: 'hidden' }}>
      <PhotoFill name={v.poster} />
      <Scrim />
      <View style={{ position: 'absolute', top: 12, left: 12 }}><Tag tone="glass">{minutes(v.durationS)}</Tag></View>
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
        <Text weight="600" color="#fff" style={{ fontSize: 17, lineHeight: 22 }} numberOfLines={3}>{v.title}</Text>
        <Text variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>{v.trainer}</Text>
      </View>
    </Press>
  );
}

function ListRow({ v }: { v: Video }) {
  return (
    <Press onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`${v.title}, ${minutes(v.durationS)}. ${v.trainer}, ${v.category}`}
      style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <View style={{ width: 112, height: 76, borderRadius: 12, overflow: 'hidden' }}>
        <Photo name={v.poster} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', right: 6, bottom: 6, height: 20, paddingHorizontal: 7, borderRadius: 9999, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }}>
          <Text weight="600" color="#fff" style={{ fontSize: 11, lineHeight: 14 }} num>{minutes(v.durationS)}</Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="heading" numberOfLines={2}>{v.title}</Text>
        <Text variant="caption" muted style={{ marginTop: 4 }}>{`${v.trainer} · ${v.category}`}</Text>
      </View>
    </Press>
  );
}

/** 16 Learn: the video library. Search, category chips, the newest video, Continue watching, Picked for the dog, then every video. */
export default function Learn() {
  const { c } = useTheme();
  const wide = useWide();
  const dog = useDog();
  const focus = useFocusSkills(dog);
  const { enabled, videos, watches } = useLearn();
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  useFocusEffect(useCallback(() => { useLearn.getState().load().catch(() => {}); }, []));

  const cats = useMemo(() => ['All', ...Array.from(new Set(videos.map((v) => v.category)))], [videos]);
  const q = query.trim().toLowerCase();
  const list = videos.filter((v) => (cat === 'All' || v.category === cat) && (!q || [v.title, v.trainer, v.partner ?? '', v.category].some((s) => s.toLowerCase().includes(q))));
  const browsing = cat === 'All' && !q;
  const featured = videos[0];
  const going = continueWatching(videos, watches);
  const picks = videos.filter((v) => v.skills.some((s) => focus.includes(s)));
  const pickedFor = Array.from(new Set(picks.flatMap((v) => v.skills.filter((s) => focus.includes(s))))).map((s) => skillById(s)?.label).filter(Boolean).slice(0, 3);
  const saved = videos.filter((v) => watches.some((w) => w.videoId === v.id && w.saved));

  const head = (
    <View>
      <Text variant="pageTitle" accessibilityRole="header">Learn</Text>
      <Text muted style={{ marginTop: 6 }}>Training videos from Pack trainers, for the days at home.</Text>
    </View>
  );
  if (!enabled) {
    const off = <EmptyState icon="video" title="Learn is on its way" body="Training videos from Pack trainers will show here." />;
    return wide ? <Page top={32}>{head}{off}</Page> : <Screen><View style={{ paddingTop: 14, paddingHorizontal: 20 }}>{head}{off}</View></Screen>;
  }

  const search = (
    <Field search value={query} onChangeText={setQuery} placeholder="Search videos and trainers" accessibilityLabel="Search videos and trainers"
      left={<Icon name="search" size={20} color={c.inkMuted} />} returnKeyType="search" />
  );
  const chips = cats.length > 2 ? cats.map((k) => <Chip key={k} selected={cat === k} onPress={() => setCat(k)}>{k}</Chip>) : null;
  const section = (title: string, sub?: string) => (
    <View style={{ marginBottom: 14 }}>
      <Text variant="title">{title}</Text>
      {sub ? <Text variant="caption" muted style={{ marginTop: 4 }}>{sub}</Text> : null}
    </View>
  );
  const listHead = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
      <Text variant="title">{q ? 'Results' : cat === 'All' ? 'All videos' : cat}</Text>
      <Text variant="caption" muted>{`${list.length} ${list.length === 1 ? 'video' : 'videos'}`}</Text>
    </View>
  );
  const empty = !videos.length
    ? <EmptyState icon="video" title="No videos yet" body="Pack trainers are filming the first ones. Check back soon." />
    : !list.length ? <EmptyState icon="search" title="Nothing matches" body="Try another word, or clear the search." /> : null;
  const pickSub = pickedFor.length ? `Based on what ${dog.name} is working on: ${pickedFor.join(', ')}.` : undefined;

  if (wide) {
    return (
      <Page top={32}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
          {head}
          <View style={{ width: 360, maxWidth: '100%' }}>{search}</View>
        </View>
        {chips ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>{chips}</View> : null}
        {browsing && featured ? (
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 28, flexWrap: 'wrap' }}>
            <View style={{ flexGrow: 3, flexBasis: 480, minWidth: 0 }}><Featured v={featured} height={380} /></View>
            {going.length ? (
              <View style={{ flexGrow: 2, flexBasis: 320, minWidth: 0 }}>
                {section('Continue watching')}
                <View style={{ gap: 10 }}>{going.slice(0, 3).map((x) => <ContinueRow key={x.video.id} v={x.video} w={x.watch} />)}</View>
              </View>
            ) : null}
          </View>
        ) : null}
        {browsing && picks.length ? (
          <View style={{ marginTop: 40 }}>
            {section(`Picked for ${dog.name}`, pickSub)}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{picks.slice(0, 5).map((v) => <PickCard key={v.id} v={v} />)}</View>
          </View>
        ) : null}
        {browsing && saved.length ? (
          <View style={{ marginTop: 40 }}>
            {section('Saved')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{saved.map((v) => <PickCard key={v.id} v={v} width={180} />)}</View>
          </View>
        ) : null}
        <View style={{ marginTop: 40 }}>
          {list.length ? listHead : null}
          {empty ?? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {list.map((v) => <View key={v.id} style={{ flexGrow: 1, flexBasis: 380, minWidth: 0, maxWidth: 560 }}><ListRow v={v} /></View>)}
            </View>
          )}
        </View>
      </Page>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20 }}>{head}</View>
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>{search}</View>
        {chips ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>{chips}</ScrollView> : null}
        {browsing && featured ? <View style={{ paddingHorizontal: 20, marginTop: 24 }}><Featured v={featured} height={300} /></View> : null}
        {browsing && going.length ? (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            {section('Continue watching')}
            <View style={{ gap: 10 }}>{going.slice(0, 3).map((x) => <ContinueRow key={x.video.id} v={x.video} w={x.watch} />)}</View>
          </View>
        ) : null}
        {browsing && picks.length ? (
          <View style={{ marginTop: 32 }}>
            <View style={{ paddingHorizontal: 20 }}>{section(`Picked for ${dog.name}`, pickSub)}</View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {picks.map((v) => <PickCard key={v.id} v={v} />)}
            </ScrollView>
          </View>
        ) : null}
        {browsing && saved.length ? (
          <View style={{ marginTop: 32 }}>
            <View style={{ paddingHorizontal: 20 }}>{section('Saved')}</View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {saved.map((v) => <PickCard key={v.id} v={v} width={160} />)}
            </ScrollView>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          {list.length ? listHead : null}
          {empty ?? <View style={{ gap: 14 }}>{list.map((v) => <ListRow key={v.id} v={v} />)}</View>}
        </View>
      </ScrollView>
    </Screen>
  );
}
