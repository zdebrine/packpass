import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy, SHORT } from '@/api/errors';
import { MONTH_PLAN, MONTH_PLAN_NEW_DOG, PLAN, PLAN_GOALS } from '@/data/fixtures';
import { Button, Pill } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Meter, MiniButton, Screen, themed, useBottom } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { bookError, credits as creditsLabel, sessionOn } from '@/lib/booking';
import { time, weekday } from '@/lib/dates';
import { enablePush } from '@/lib/push';
import { useApp, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const TARGET = { Physical: 2, Mental: 2, Social: 2 };

/** error: null = booked; 'after' = held until the Social assessment is passed. */
type Result = { title: string; error: string | null };

/**
 * 01j Juno's month. Five suggested sessions over 4 weeks that fit Regular; each can be swapped.
 * A dog without a Social clearance gets a month that leads with a Social assessment: week 1 books now,
 * and the group sessions after it are held until the assessment is passed (Today then offers to book them).
 * "Book these" books each real session on its own and reports any it had to skip, and why.
 */
function Month() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const d = useApp((s) => s.draft);
  const swaps = useApp((s) => s.planSwaps);
  const toggleSwap = useApp((s) => s.toggleSwap);
  const finish = useApp((s) => s.finishOnboarding);
  const bookMany = useApp((s) => s.bookMany);
  const holdSessions = useApp((s) => s.holdSessions);
  const rules = useRules();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const name = d.dogName.trim() || 'Your dog';

  const leadWithAssessment = !rules.hasSocial;
  const plan = leadWithAssessment ? MONTH_PLAN_NEW_DOG : MONTH_PLAN;
  const rows = plan.map((r) => {
    const pick = r.swap && swaps.includes(r.classId) ? r.swap : r;
    const v = sessionOn(pick.classId, pick.day);
    const open = { ...rules, credits: 99, bookings: [] };
    let block: string | null = v ? bookError(v.session.id, 'onboarding', open) : 'not_found';
    // Held for after the assessment, unless something else (vaccines, full) would still stop it.
    let after = false;
    if (block === 'needs_social' && leadWithAssessment && v) {
      block = bookError(v.session.id, 'onboarding', { ...open, hasSocial: true });
      after = block === null;
    }
    return { key: r.classId, day: pick.day, v, block, after, canSwap: !!r.swap };
  });
  const planned = rows.filter((r) => r.v);
  const used = planned.reduce((n, r) => n + r.v!.cls.credits, 0);
  const left = PLAN.credits - used;
  const balance = (Object.keys(TARGET) as (keyof typeof TARGET)[]).map((k) => ({
    label: k,
    pct: planned.filter((r) => r.v!.cls.balance === k).length / TARGET[k],
    color: k === 'Physical' ? c.agility : k === 'Mental' ? c.turf : c.pitch,
  }));
  const goals = PLAN_GOALS.filter((g) => d.traits.includes(g.trait));

  const go = async (book: boolean) => {
    setBusy(true);
    setFailure(null);
    try {
      await finish();
      if (!book) return router.replace('/');
      const dogId = useApp.getState().dogs[0]?.id;
      // Book what's open now, hold what waits on the assessment, and report the rest with their reason.
      const now = planned.filter((r) => !r.after && !r.block);
      const later = planned.filter((r) => r.after);
      const blocked = planned.filter((r) => !r.after && r.block);
      const out = await bookMany(now.map((r) => r.v!.session.id), dogId);
      // The rest is held on the server: the spot is reserved, credits are charged when it books.
      const held = later.length ? await holdSessions(later.map((r) => r.v!.session.id), dogId) : [];
      // Holds release a day before the session; ask now so the reminder can reach the phone.
      if (held.some((h) => !h.error)) await enablePush();
      const title = (id: string) => planned.find((r) => r.v!.session.id === id)?.v?.cls.title ?? 'Session';
      setResults([
        ...out.map((o) => ({ title: title(o.sessionId), error: o.error })),
        ...blocked.map((r) => ({ title: r.v!.cls.title, error: r.block })),
        ...held.map((h) => ({ title: title(h.sessionId), error: h.error ?? 'after' })),
      ]);
    } catch (e) {
      setFailure(errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  if (results) {
    const booked = results.filter((r) => !r.error);
    const held = results.filter((r) => r.error === 'after');
    const skipped = results.filter((r) => r.error && r.error !== 'after');
    return (
      <Screen>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}>
          <Text variant="wide" muted>{`${name}'s month`}</Text>
          <Text variant="displayLg" style={{ marginBottom: 10 }} accessibilityLiveRegion="polite">
            {booked.length === 0 ? 'Nothing booked yet.' : held.length ? `Week 1 is booked.` : `Booked ${booked.length} of ${results.length}.`}
          </Text>
          {results.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
              <Icon name={!r.error ? 'check' : r.error === 'after' ? 'clock' : 'x'} color={!r.error ? c.turf : c.inkMuted} />
              <View style={{ flex: 1 }}>
                <Text variant="label" weight="600">{r.title}</Text>
                <Text variant="caption" muted>{!r.error ? 'Booked' : r.error === 'after' ? 'Spot held until the Social assessment' : `Skipped: ${SHORT[r.error] ?? errorCopy(r.error)}`}</Text>
              </View>
            </View>
          ))}
          {held.length ? (
            <Text variant="caption" muted style={{ marginTop: 6 }}>{`Your spots are held, with no credits used yet. Once ${name} passes the Social assessment, book them from Today in one tap. We'll remind you a day before any held spot is released.`}</Text>
          ) : null}
          {skipped.some((r) => r.error === 'needs_social') ? (
            <Text variant="caption" muted style={{ marginTop: 6 }}>{`Group classes open once ${name} has a Social clearance. Path sessions are open now.`}</Text>
          ) : null}
          {skipped.some((r) => r.error === 'vaccines') ? (
            <Text variant="caption" muted>{`Update ${name}'s vaccines to book further out.`}</Text>
          ) : null}
        </ScrollView>
        <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: bottom }}>
          <Button block onPress={() => router.replace('/')}>Go to Today</Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text variant="wide" muted>Built from what you told us</Text>
        <Text variant="displayLg" style={{ marginTop: 10 }}>{`${name}'s month.`}</Text>
        <Text muted style={{ marginTop: 10 }}>
          {leadWithAssessment
            ? `It starts with a Social assessment, so trainers can match ${name} to the right groups. Group sessions open once it's passed. Swap anything.`
            : `Five sessions over the next 4 weeks, balanced for a ${d.energy === 'Working dog' ? 'working dog' : `${d.energy.toLowerCase()} energy dog`} who ${d.social === 'Loves dogs' ? 'loves other dogs' : d.social === 'Selective' ? 'is selective with other dogs' : 'prefers to work solo'}. Swap anything.`}
        </Text>

        <View style={{ gap: 8, marginTop: 20 }}>
          {rows.map((r) =>
            r.v ? (
              <View key={r.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
                <Photo name={r.v.cls.image} style={{ width: 52, height: 52, borderRadius: 12 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="caption" muted>{`Week ${Math.floor(r.day / 7) + 1} · ${weekday(r.v.session.startsAt).slice(0, 3)} ${time(r.v.session.startsAt)}`}</Text>
                  <Text variant="label" weight="600">{r.v.cls.title}</Text>
                  <Text variant="caption" muted>{`${r.v.partner.name} · ${creditsLabel(r.v.cls.credits)} · ${r.v.cls.balance}`}</Text>
                  {r.block ? (
                    <View style={{ flexDirection: 'row', marginTop: 6 }}><Pill tone="muted" icon={r.block === 'vaccines' ? 'syringe' : 'shield'}>{SHORT[r.block] ? SHORT[r.block].charAt(0).toUpperCase() + SHORT[r.block].slice(1) : r.block}</Pill></View>
                  ) : r.after ? (
                    <View style={{ flexDirection: 'row', marginTop: 6 }}><Pill tone="muted" icon="lock">Opens after the assessment</Pill></View>
                  ) : r.v.cls.grants === 'social' ? (
                    <View style={{ flexDirection: 'row', marginTop: 6 }}><Pill tone="pitch" icon="shield-check">Starts here</Pill></View>
                  ) : null}
                </View>
                {r.canSwap ? <MiniButton onPress={() => toggleSwap(r.key)}>Swap</MiniButton> : null}
              </View>
            ) : null,
          )}
        </View>

        <View style={{ gap: 10, marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Text variant="label" weight="600">{`${used} of ${PLAN.credits} credits on ${PLAN.name}`}</Text>
            <Text variant="caption" muted>{`${left} ${left === 1 ? 'credit' : 'credits'} left for anything`}</Text>
          </View>
          {balance.map((b) => (
            <View key={b.label} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Text variant="caption" style={{ width: 64 }}>{b.label}</Text>
              <Meter pct={b.pct} color={b.color} height={6} />
            </View>
          ))}
        </View>

        {goals.map((g) => (
          <View key={g.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, boxShadow: `inset 0 0 0 1px ${c.surfaceSunken}` }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="caption" muted>{`Optional add-on · ${g.trait}`}</Text>
              <Text variant="label" weight="600">{g.title}</Text>
              <Text variant="caption" muted>{g.outcome}</Text>
            </View>
            <Text variant="label" weight="600" num>3 credits</Text>
          </View>
        ))}
        {failure ? <Text variant="label" color={c.kennelRed} style={{ marginTop: 16 }}>{failure}</Text> : null}
      </ScrollView>
      <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: bottom, gap: 8 }}>
        <Button variant="signal" block disabled={busy} onPress={() => go(true)}>{busy ? 'Booking…' : 'Book these'}</Button>
        <Button variant="quiet" block disabled={busy} onPress={() => go(false)}>Skip for now</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', Month);
