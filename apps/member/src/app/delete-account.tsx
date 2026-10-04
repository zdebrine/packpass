import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Footer, IconButton, Screen } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Delete account (Settings). Says plainly what goes, then asks a second time. Upcoming bookings are given
 * back to the partner (not refunded: the credits go with the account).
 */
export default function DeleteAccount() {
  const { c } = useTheme();
  const dogs = useApp((s) => s.dogs);
  const upcoming = useApp((s) => s.bookings.filter((b) => b.status === 'booked').length);
  const deleteAccount = useApp((s) => s.deleteAccount);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = dogs.map((d) => d.name).join(' and ') || 'your dog';

  const go = async () => {
    setBusy(true); setError(null);
    try {
      await deleteAccount();
      router.replace('/welcome');
    } catch (e) {
      setError(errorCopy(e));
      setBusy(false);
    }
  };

  const items = [
    `${names}'s Passport${dogs.length > 1 ? 's' : ''}: clearances, training paths, vaccine records and photos`,
    'Your Log: every session, trainer note and assessment result',
    upcoming ? `${upcoming} upcoming booking${upcoming > 1 ? 's' : ''}, which ${upcoming > 1 ? 'open' : 'opens'} back up for other dogs` : 'Any upcoming bookings',
    'Your credits, waitlist places and held spots',
  ];

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24, gap: 22 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
        <View>
          <Text variant="wide" muted>Settings · Account</Text>
          <Text variant="displayLg" style={{ marginTop: 10 }} accessibilityRole="header">Delete your account?</Text>
          <Text muted style={{ marginTop: 10 }}>This deletes your PackPass account and everything in it, straight away. It can’t be undone.</Text>
        </View>
        <View style={{ gap: 12, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          {items.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="x" size={18} color={c.kennelRed} />
              <Text variant="label" style={{ flex: 1 }}>{t}</Text>
            </View>
          ))}
        </View>
        <Text variant="caption" muted>Want a break instead? Just don’t book: nothing is charged beyond your plan, and your Passport stays as it is.</Text>
        {error ? <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text> : null}
      </ScrollView>
      <Footer>
        {sure ? (
          <>
            <Text variant="label" weight="600" center>Last check: delete everything now?</Text>
            <Button block disabled={busy} onPress={go}>{busy ? 'Deleting…' : 'Yes, delete my account'}</Button>
            <Button block variant="quiet" disabled={busy} onPress={() => setSure(false)}>Keep my account</Button>
          </>
        ) : (
          <>
            <Button block onPress={() => setSure(true)}>Delete account</Button>
            <Button block variant="quiet" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}>Keep my account</Button>
          </>
        )}
      </Footer>
    </Screen>
  );
}
