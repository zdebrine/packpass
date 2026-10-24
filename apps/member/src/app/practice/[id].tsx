import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { drillById, forDog, LEVEL_LABEL, skillById, TRAINER_LINE } from '@/data/practice';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Footer, IconButton, Screen, useTop } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { col, Columns, Page, useWide, web } from '@/ds/responsive';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const clockLabel = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

/**
 * 07 Practice: one drill, step by step. Start runs a timer and counts reps; Finish hands the minutes and reps to
 * Log activity (?drill=&dur=&reps=), where the owner rates it and saves.
 */
export default function Practice() {
  const { c } = useTheme();
  const wide = useWide();
  const top = useTop();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dog = useDog();
  const drill = drillById(id);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);
  const [reps, setReps] = useState(0);
  const [step, setStep] = useState(-1);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/log'));

  // Counted from the start time, so the timer stays right when the app is in the background.
  useEffect(() => {
    if (startedAt == null) return;
    const tick = () => setSecs(Math.floor((Date.now() - startedAt) / 1000));
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt]);

  if (!drill) return <Screen><View style={{ padding: 20 }}><Text muted>That drill isn’t available.</Text></View></Screen>;
  const skill = skillById(drill.skillId);
  const say = (t: string) => forDog(t, dog.name);
  const started = startedAt != null;
  const start = () => { setStartedAt(Date.now()); setStep(0); };
  const finish = () => router.replace(`/log-activity?drill=${drill.id}&dur=${Math.max(1, Math.round(secs / 60))}&reps=${reps}` as Href);

  const eyebrow = [skill?.label, LEVEL_LABEL[drill.level]].filter(Boolean).join(' · ');
  const meta = `${drill.minutes} min · ${drill.setting}`;
  const body = (
    <View style={{ gap: 28 }}>
      <View>
        <Text variant="eyebrow" muted style={{ marginBottom: 8 }}>Goal</Text>
        <Text variant="title">{say(drill.goal)}</Text>
      </View>
      {skill?.trainerLed ? (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised, flexDirection: 'row', gap: 12 }}>
          <Icon name="stethoscope" />
          <Text variant="label" style={{ flex: 1 }}>{TRAINER_LINE}</Text>
        </View>
      ) : null}
      <View>
        <Text variant="eyebrow" muted style={{ marginBottom: 10 }}>You’ll need</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {drill.needs.map((n) => (
            <View key={n} style={{ height: 36, paddingHorizontal: 14, borderRadius: 9999, backgroundColor: c.surfaceRaised, justifyContent: 'center' }}>
              <Text variant="label">{say(n)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View>
        <Text variant="eyebrow" muted style={{ marginBottom: 10 }}>Steps</Text>
        <View style={{ gap: 4 }}>
          {drill.steps.map((text, i) => {
            const cur = i === step, done = i < step;
            return (
              <Press key={i} onPress={() => setStep(i)} accessibilityLabel={`Step ${i + 1}: ${say(text)}`} accessibilityState={{ selected: cur }}
                style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: cur ? c.surfaceRaised : 'transparent' }}>
                <View style={{ width: 28, height: 28, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: cur ? c.inverse : done ? c.turf : c.surfaceRaised }}>
                  <Text style={{ fontSize: 13, lineHeight: 16 }} weight="600" color={cur ? c.onInverse : done ? c.onTurf : c.inkMuted}>{String(i + 1)}</Text>
                </View>
                <Text style={{ flex: 1, minWidth: 0, paddingTop: 2 }} color={step >= 0 && !cur && !done ? c.inkMuted : c.ink}>{say(text)}</Text>
              </Press>
            );
          })}
        </View>
        {started && step < drill.steps.length - 1 ? (
          <View style={{ marginTop: 10, flexDirection: 'row' }}>
            <Button variant="quiet" size="sm" icon="arrow-down" onPress={() => setStep((s) => s + 1)}>Next step</Button>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flexGrow: 1, flexBasis: 200, padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="circle-check" size={18} color={c.turf} />
            <Text variant="heading">What good looks like</Text>
          </View>
          <Text variant="label" style={{ marginTop: 8 }}>{say(drill.good)}</Text>
        </View>
        <View style={{ flexGrow: 1, flexBasis: 200, padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="octagon-alert" size={18} />
            <Text variant="heading">Stop if</Text>
          </View>
          <Text variant="label" style={{ marginTop: 8 }}>{say(drill.stop)}</Text>
        </View>
      </View>
    </View>
  );
  // Phone: one row in the footer. Desktop: stacked in the aside card, where a quiet button would vanish.
  const bar = (aside: boolean) => {
    if (!started) return <Button variant="signal" block icon="play" onPress={start}>Start practice</Button>;
    const readout = (
      <View style={{ flex: aside ? undefined : 1, minWidth: 0 }} accessibilityLiveRegion="polite">
        <Text variant="statNum" num style={{ fontSize: 28, lineHeight: 28 }} accessibilityLabel={`${Math.floor(secs / 60)} minutes ${secs % 60} seconds`}>{clockLabel(secs)}</Text>
        <Text variant="caption" muted style={{ marginTop: 4 }} numberOfLines={1}>{`${reps} ${reps === 1 ? 'rep' : 'reps'} · ${drill.title}`}</Text>
      </View>
    );
    const buttons = (
      <>
        <Button variant={aside ? 'outline' : 'quiet'} onPress={finish} style={aside ? { flex: 1 } : undefined}>Finish</Button>
        <Button onPress={() => setReps((n) => n + 1)} style={aside ? { flex: 1 } : undefined}>+1 rep</Button>
      </>
    );
    return aside
      ? <View style={{ gap: 16 }}>{readout}<View style={{ flexDirection: 'row', gap: 10 }}>{buttons}</View></View>
      : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{readout}{buttons}</View>;
  };
  const heading = (big: boolean) => (
    <>
      <Tag tone="glass">{eyebrow}</Tag>
      <Text variant={big ? 'hero' : 'headline'} color="#fff" style={{ marginTop: 12 }} accessibilityRole="header">{drill.title}</Text>
      <Text variant="label" color="rgba(255,255,255,0.92)" style={{ marginTop: 6 }}>{meta}</Text>
    </>
  );

  if (wide) {
    return (
      <Page>
        <Press onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ alignSelf: 'flex-start', height: 40, paddingLeft: 10, paddingRight: 16, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Icon name="chevron-left" size={18} />
          <Text variant="label" weight="600">Back</Text>
        </Press>
        <View style={{ height: 320, borderRadius: 24, overflow: 'hidden', backgroundColor: c.pitch }}>
          <PhotoFill name={drill.image} position={{ top: '35%', left: '50%' }} />
          <Gradient stops={[['rgba(0,0,0,0.3)', 0], ['rgba(0,0,0,0)', 0.3], ['rgba(0,0,0,0.74)', 1]]} />
          <View style={{ position: 'absolute', left: 32, right: 32, bottom: 28 }}>{heading(true)}</View>
        </View>
        <Columns gap={40} style={{ marginTop: 32 }}>
          <View style={col(999, 520)}>{body}</View>
          <View style={col(1, 320, web({ position: 'sticky', top: 24, padding: 20, borderRadius: 16, backgroundColor: c.surfaceRaised }))}>
            <Text variant="heading" style={{ marginBottom: 14 }}>{started ? 'Practising' : `About ${drill.minutes} minutes`}</Text>
            {bar(true)}
          </View>
        </Columns>
      </Page>
    );
  }
  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: 320, overflow: 'hidden', backgroundColor: c.pitch }}>
          <PhotoFill name={drill.image} />
          <Gradient stops={[['rgba(0,0,0,0.4)', 0], ['rgba(0,0,0,0)', 0.3], ['rgba(0,0,0,0.74)', 1]]} />
          <IconButton glass icon="chevron-left" label="Back" onPress={back} style={{ position: 'absolute', top: top + 8, left: 20 }} />
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20 }}>{heading(false)}</View>
        </View>
        <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 28 }}>{body}</View>
      </ScrollView>
      <Footer>{bar(false)}</Footer>
    </Screen>
  );
}
