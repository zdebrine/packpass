import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { checkout } from '@/api/live';
import { planOf, PLANS, TOP_UP } from '@/data/plans';
import type { PlanKey } from '@/data/types';
import { Button, Tag } from '@/ds/controls';
import { IconButton, Screen } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { manageBilling, pay, settle } from '@/lib/checkout';
import { comingWithAccounts } from '@/lib/notice';
import { useApp, usePlan } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const onDay = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'the 1st');

/** Settings › Plan and credits: the monthly plan (Stripe Billing) and one-off credit top-ups (Stripe Checkout). */
export default function PlanScreen() {
  const { c } = useTheme();
  const credits = useApp((s) => s.credits);
  const m = useApp((s) => s.membership);
  const plan = usePlan();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const paid = m.status === 'active' || m.status === 'past_due';
  const next = m.nextPlan && m.nextPlan !== m.plan ? planOf(m.nextPlan) : null;

  const thanks = () => {
    setNote({ ok: true, text: 'Payment received. Your credits show here in a moment.' });
    settle().then((changed) => changed && setNote({ ok: true, text: 'Payment received. You\'re all set.' }));
  };
  // Back from Stripe on the web: the page reloads with ?checkout=done.
  useEffect(() => {
    if (params.checkout === 'done') thanks();
    else if (params.checkout === 'cancel') setNote({ ok: false, text: 'Checkout closed. Nothing was charged.' });
    else if (params.checkout === 'portal') useApp.getState().refresh().catch(() => {});
  }, [params.checkout]);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!isLive) return comingWithAccounts('Payments');
    setBusy(key); setNote(null);
    try { await fn(); } catch (e) { setNote({ ok: false, text: errorCopy(e) }); } finally { setBusy(null); }
  };
  const choose = (key: PlanKey) => run(key, async () => {
    const r = await pay({ plan: key }, '/plan');
    if (r === 'done') thanks();
    if (r === 'switched') { await useApp.getState().refresh(); setNote({ ok: true, text: `You'll move to ${planOf(key).name} on ${onDay(m.renewsOn)}, with its credits.` }); }
  });
  const topUp = () => run('credits', async () => { if ((await pay('credits', '/plan')) === 'done') thanks(); });
  const billing = () => run('billing', () => manageBilling('/plan'));
  const setCancel = (cancel: boolean) => run('cancel', async () => {
    await checkout({ action: cancel ? 'cancel' : 'resume' });
    await useApp.getState().refresh();
    setNote({ ok: true, text: cancel ? `Your plan ends on ${onDay(m.renewsOn)}. Credits you have stay until then.` : 'Your plan keeps renewing.' });
  });

  const status = !paid
    ? 'No plan yet. Choose one for credits every month, or buy a few to try a class.'
    : m.status === 'past_due'
      ? 'Your last payment didn\'t go through. Stripe will try your card again.'
      : m.cancels
        ? `${plan.name} ends on ${onDay(m.renewsOn)}.`
        : next
          ? `${plan.name} now. ${next.name} from ${onDay(m.renewsOn)}.`
          : `${plan.name} · ${plan.price} a month · renews ${onDay(m.renewsOn)}`;

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
        <Text variant="displayXl" style={{ marginTop: 20, marginBottom: 20 }} accessibilityRole="header">Plan and credits</Text>

        <View style={{ padding: 20, borderRadius: 28, backgroundColor: c.surfaceRaised, gap: 6, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="display2xl" num>{credits}</Text>
            <Text variant="heading" muted>{credits === 1 ? 'credit left' : 'credits left'}</Text>
          </View>
          <Text variant="caption" muted>{status}</Text>
        </View>
        {note ? <Text variant="caption" weight="600" color={note.ok ? c.turf : c.kennelRed} accessibilityLiveRegion="polite">{note.text}</Text> : null}

        <Text variant="title" style={{ marginTop: 20, marginBottom: 6 }}>Monthly plans</Text>
        {PLANS.map((p) => {
          const current = paid && (m.nextPlan ?? m.plan) === p.key;
          return (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text variant="label" weight="600">{`${p.name} · ${p.price}/mo`}</Text>
                <Text variant="caption" muted>{`${p.credits} credits a month. ${p.fit}`}</Text>
              </View>
              {current ? <Tag>Your plan</Tag> : (
                <Button size="sm" variant="quiet" fill={c.bg} disabled={!!busy} onPress={() => choose(p.key)}>
                  {busy === p.key ? 'Opening…' : paid ? 'Switch' : 'Choose'}
                </Button>
              )}
            </View>
          );
        })}
        <Text variant="caption" muted style={{ marginBottom: 12 }}>
          {paid ? `Switching takes effect on ${onDay(m.renewsOn)}, with the new plan's credits.` : 'Billed monthly through Stripe. Unused credits roll over one month.'}
        </Text>

        <Text variant="title" style={{ marginTop: 12, marginBottom: 6 }}>Need more this month?</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" weight="600">{`${TOP_UP.credits} credits · ${TOP_UP.price}`}</Text>
            <Text variant="caption" muted>One payment, added right away.</Text>
          </View>
          <Button size="sm" disabled={!!busy} onPress={topUp}>{busy === 'credits' ? 'Opening…' : 'Buy'}</Button>
        </View>

        {paid ? (
          <View style={{ marginTop: 24, gap: 8 }}>
            <Button block variant="quiet" disabled={!!busy} onPress={billing}>
              {busy === 'billing' ? 'Opening…' : m.status === 'past_due' ? 'Update your card' : 'Card and receipts'}
            </Button>
            <Button block variant="quiet" disabled={!!busy} onPress={() => setCancel(!m.cancels)}>
              {busy === 'cancel' ? 'Saving…' : m.cancels ? 'Keep my plan' : 'Cancel plan'}
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
