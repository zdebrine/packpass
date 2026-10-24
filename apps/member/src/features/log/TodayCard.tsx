import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { forDog, skillById } from '@/data/practice';
import type { Dog, PhotoSource } from '@/data/types';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Press } from '@/ds/Press';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { timeLabel } from '@/lib/booking';
import { useTheme } from '@/theme/ThemeProvider';
import { useTodayPractice } from './view';

const practice = (id: string) => router.push(`/practice/${id}` as Href);

/** Today's practice (07): a drill to do today, a warm-up before today's class, a rest day, or what was done. */
export function TodayCard({ dog, height }: { dog: Dog; height: number }) {
  const { c } = useTheme();
  const today = useTodayPractice(dog);
  const [swap, setSwap] = useState(0);

  if (today.kind === 'done') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
        <View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: c.turf, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={20} color={c.onTurf} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="caption" muted>Today’s practice</Text>
          <Text variant="heading">{today.line}</Text>
        </View>
        <Press onPress={() => router.push('/log-activity' as Href)} accessibilityRole="button" style={{ paddingVertical: 6 }}>
          <Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>Do another</Text>
        </Press>
      </View>
    );
  }

  let card: { eyebrow: string; image: PhotoSource; title: string; meta?: string; why: string; actions: ReactNode };
  if (today.kind === 'class') {
    const { view: v, drill } = today;
    card = {
      eyebrow: 'Class today', image: v.cls.image, title: v.cls.title, meta: `${timeLabel(v)} · ${v.partner.name}`,
      why: drill ? `Warm up at home: 5 minutes of ${drill.title} on the way over.` : `Booked for ${dog.name}. See you there.`,
      actions: drill
        ? <Button variant="signal" icon="play" onPress={() => practice(drill.id)}>Start warm-up</Button>
        : <Button variant="glass" onPress={() => router.push(`/class/${v.session.id}` as Href)}>See class</Button>,
    };
  } else if (today.kind === 'prompt') {
    card = {
      eyebrow: 'Today’s practice', image: dog.photo ?? 'dog_providing_good_eye_contact', title: `Tell us what ${dog.name}’s working on`,
      why: 'Pick a few skills and Log suggests one drill a day.',
      actions: <Button variant="glass" icon="list-checks" onPress={() => router.push('/focus-edit' as Href)}>Pick skills</Button>,
    };
  } else if (today.kind === 'rest') {
    card = {
      eyebrow: 'Rest day', image: 'dog_wrapped_in_blanket', title: `Rest day. ${dog.name}’s had a busy few days.`,
      why: 'Rest lets the body recover and the week’s practice sink in.',
      actions: <Button variant="glass" icon="plus" onPress={() => router.push('/log-activity' as Href)}>Log something anyway</Button>,
    };
  } else {
    const drill = today.drills[swap % today.drills.length];
    const skill = skillById(drill.skillId);
    card = {
      eyebrow: 'Off day · Practice', image: drill.image, title: drill.title, meta: `${drill.minutes} min · ${drill.setting} · ${skill?.label ?? ''}`,
      why: skill ? forDog(skill.why, dog.name) : '',
      actions: (
        <>
          <Button variant="signal" icon="play" onPress={() => practice(drill.id)}>Start</Button>
          {today.drills.length > 1 ? <Button variant="glass" icon="shuffle" onPress={() => setSwap((n) => n + 1)}>Swap</Button> : null}
        </>
      ),
    };
  }

  return (
    <View style={{ height, borderRadius: 24, overflow: 'hidden', backgroundColor: c.pitch }}>
      <PhotoFill name={card.image} />
      <Gradient stops={[['rgba(0,0,0,0.3)', 0], ['rgba(0,0,0,0)', 0.22], ['rgba(0,0,0,0.74)', 1]]} />
      <View style={{ position: 'absolute', top: 16, left: 16 }}><Tag tone="glass">{card.eyebrow}</Tag></View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20, gap: 6 }}>
        <Text variant="headline" color="#fff" accessibilityRole="header">{card.title}</Text>
        {card.meta ? <Text variant="label" color="rgba(255,255,255,0.92)">{card.meta}</Text> : null}
        <Text variant="caption" color="rgba(255,255,255,0.88)" style={{ marginTop: 2 }}>{card.why}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{card.actions}</View>
      </View>
    </View>
  );
}
