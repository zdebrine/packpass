import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import type { PickedDoc } from '@/data/types';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Footer, IconButton, Screen } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { Select } from '@/features/onboarding/parts';
import { now } from '@/lib/clock';
import { fromIso } from '@/lib/dates';
import { pickRecordPdf, pickRecordPhoto } from '@/lib/records';
import { useApp, useDog, type Vaccine, type VaccineType } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const TYPES: VaccineType[] = ['Rabies', 'DHPP', 'Bordetella'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const iso = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay(y, m)).padStart(2, '0')}`;

/**
 * Vaccine records. Bookings need Rabies, DHPP and Bordetella current on the day of the session.
 * Members enter the expiry month from the vet record and attach the record itself (a photo or a PDF,
 * one for all three), which stays unverified until a partner or PackPass checks it.
 */
export default function Vaccines() {
  const { c } = useTheme();
  const active = useDog();
  // Adding another dog: the dates and record are for the new dog, saved with it at the end of onboarding.
  const adding = useApp((s) => s.addingDog);
  const draftName = useApp((s) => s.draft.dogName.trim());
  const dog = adding ? { ...active, name: draftName || 'Your dog' } : active;
  const saved = useApp((s) => s.vaccines);
  const record = useApp((s) => s.vaccineRecord);
  const [doc, setDoc] = useState<PickedDoc | null>(null);
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
      await save(rows.map((r): Vaccine => ({ type: r.type, expires: iso(r.year!, r.month!) })), doc);
      if (router.canGoBack()) router.back(); else router.replace('/dog');
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (fn: () => Promise<PickedDoc | null>) => {
    setError(null);
    try {
      const picked = await fn();
      if (picked) setDoc(picked);
    } catch (e) {
      setError((e as Error).message === 'too_big' ? 'That file is over 10 MB. A photo of the page works too.' : errorCopy(e));
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
        <View style={{ gap: 10 }}>
          <Text variant="label" weight="600">Vet record</Text>
          {doc || record ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
              <Icon name="file-text" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label" weight="600" numberOfLines={1}>{(doc ?? record)!.name}</Text>
                {doc ? <Text variant="caption" muted>Uploads when you save</Text>
                  : record!.review?.status === 'denied' ? <Text variant="caption" weight="600" color={c.kennelRed}>{`Denied: ${record!.review.reason}`}</Text>
                  : <Text variant="caption" muted>{record!.verified ? 'Checked by PackPass' : 'Waiting for PackPass to check it'}</Text>}
              </View>
              {doc ? <Button size="sm" variant="quiet" fill={c.bg} onPress={() => setDoc(null)}>Remove</Button> : null}
            </View>
          ) : (
            <Text variant="caption" muted>{`A photo or PDF of ${dog.name}'s vaccine certificate. One record that shows all three is enough.`}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button size="sm" variant="quiet" icon="camera" onPress={() => pick(pickRecordPhoto)}>{doc || record ? 'Replace with a photo' : 'Add a photo'}</Button>
            <Button size="sm" variant="quiet" icon="file-text" onPress={() => pick(pickRecordPdf)}>{doc || record ? 'Use a PDF' : 'Add a PDF'}</Button>
          </View>
        </View>
        {error ? <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text> : null}
      </ScrollView>
      <Footer>
        <Button block disabled={!complete || busy} onPress={submit}>{busy ? 'Saving…' : 'Save vaccines'}</Button>
        <Text variant="caption" muted center>{record?.verified && !doc ? 'Partners see that the record was checked.' : 'Partners can ask to see the paperwork at the first visit.'}</Text>
      </Footer>
    </Screen>
  );
}
