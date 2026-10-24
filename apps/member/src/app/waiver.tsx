import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { catalog } from '@/data/catalog';
import { Button } from '@/ds/controls';
import { Field, Footer, IconButton, Screen } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { ReadyBadge, signedLabel } from '@/features/ready/parts';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const close = () => (router.canGoBack() ? router.back() : router.replace('/ready'));

/** A waiver to read and sign once with a typed name: PackPass's (Ready to book) or a partner's. */
export default function WaiverScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const waiver = useApp((s) => s.waivers.find((w) => w.id === id) ?? s.waivers.find((w) => w.partnerId === null));
  const signedOn = useApp((s) => (waiver ? s.waiversSigned[waiver.id] : undefined));
  const sign = useApp((s) => s.signWaiver);
  const account = useApp((s) => s.account.name);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!waiver) {
    return (
      <Screen>
        <View style={{ paddingTop: 10, paddingHorizontal: 20, gap: 20 }}>
          <IconButton icon="chevron-left" label="Back" onPress={close} />
          <Text muted>{'This waiver isn\'t available any more.'}</Text>
        </View>
      </Screen>
    );
  }
  const partner = waiver.partnerId ? catalog.partners[waiver.partnerId]?.name : null;
  const submit = async () => {
    setBusy(true); setError(null);
    try { await sign(waiver.id, name); close(); } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
        <IconButton icon="chevron-left" label="Back" onPress={close} />
        <View>
          <Text variant="wide" muted>{partner ?? 'PackPass'}</Text>
          <Text variant="pageTitle" style={{ marginTop: 8 }} accessibilityRole="header">{waiver.title}</Text>
          <Text variant="caption" muted style={{ marginTop: 6 }}>
            {partner ? `Signed once, on your first booking at ${partner}.` : 'Covers every class booked through PackPass, for every dog on your account.'}
          </Text>
        </View>
        {waiver.body ? (
          <View style={{ padding: 18, borderRadius: 16, backgroundColor: c.surfaceRaised, gap: 12 }}>
            {waiver.body.trim().split(/\n\s*\n/).map((p, i) => <Text key={i} variant="caption">{p.trim()}</Text>)}
          </View>
        ) : null}
        {signedOn ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ReadyBadge status="done" />
            <Text variant="label" muted>{signedLabel(signedOn)}</Text>
          </View>
        ) : (
          <Field label="Type your full name to sign" value={name} onChangeText={setName} placeholder={account || 'Full name'} autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="done" onSubmitEditing={submit} />
        )}
        {error ? <Text variant="label" weight="600" color={c.kennelRed}>{error}</Text> : null}
      </ScrollView>
      {signedOn ? null : (
        <Footer>
          <Button block disabled={busy || name.trim().length < 2} onPress={submit}>{busy ? 'Signing…' : 'Sign waiver'}</Button>
          <Text variant="caption" muted center>Typing your name counts as your signature.</Text>
        </Footer>
      )}
    </Screen>
  );
}
