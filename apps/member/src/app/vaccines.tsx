import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Footer, IconButton, Screen } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { Select } from '@/features/onboarding/parts';
import { now } from '@/lib/clock';
import { fromIso } from '@/lib/dates';
import { useApp, useDog, type Vaccine, type VaccineType } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const TYPES: VaccineType[] = ['Rabies', 'DHPP', 'Bordetella'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const iso = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay(y, m)).padStart(2, '0')}`;

/**
 * Vaccine records. Bookings need Rabies, DHPP and Bordetella current on the day of the session.
 * Members enter the expiry month from the vet record; uploading the document itself comes later.
 */
export default function Vaccines() {
  const { c } = useTheme();
  const dog = useDog();
  const saved = useApp((s) => s.vaccines);
  const save = useApp((s) => s.saveVaccines);
  const year = now().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => year + i);
  const [rows, setRows] = useState(() =>
    TYPES.map((type) => {
      const v = saved.find((x) => x.type === type);
      const d = v ? fromIso(v.expires) : null;
      return { type, month: d ? d.getMonth() : null, year: d ? d.getFullYear() : null };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = rows.every((r) => r.month !== null && r.year !== null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await save(rows.map((r): Vaccine => ({ type: r.type, expires: iso(r.year!, r.month!) })));
      router.canGoBack() ? router.back() : router.replace('/dog');
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24, gap: 22 }} keyboardShouldPersistTaps="handled">
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dog'))} />
        <View>
          <Text variant="wide" muted>{`${dog.name} · Health and care`}</Text>
          <Text variant="displayLg" style={{ marginTop: 10 }} accessibilityRole="header">Vaccines.</Text>
          <Text muted style={{ marginTop: 10 }}>{`Add when each one expires, from ${dog.name}'s vet record. Every class needs all three current on the day.`}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.type} style={{ gap: 10 }}>
            <Text variant="label" weight="600">{r.type}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Select
                label={`${r.type} expiry month`}
                value={r.month === null ? 'Month' : MONTHS[r.month]}
                options={MONTHS}
                onPick={(m) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, month: MONTHS.indexOf(m) } : x)))}
              />
              <Select
                label={`${r.type} expiry year`}
                value={r.year ?? 'Year'}
                options={years}
                onPick={(y) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, year: Number(y) } : x)))}
              />
            </View>
          </View>
        ))}
        {error ? <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text> : null}
      </ScrollView>
      <Footer>
        <Button block disabled={!complete || busy} onPress={submit}>{busy ? 'Saving…' : 'Save vaccines'}</Button>
        <Text variant="caption" muted center>Partners can ask to see the paperwork at the first visit.</Text>
      </Footer>
    </Screen>
  );
}
