import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { Button } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Badge, Screen, useBottom, useTop, themed } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { tile, useWide } from '@/ds/responsive';
import { Gradient, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { view } from '@/lib/booking';
import { addMinutes, time } from '@/lib/dates';
import { useAllowance, useApp } from '@/store/app';
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
  const wide = useWide();
  const top = useTop();
  const bottom = useBottom(32);
  const { booking: id } = useLocalSearchParams<{ booking?: string }>();
  const bookings = useApp((s) => s.bookings);
  const credits = useApp((s) => s.credits);
  const allowance = useAllowance();
  const b = bookings.find((x) => x.id === id);
  const v = b ? view(b.sessionId) : undefined;
  // The dog that was checked in (in live mode an id from the server, so not the sample fixtures).
  const dog = useApp((s) => s.dogs.find((d) => d.id === b?.dogId) ?? s.dogs[0]);

  if (!b || !v) return <Redirect href="/" />;

  const rows: [IconName, string, string][] = [
    ['user-round', 'Trainer', v.trainer.name],
    ['map-pin', 'Meet at', MEET[v.partner.id] ?? 'Front gate'],
    ['clock', 'Ends', time(addMinutes(v.session.startsAt, v.cls.durationMin))],
    ['ticket', 'Credits', allowance ? `${b.credits} used · ${credits} of ${allowance} left this month` : `${b.credits} used · ${credits} left`],
  ];

  const done = () => router.dismissTo('/');
  const notes = `${v.trainer.name.split(' ')[0]} sends session notes after class.`;
  const row = ([icon, k, val]: [IconName, string, string], extra?: ViewStyle) => (
    <View key={k} style={[{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 14, paddingLeft: 14, paddingRight: 16, borderRadius: 12, backgroundColor: c.surfaceRaised }, extra]}>
      <Badge icon={icon} bg={c.bg} fg={c.ink} iconSize={18} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>{k}</Text>
        <Text variant="label" weight="600">{val}</Text>
      </View>
    </View>
  );

  if (wide) {
    return (
      <Overlay kind="dialog" width={640} dim={0.6} onClose={done}>
        <View style={{ height: 320, overflow: 'hidden' }}>
          <PhotoFill name={v.cls.image} />
          <Gradient stops={[['rgba(0,0,0,0.3)', 0], ['rgba(0,0,0,0)', 0.3], ['rgba(0,0,0,0.2)', 0.55], ['#0e0f0e', 1]]} />
          <View style={{ position: 'absolute', left: 28, right: 28, bottom: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 9999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={28} color="#0e0f0e" />
            </View>
            <Text variant="displayXl" color="#fff" style={{ marginTop: 18 }} accessibilityRole="header" accessibilityLiveRegion="polite">{`${dog.name} is checked in.`}</Text>
            <Text variant="label" color="rgba(255,255,255,0.88)" style={{ marginTop: 8 }}>{`${v.cls.title} · ${time(v.session.startsAt)}`}</Text>
          </View>
        </View>
        <View style={{ paddingTop: 12, paddingHorizontal: 28, paddingBottom: 28 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {rows.map((r) => row(r, tile(240)))}
          </View>
          <Text variant="caption" muted center style={{ marginTop: 14, marginBottom: 20 }}>{notes}</Text>
          <Button block onPress={done}>Done</Button>
        </View>
      </Overlay>
    );
  }

  return (
    <Screen theme="dark" bleed statusLight>
      <View style={{ height: 320, overflow: 'hidden' }}>
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
        {rows.map((r) => row(r))}
        <Text variant="caption" muted center style={{ marginTop: 8 }}>{notes}</Text>
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: bottom }}>
        <Button block onPress={done}>Done</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', CheckedIn);
