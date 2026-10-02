import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Field, Footer, Screen, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { BackButton, Body, Intro } from '@/features/onboarding/parts';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Forgot password (from 01c). Not in the designs; built from the sign-in and verify screens' parts.
 * Step 1 emails a 6-digit code; step 2 takes the code and a new password, which also signs in.
 */
function Reset() {
  const { c } = useTheme();
  const draft = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const request = useApp((s) => s.requestPasswordReset);
  const reset = useApp((s) => s.resetPassword);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = draft.email.trim();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(/expired|invalid/i.test((e as Error).message) ? 'That code is wrong or has expired. Check the email or send a new one.' : errorCopy(e));
    } finally {
      setBusy(false);
    }
  };
  const send = () => run(async () => { await request(email); setSent(true); });
  const save = () => run(async () => {
    await reset(email, code, pw);
    router.replace(useApp.getState().onboarded ? '/' : '/onboarding/dog');
  });

  return (
    <Screen theme="dark">
      <View style={{ paddingTop: 6, paddingHorizontal: 20 }}><BackButton /></View>
      <Body top={20} gap={18}>
        {sent ? (
          <>
            <Intro eyebrow="Check your inbox" title="New password." lede={`If ${email} has a PackPass account, we sent it a 6-digit code.`} />
            <Field label="Code" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus />
            <Field label="New password" value={pw} onChangeText={(v) => { setPw(v); setError(null); }} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={save} />
            <Text variant="caption" muted>At least 8 characters.</Text>
            <Press onPress={() => { setSent(false); setCode(''); setError(null); }} scale={false} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
              <Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>Use a different email or send a new code</Text>
            </Press>
          </>
        ) : (
          <>
            <Intro eyebrow="PackPass" title="Reset your password." lede="We'll email you a 6-digit code to set a new one." />
            <Field label="Email" value={draft.email} onChangeText={(v) => { update({ email: v }); setError(null); }} autoComplete="email" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoFocus onSubmitEditing={send} />
          </>
        )}
      </Body>
      <Footer>
        {error ? <Text variant="label" weight="600" color={c.kennelRed} center accessibilityLiveRegion="polite">{error}</Text> : null}
        {sent ? (
          <Button block disabled={code.length < 6 || pw.length < 8 || busy} onPress={save}>{busy ? 'Saving…' : 'Set password and sign in'}</Button>
        ) : (
          <Button block disabled={!/.+@.+\..+/.test(email) || busy} onPress={send}>{busy ? 'Sending…' : 'Send code'}</Button>
        )}
        {isLive ? null : <Text variant="caption" muted center>Any 6 digits work in this preview.</Text>}
      </Footer>
    </Screen>
  );
}

export default themed('dark', Reset);
