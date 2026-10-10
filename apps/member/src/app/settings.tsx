import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { INITIAL_CREDITS } from '@/data/fixtures';
import { Button, Chip } from '@/ds/controls';
import { IconButton, Screen, Toggle } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { isLive } from '@/api/client';
import { AccountSection } from '@/features/account/AccountSection';
import { currentOrigin } from '@/lib/here';
import { AREAS } from '@/lib/location';
import { openSite } from '@/lib/site';
import { useApp, type Appearance, useDog, useOriginLabel, usePlan } from '@/store/app';
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
 * Settings: account (name, password, delete), appearance, where distances are measured from, sign out. In sample mode, "Preview states"
 * stands in for the design file's Tweaks panel: it moves the sample data into the states the designs
 * show (re-check passed, clearance expired, out of credits, nothing booked). Live mode hides it.
 */
export default function Settings() {
  const juno = useDog();
  const { c } = useTheme();
  const s = useApp();
  const from = useOriginLabel();
  const plan = usePlan();
  const paid = s.membership.status === 'active' || s.membership.status === 'past_due';
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied'>('idle');
  const useMyLocation = async () => {
    setLocating('busy');
    const here = await currentOrigin().catch(() => null);
    setLocating(here ? 'idle' : 'denied');
    if (here) s.setOrigin(here);
  };
  const stageLabel = { working: 'Working on it', earned: 'Re-check passed, not opened yet', cleared: 'Cleared' }[s.social];

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dog'))} />
        <Text variant="displayXl" style={{ marginTop: 20, marginBottom: 20 }} accessibilityRole="header">Settings</Text>

        <AccountSection />

        <Text variant="title" style={{ marginBottom: 6 }}>Plan</Text>
        <View style={{ marginBottom: 24 }}>
          <Row
            title={paid ? `${plan.name} · ${plan.price}/mo` : 'No paid plan yet'}
            sub={`${s.credits} ${s.credits === 1 ? 'credit' : 'credits'} left`}
            right={<Button size="sm" variant="quiet" fill={c.bg} onPress={() => router.push('/plan')}>{paid ? 'Manage' : 'Choose'}</Button>}
          />
        </View>

        <Text variant="title" style={{ marginBottom: 6 }}>Appearance</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {(['system', 'light', 'dark'] as Appearance[]).map((a) => (
            <Chip key={a} selected={s.appearance === a} onPress={() => s.setAppearance(a)}>{a === 'system' ? 'Match device' : a === 'light' ? 'Light' : 'Dark'}</Chip>
          ))}
        </View>

        <Text variant="title" style={{ marginBottom: 6 }}>Distances from</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: locating === 'denied' ? 6 : 24 }}>
          <Chip selected={from === 'Near you'} onPress={useMyLocation}>{locating === 'busy' ? 'Finding you…' : 'My location'}</Chip>
          {AREAS.map((a) => (
            <Chip key={a.label} selected={from === a.label} onPress={() => { setLocating('idle'); s.setOrigin(a.label === s.area ? null : a); }}>{a.label}</Chip>
          ))}
        </View>
        {locating === 'denied' ? (
          <Text variant="caption" muted style={{ marginBottom: 24 }}>Location is off for PackPass. Pick an area, or allow location in your settings.</Text>
        ) : null}

        <Text variant="title" style={{ marginBottom: 6 }}>Help</Text>
        <View style={{ gap: 8, marginBottom: 24 }}>
          {([['Support', 'Questions about a booking, your plan or your account', '/support'], ['Membership terms', 'Plans, credits, cancelling and the waiver', '/terms'], ['Privacy policy', 'What we collect and how to delete it', '/privacy']] as const).map(([title, sub, path]) => (
            <Row key={path} title={title} sub={sub} right={<Button size="sm" variant="quiet" fill={c.bg} onPress={() => openSite(path)}>Open</Button>} />
          ))}
        </View>

        {isLive ? null : (<>
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
          title="Vet records denied"
          sub="PackPass denies the record and the app shows why."
          right={<Button size="sm" variant="quiet" fill={c.bg} onPress={() => { s.denyRecordDemo(); router.push('/onboarding/records-denied'); }}>Open</Button>}
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

        <Row
          title="Waitlist"
          sub={s.waitlist.length ? `Waiting on ${s.waitlist.length}. A spot opening books the first one more than 12 hours out.` : 'Join a full class to try it.'}
          right={s.waitlist.length ? (
            <Button size="sm" onPress={() => { const r = s.openWaitlistSpot(); if (r?.ok) router.dismissTo('/'); }}>Open a spot</Button>
          ) : null}
        />

        </>)}

        <View style={{ gap: 8, marginTop: 24 }}>
          {isLive ? null : <Button block variant="quiet" onPress={() => { s.resetDemo(); router.dismissTo('/'); }}>Reset sample data</Button>}
          <Button block variant="quiet" onPress={async () => { if (!isLive) s.resetDemo(); await s.signOut(); router.replace('/welcome'); }}>Sign out</Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
