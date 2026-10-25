import { useEventListener } from 'expo';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import * as live from '@/api/live';
import { catalog } from '@/data/catalog';
import type { Video } from '@/data/types';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { IconButton, Screen, useBottom, useTop } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { col, Columns, Page, useWide } from '@/ds/responsive';
import { Glass, HeroScrim, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { nextSession } from '@/lib/booking';
import { now } from '@/lib/clock';
import { useDog } from '@/store/app';
import { clock, useLearn, useVideo, useWatch } from '@/store/learn';
import { useTheme } from '@/theme/ThemeProvider';

const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** The video itself: plays from where the member left off, saves progress every 15 seconds, on finishing and on leaving. */
function Player({ video, uri, start, onTime, seekTo }: { video: Video; uri: string; start: number; onTime: (s: number) => void; seekTo: { at: number; n: number } | null }) {
  const progress = useLearn((s) => s.progress);
  const pos = useRef(start);
  const saved = useRef(start);
  const player = useVideoPlayer({ uri }, (p) => {
    p.timeUpdateEventInterval = 1;
    if (start > 0) p.currentTime = start;
    p.play();
  });
  const save = (finished = false) => {
    if (!finished && Math.abs(pos.current - saved.current) < 5) return;
    saved.current = pos.current;
    progress(video.id, pos.current, finished).catch(() => {});
  };
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    pos.current = currentTime;
    onTime(currentTime);
    if (Math.abs(currentTime - saved.current) >= 15) save();
  });
  useEventListener(player, 'playToEnd', () => { pos.current = video.durationS; save(true); });
  useEffect(() => { if (seekTo) { player.seekBy(seekTo.at - player.currentTime); player.play(); } }, [seekTo, player]);
  // Leaving within 10 seconds of the end counts as finished.
  useEffect(() => () => save(pos.current >= video.durationS - 10), []); // eslint-disable-line react-hooks/exhaustive-deps
  return <VideoView player={player} nativeControls allowsPictureInPicture contentFit="contain" style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />;
}

/** 17 Video player: the video, what it covers, its trainer, chapters to jump to, what you'll need, save, and Log practice. */
export default function VideoScreen() {
  const { c } = useTheme();
  const wide = useWide();
  const top = useTop();
  const bottom = useBottom(32);
  const { id } = useLocalSearchParams<{ id: string }>();
  const video = useVideo(id);
  const watch = useWatch(id);
  const dog = useDog();
  const setSaved = useLearn((s) => s.setSaved);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [seekTo, setSeekTo] = useState<{ at: number; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Resume where they left off, unless they finished it or were nearly done.
  const [start] = useState(() => (watch && !watch.finished && video && watch.positionS < video.durationS - 30 ? watch.positionS : 0));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn' as Href));

  useEffect(() => {
    if (!video?.videoPath) return;
    let alive = true;
    live.videoUrl(video.videoPath).then((u) => alive && setUri(u), (e) => alive && setFailed(errorCopy(e)));
    return () => { alive = false; };
  }, [video?.videoPath]);

  if (!video) {
    return (
      <Screen>
        <View style={{ padding: 20, gap: 16 }}>
          <IconButton icon="chevron-left" label="Back" onPress={close} />
          <Text muted>That video isn’t available.</Text>
        </View>
      </Screen>
    );
  }

  const isSaved = !!watch?.saved;
  const toggleSave = () => { setError(null); setSaved(video.id, !isSaved).catch((e) => setError(errorCopy(e))); };
  const logPractice = () => router.push(`/log-activity?kind=train${video.skills.length ? `&skills=${video.skills.join(',')}` : ''}` as Href);
  // A fresh value each tap, so the same chapter seeks again.
  const jump = (at: number) => setSeekTo((p) => ({ at, n: (p?.n ?? 0) + 1 }));
  const nowAt = video.chapters.reduce((n, ch, i) => (ch.at <= time ? i : n), -1);
  // The trainer's classes this week, and the next one to open from their card.
  const weekEnd = now().getTime() + 7 * 86_400_000;
  const classes = video.trainerId ? Object.values(catalog.classes).filter((k) => k.trainerId === video.trainerId) : [];
  const thisWeek = catalog.sessions.filter((s) => classes.some((k) => k.id === s.classId) && !s.offered && !s.closed && s.startsAt > now() && +s.startsAt < weekEnd).length;
  const next = classes.map((k) => nextSession(k.id)).filter((v): v is NonNullable<typeof v> => !!v).sort((a, b) => +a.session.startsAt - +b.session.startsAt)[0];

  const stage = (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {uri ? <Player video={video} uri={uri} start={start} onTime={setTime} seekTo={seekTo} /> : (
        <>
          <PhotoFill name={video.poster} />
          <HeroScrim />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
            <Glass style={{ width: 68, height: 68, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={28} color="#fff" /></Glass>
            <Text variant="caption" color="#fff" center>{failed ?? (video.videoPath ? 'Loading the video…' : 'Sample video. Videos play in the live app.')}</Text>
          </View>
        </>
      )}
    </View>
  );
  const trainerCard = (
    <Press onPress={next ? () => router.push(`/class/${next.session.id}` as Href) : undefined} disabled={!next} scale={!!next}
      accessibilityRole={next ? 'button' : undefined} accessibilityLabel={next ? `${video.trainer}. See their next class` : video.trainer}
      style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
      <View style={{ width: 48, height: 48, borderRadius: 9999, backgroundColor: c.pitch, alignItems: 'center', justifyContent: 'center' }}>
        <Text weight="700" color={c.onPitch} style={{ fontSize: 15, lineHeight: 20 }}>{initials(video.trainer)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="heading">{video.trainer}</Text>
        <Text variant="caption" muted>{[video.partner, thisWeek ? `${thisWeek} ${thisWeek === 1 ? 'class' : 'classes'} this week` : null].filter(Boolean).join(' · ') || 'PackPass'}</Text>
      </View>
      {next ? <View style={{ width: 44, height: 44, borderRadius: 9999, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-right" size={18} /></View> : null}
    </Press>
  );
  const about = (
    <View>
      <Tag>{video.category}</Tag>
      <Text variant="title" style={{ marginTop: 12, fontSize: 22, lineHeight: 28 }} accessibilityRole="header">{video.title}</Text>
      {video.summary ? <Text muted style={{ marginTop: 10 }}>{video.summary}</Text> : null}
      <View style={{ marginTop: 20 }}>{trainerCard}</View>
    </View>
  );
  const chapters = video.chapters.length ? (
    <View>
      <Text variant="title" style={{ marginBottom: 12 }}>In this video</Text>
      <View style={{ gap: 4 }}>
        {video.chapters.map((ch, i) => (
          <Press key={`${ch.at}-${i}`} onPress={uri ? () => jump(ch.at) : undefined} disabled={!uri} scale={false} accessibilityRole="button"
            accessibilityLabel={`${ch.title}, at ${clock(ch.at)}`}
            style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: i === nowAt ? c.surfaceRaised : 'transparent' }}>
            <Text variant="caption" weight="600" muted num style={{ width: 44 }}>{clock(ch.at)}</Text>
            <Text variant="label" weight={i === nowAt ? '600' : '500'} style={{ flex: 1 }}>{ch.title}</Text>
            {i === nowAt ? <Text variant="caption" muted>Now</Text> : null}
          </Press>
        ))}
      </View>
    </View>
  ) : null;
  const needs = video.needs.length ? (
    <View>
      <Text variant="title" style={{ marginBottom: 10 }}>You’ll need</Text>
      <Text muted>{video.needs.join(' · ')}</Text>
    </View>
  ) : null;
  const actions = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Press onPress={toggleSave} accessibilityRole="button" accessibilityState={{ selected: isSaved }} accessibilityLabel={isSaved ? 'Saved. Remove from saved' : 'Save for later'}
        style={{ width: 52, height: 48, borderRadius: 12, backgroundColor: c.surface, boxShadow: `inset 0 0 0 1px ${c.lineStrong}`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={isSaved ? 'bookmark-check' : 'bookmark'} />
      </Press>
      <View style={{ flex: 1 }}><Button block onPress={logPractice}>{`Log practice for ${dog.name}`}</Button></View>
    </View>
  );
  const errorLine = error ? <Text variant="caption" color={c.kennelRed}>{error}</Text> : null;

  if (wide) {
    return (
      <Page>
        <Press onPress={close} accessibilityRole="button" accessibilityLabel="Back to Learn" style={{ alignSelf: 'flex-start', height: 40, paddingLeft: 10, paddingRight: 16, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="chevron-left" size={18} />
          <Text variant="label" weight="600">Learn</Text>
        </Press>
        <View style={{ marginTop: 20, width: '100%', maxWidth: 1040, aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden' }}>{stage}</View>
        <Columns gap={48} style={{ marginTop: 28, maxWidth: 1040 }}>
          <View style={col(3, 420, { gap: 24 })}>{about}{actions}{errorLine}</View>
          <View style={col(2, 320, { gap: 28 })}>{chapters}{needs}</View>
        </Columns>
      </Page>
    );
  }
  return (
    <Screen theme="dark" bleed statusLight>
      <View style={{ height: 330 }}>
        {stage}
        <View style={{ position: 'absolute', top: top + 8, left: 20 }}><IconButton icon="chevron-down" glass label="Close" onPress={close} /></View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 28 }}>
        {about}{chapters}{needs}
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: bottom, gap: 8 }}>{actions}{errorLine}</View>
    </Screen>
  );
}
