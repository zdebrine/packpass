import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { INITIAL_CREDITS } from '@/data/fixtures';
import { Button, Chip } from '@/ds/controls';
import { IconButton, Screen, Toggle } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { useApp, type Appearance, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';


function Row({ title, sub, right }: { title: string; sub?: string; right: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" weight="600">{title}</Text>
        {sub ? <Text variant="caption" muted>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/**
 * Settings. "Preview states" stands in for the design file's Tweaks panel: it moves the sample data into the
 * states the designs show (re-check passed, clearance expired, out of credits, nothing booked).
 */
export default function Settings() {
  const juno = useDog();
  const { c } = useTheme();
  const s = useApp();
  const stageLabel = { working: 'Working on it', earned: 'Re-check passed, not opened yet', cleared: 'Cleared' }[s.social];

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dog'))} />
        <Text variant="displayXl" style={{ marginTop: 20, marginBottom: 20 }} accessibilityRole="header">Settings</Text>

        <Text variant="title" style={{ marginBottom: 6 }}>Appearance</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {(['system', 'light', 'dark'] as Appearance[]).map((a) => (
            <Chip key={a} selected={s.appearance === a} onPress={() => s.setAppearance(a)}>{a === 'system' ? 'Match device' : a === 'light' ? 'Light' : 'Dark'}</Chip>
          ))}
        </View>

        <Text variant="title">Preview states</Text>
        <Text variant="caption" muted style={{ marginBottom: 6 }}>This build runs on sample data. Use these to see the states in the designs.</Text>

        <Row
          title="Social clearance"
          sub={stageLabel}
          right={s.social === 'working' ? (
            <Button size="sm" onPress={() => { s.passSocialRecheck(); router.dismissTo('/'); }}>Pass re-check</Button>
          ) : s.social === 'earned' ? (
            <Button size="sm" variant="signal" onPress={() => router.push('/clearance-earned')}>Open</Button>
          ) : null}
        />
        <Row
          title="Social clearance expired"
          sub={s.social === 'cleared' ? 'Shows the re-check prompt on the Passport.' : `Available once ${juno.name} is cleared.`}
          right={<Toggle on={s.socialExpired} label="Social clearance expired" onPress={() => s.social === 'cleared' && s.setDemo({ socialExpired: !s.socialExpired })} />}
        />
        <Row
          title="Behaviorist note on the path"
          sub="Calm around dogs suggests certified behaviorists."
          right={<Toggle on={s.behaviorNote} label="Behaviorist note" onPress={() => s.setDemo({ behaviorNote: !s.behaviorNote })} />}
        />
        <Row
          title="Credits"
          sub={`${s.credits} left this month`}
          right={<Button size="sm" variant="quiet" fill={c.bg} onPress={() => s.setCredits(s.credits <= 1 ? INITIAL_CREDITS : 1)}>{s.credits <= 1 ? 'Restore' : 'Set to 1'}</Button>}
        />
        <Row
          title="Upcoming bookings"
          sub={`${s.bookings.filter((b) => b.status === 'booked').length} booked`}
          right={<Button size="sm" variant="quiet" fill={c.bg} onPress={s.clearBookings}>Clear</Button>}
        />

        <View style={{ gap: 8, marginTop: 24 }}>
          <Button block variant="quiet" onPress={() => { s.resetDemo(); router.dismissTo('/'); }}>Reset sample data</Button>
          <Button block variant="quiet" onPress={() => { s.resetDemo(); s.signOut(); router.replace('/welcome'); }}>Sign out</Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
