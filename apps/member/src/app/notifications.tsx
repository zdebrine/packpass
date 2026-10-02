import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Notif, NotifCategory } from '@/data/passport';
import { Button, Chip, Tag } from '@/ds/controls';
import { Badge, IconButton, Screen } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useApp, useDog, useNotifications } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const FILTERS: ('All' | NotifCategory)[] = ['All', 'Clearances', 'Bookings', 'Notes'];

/** 12 Notifications */
export default function Notifications() {
  const juno = useDog();
  const { c } = useTheme();
  const social = useApp((s) => s.social);
  const read = useApp((s) => s.readNotifications);
  const markRead = useApp((s) => s.markRead);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const all = useNotifications();
  const ok = (n: Notif) => filter === 'All' || n.cat === filter;
  const fresh = all.filter((n) => n.isNew && ok(n));
  const earlier = all.filter((n) => !n.isNew && ok(n));
  const showCard = social !== 'working' && (filter === 'All' || filter === 'Clearances');
  const tones = {
    clr: [c.pitch, c.onPitch],
    path: [c.turfSoft, c.turf],
    ms: [c.agility, c.onAgility],
    n: [c.surfaceRaised, c.ink],
  } as const;

  const open = (n: Notif) => {
    markRead([n.id]);
    if (n.href) router.push(n.href as Href);
  };

  const Row = ({ n }: { n: Notif }) => {
    const [bg, fg] = tones[n.tone];
    const unread = n.isNew && !read.includes(n.id);
    return (
      <Press onPress={() => open(n)} scale={false} accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 14 }}>
        <Badge icon={n.icon} bg={bg} fg={fg} size={44} iconSize={20} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <Text variant="label" weight="600" style={{ flex: 1 }}>{n.title}</Text>
            <Text variant="caption" muted>{n.time}</Text>
          </View>
          <Text variant="caption" muted style={{ marginTop: 2 }}>{n.body}</Text>
        </View>
        {n.isNew ? <View style={{ width: 8, height: 8, marginTop: 6, borderRadius: 9999, backgroundColor: unread ? c.ink : 'transparent' }} /> : null}
      </Press>
    );
  };

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
          <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Press onPress={() => markRead(all.map((n) => n.id))} scale={false}>
            <Text variant="label" weight="600">Mark all read</Text>
          </Press>
        </View>
        <View style={{ paddingTop: 20, paddingHorizontal: 20 }}>
          <Text variant="displayXl" accessibilityRole="header">Notifications</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingTop: 18, paddingHorizontal: 20 }}>
          {FILTERS.map((f) => <Chip key={f} selected={filter === f} onPress={() => setFilter(f)}>{f}</Chip>)}
        </ScrollView>

        <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
          <Text variant="title" style={{ marginBottom: 14 }}>New</Text>
          {showCard ? (
            <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: c.surfaceRaised }}>
              <View style={{ height: 200 }}>
                <PhotoFill name="tunnel" />
                <Gradient stops={[['rgba(0,0,0,0.25)', 0], ['rgba(0,0,0,0)', 0.35], ['rgba(0,0,0,0.66)', 1]]} />
                <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag tone="glass">New clearance</Tag>
                  <Text variant="caption" color="rgba(255,255,255,0.9)">Just now</Text>
                </View>
                <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
                  <View style={{ borderRadius: 9999, boxShadow: `0 0 0 3px ${c.agility}` }}>
                    <Badge icon="shield-check" bg={c.pitch} fg={c.onPitch} size={48} iconSize={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="displayMd" color="#fff">{`${juno.name} is Social cleared.`}</Text>
                    <Text variant="caption" color="rgba(255,255,255,0.9)" style={{ marginTop: 4 }}>Sam Reyes · Eastside Dog Club</Text>
                  </View>
                </View>
              </View>
              <View style={{ padding: 16, gap: 14 }}>
                <Text variant="label">Calm around dogs is complete. Group sport, play and group skills are now open at every PackPass partner.</Text>
                <Button block onPress={() => { markRead(['n-recheck']); router.push('/clearance-earned'); }}>See what's unlocked</Button>
              </View>
            </View>
          ) : null}
          <View style={{ marginTop: showCard ? 8 : 0 }}>
            {fresh.map((n) => <Row key={n.id} n={n} />)}
            {!showCard && fresh.length === 0 ? <Text variant="label" muted>Nothing new.</Text> : null}
          </View>
        </View>

        <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
          <Text variant="title" style={{ marginBottom: 4 }}>Earlier</Text>
          {earlier.map((n) => <Row key={n.id} n={n} />)}
          {earlier.length === 0 ? <Text variant="label" muted style={{ marginTop: 10 }}>Nothing here yet.</Text> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
