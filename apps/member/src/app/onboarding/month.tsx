import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { MONTH_PLAN, MONTH_SWAPS, PLAN, PLAN_GOALS } from '@/data/fixtures';
import { Button } from '@/ds/controls';
import { Meter, MiniButton, Screen, useBottom, themed } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const TARGET = { Physical: 2, Mental: 2, Social: 2 };

/** 01j Juno's month. Five suggested sessions over 4 weeks that fit the Regular plan; each can be swapped. */
function Month() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const d = useApp((s) => s.draft);
  const swaps = useApp((s) => s.planSwaps);
  const toggleSwap = useApp((s) => s.toggleSwap);
  const finish = useApp((s) => s.finishOnboarding);
  const name = d.dogName.trim() || 'Your dog';

  const rows = MONTH_PLAN.map((r) => {
    const sw = swaps.includes(r.title) ? MONTH_SWAPS[r.title] : null;
    const meta = sw?.meta ?? r.meta;
    const credits = Number(meta.match(/(\d+) credit/)?.[1] ?? r.credits);
    const balance = meta.split(' · ').pop() as keyof typeof TARGET;
    return { key: r.title, when: r.when, title: sw?.title ?? r.title, meta, photo: sw?.photo ?? r.photo, credits, balance };
  });
  const used = rows.reduce((n, r) => n + r.credits, 0);
  const left = PLAN.credits - used;
  const balance = (Object.keys(TARGET) as (keyof typeof TARGET)[]).map((k) => ({
    label: k,
    pct: rows.filter((r) => r.balance === k).length / TARGET[k],
    color: k === 'Physical' ? c.agility : k === 'Mental' ? c.turf : c.pitch,
  }));
  const goals = PLAN_GOALS.filter((g) => d.traits.includes(g.trait));

  const done = () => {
    finish();
    router.replace('/');
  };

  return (
    <Screen theme="dark">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text variant="wide" muted>Built from what you told us</Text>
        <Text variant="displayLg" style={{ marginTop: 10 }}>{`${name}'s month.`}</Text>
        <Text muted style={{ marginTop: 10 }}>
          {`Five sessions over the next 4 weeks, balanced for a ${d.energy === 'Working dog' ? 'working dog' : `${d.energy.toLowerCase()} energy dog`} who ${d.social === 'Loves dogs' ? 'loves other dogs' : d.social === 'Selective' ? 'is selective with other dogs' : 'prefers to work solo'}. Swap anything.`}
        </Text>

        <View style={{ gap: 8, marginTop: 20 }}>
          {rows.map((r) => (
            <View key={r.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
              <Photo name={r.photo} style={{ width: 52, height: 52, borderRadius: 12 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="caption" muted>{r.when}</Text>
                <Text variant="label" weight="600">{r.title}</Text>
                <Text variant="caption" muted >{r.meta}</Text>
              </View>
              <MiniButton onPress={() => toggleSwap(r.key)}>Swap</MiniButton>
            </View>
          ))}
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
      </ScrollView>
      <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: bottom, gap: 8 }}>
        <Button variant="signal" block onPress={done}>Book these</Button>
        <Button variant="quiet" block onPress={done}>Skip for now</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', Month);
