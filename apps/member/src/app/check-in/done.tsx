import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { dogs, PLAN } from '@/data/fixtures';
import { Button } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Badge, Screen, useBottom, useTop, themed } from '@/ds/layout';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { view } from '@/lib/booking';
import { addMinutes, time } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Where to meet at each partner. */
const MEET: Record<string, string> = {
  ridgeline: 'Barn gate, field 2',
  northside: 'Front desk',
  eastfield: 'North field gate',
  eastside: 'Side gate by the yard',
  southfork: 'Yard gate',
};

/** 15 Checked in. Kept plain: checking in is routine, not a milestone. */
function CheckedIn() {
  const { c } = useTheme();
  const top = useTop();
  const bottom = useBottom(32);
  const { booking: id } = useLocalSearchParams<{ booking?: string }>();
  const bookings = useApp((s) => s.bookings);
  const credits = useApp((s) => s.credits);
  const b = bookings.find((x) => x.id === id);
  const v = b ? view(b.sessionId) : undefined;
  const dog = dogs[b?.dogId ?? 'juno'];

  if (!b || !v) return <Redirect href="/" />;

  const rows: [IconName, string, string][] = [
    ['user-round', 'Trainer', v.trainer.name],
    ['map-pin', 'Meet at', MEET[v.partner.id] ?? 'Front gate'],
    ['clock', 'Ends', time(addMinutes(v.session.startsAt, v.cls.durationMin))],
    ['ticket', 'Credits', `${b.credits} used · ${credits} of ${PLAN.credits} left this month`],
  ];

  return (
    <Screen theme="dark" bleed statusLight>
      <View style={{ height: 420, overflow: 'hidden' }}>
        <PhotoFill name={v.cls.image} />
        <Gradient stops={[['rgba(0,0,0,0.4)', 0], ['rgba(0,0,0,0)', 0.26], ['rgba(0,0,0,0.2)', 0.55], ['#0e0f0e', 1]]} />
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20, paddingTop: top }}>
          <View style={{ width: 56, height: 56, borderRadius: 9999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={26} color="#0e0f0e" />
          </View>
          <Text variant="displayXl" color="#fff" style={{ marginTop: 18 }} accessibilityRole="header" accessibilityLiveRegion="polite">{`${dog.name} is checked in.`}</Text>
          <Text variant="label" color="rgba(255,255,255,0.88)" style={{ marginTop: 8 }}>{`${v.cls.title} · ${time(v.session.startsAt)}`}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}>
        {rows.map(([icon, k, val]) => (
          <View key={k} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 14, paddingLeft: 14, paddingRight: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
            <Badge icon={icon} bg={c.bg} fg={c.ink} iconSize={18} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" muted>{k}</Text>
              <Text variant="label" weight="600">{val}</Text>
            </View>
          </View>
        ))}
        <Text variant="caption" muted center style={{ marginTop: 8 }}>{`${v.trainer.name.split(' ')[0]} sends session notes after class.`}</Text>
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: bottom }}>
        <Button block onPress={() => router.dismissTo('/')}>Done</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', CheckedIn);
