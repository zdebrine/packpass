import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { credits as creditsLabel, nextSession } from '@/lib/booking';
import { STATUS_LABEL } from '@/data/passport';
import { useClearances } from '@/lib/clearances';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Badge, IconButton, useBottom, useTop } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { ModalSheet } from '@/ds/sheet';
import { useWide } from '@/ds/responsive';
import { Text } from '@/ds/Text';
import { useClearanceStyle } from '@/features/passport/style';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const close = () => (router.canGoBack() ? router.back() : router.replace('/dog'));

/** 09 Clearance detail (sheet over the Passport) */
export default function ClearanceDetail() {
  const juno = useDog();
  const { c } = useTheme();
  const wide = useWide();
  const top = useTop();
  const bottom = useBottom(34);
  const { type } = useLocalSearchParams<{ type: string }>();
  const social = useApp((s) => s.social);
  const passport = useClearances();
  const k = type === 'herding' ? passport.herding : passport.social;
  const recheck = k.rebook ? nextSession(k.rebook) : k.type === 'social' ? nextSession('social-recheck') : undefined;
  const st = useClearanceStyle()(k);
  const facts: [string, string, string][] = [['Status', STATUS_LABEL[k.status], st.color], ...k.facts.map(([a, b]) => [a, b, c.ink] as [string, string, string])];

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Badge icon={st.icon} bg={st.bg} fg={st.fg} size={52} iconSize={24} />
      <View style={{ flex: 1 }}>
        <Text variant="wide" muted>{k.eyebrow}</Text>
        <Text variant="displayLg" style={{ marginTop: 4 }}>{k.name}</Text>
      </View>
    </View>
  );

  const details = (
    <>
      {k.status === 'expired' ? (
        <View style={{ marginTop: 20, padding: 18, borderRadius: 12, backgroundColor: c.kennelRedSoft, gap: 12 }}>
          <Text variant="label" weight="600" color={c.kennelRed}>{k.note ?? 'Social clearance expired. Book a quick re-check to keep group classes open.'}</Text>
          {recheck ? (
            <Button block onPress={() => router.replace(`/book/${recheck.session.id}`)}>{`Book a ${k.type === 'herding' ? 're-assessment' : 're-check'} · ${creditsLabel(recheck.cls.credits)}`}</Button>
          ) : (
            <Text variant="caption" muted>{`No ${k.type === 'herding' ? 're-assessment' : 're-check'} times in the next 4 weeks. Check back soon.`}</Text>
          )}
        </View>
      ) : null}
      {k.status === 'working' && social === 'earned' ? (
        <View style={{ marginTop: 20, padding: 18, borderRadius: 12, backgroundColor: c.turfSoft, gap: 12 }}>
          <Text variant="label"><Text variant="label" weight="600" color={c.turf}>{`${juno.name} passed the re-check.`}</Text>{' Open the result to add Social to the Passport.'}</Text>
          <Button block onPress={() => router.replace('/clearance-earned')}>See what’s unlocked</Button>
        </View>
      ) : k.status === 'working' ? (
        <View style={{ marginTop: 20, padding: 18, borderRadius: 12, backgroundColor: c.turfSoft, gap: 12 }}>
          <Text variant="label"><Text variant="label" weight="600" color={c.turf}>{`${juno.name} is working on this.`}</Text>{' Finish Calm around dogs to earn a Social clearance.'}</Text>
          <Button block onPress={() => router.replace('/goal/calm-around-dogs')}>See the path</Button>
        </View>
      ) : null}
      {k.status === 'needs' ? (
        <View style={{ marginTop: 20, padding: 18, borderRadius: 12, backgroundColor: c.surfaceRaised, gap: 12 }}>
          <Text variant="label">{k.note}</Text>
          <Button block onPress={() => { const a = nextSession(k.type === 'herding' ? 'herding-assessment' : 'social-assessment'); if (a) router.replace(`/book/${a.session.id}`); }}>Book assessment</Button>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        {facts.map(([a, b, color]) => (
          <View key={a} style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 14 }}>
            <Text variant="caption" muted>{a}</Text>
            <Text variant="label" weight="600" color={color} style={{ marginTop: 4 }}>{b}</Text>
          </View>
        ))}
      </View>

      <Text variant="title" style={{ marginTop: 28, marginBottom: 12 }}>What this unlocks</Text>
      <View style={{ gap: 14 }}>
        {k.unlocks.map((u) => (
          <View key={u.label} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Badge icon={u.icon} bg={c.surfaceRaised} fg={c.ink} iconSize={18} />
            <View style={{ flex: 1 }}>
              <Text variant="label" weight="600">{u.label}</Text>
              <Text variant="caption" muted>{u.ex}</Text>
            </View>
          </View>
        ))}
      </View>

      {k.strengths ? (
        <>
          <Text variant="title" style={{ marginTop: 28, marginBottom: 4 }}>Assessor notes</Text>
          <Text variant="caption" muted style={{ marginBottom: 14 }}>{k.assessor}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 14, gap: 8 }}>
              <Text variant="caption" weight="600">Strengths</Text>
              {k.strengths.map((x) => (
                <View key={x} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                  <Icon name="check" size={14} />
                  <Text variant="caption" style={{ flex: 1 }}>{x}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1, backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 14, gap: 8 }}>
              <Text variant="caption" weight="600" color={c.turf}>Working on</Text>
              {k.working?.map((x) => (
                <View key={x} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                  <Icon name="trending-up" size={14} color={c.turf} />
                  <Text variant="caption" style={{ flex: 1 }}>{x}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </>
  );

  if (wide) {
    return (
      <Overlay kind="panel" width={480} onClose={close}>
        <View style={{ paddingTop: 28, paddingHorizontal: 28, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>{header}</View>
            <IconButton icon="x" size={40} label="Close" onPress={close} />
          </View>
          {details}
        </View>
      </Overlay>
    );
  }

  return (
    <ModalSheet
      onClose={close}
      top={top + 42}
      scroll
      padding={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: bottom }}
    >
      {header}

      {details}
    </ModalSheet>
  );
}
