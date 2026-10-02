import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/ds/controls';
import { Field, Screen, useBottom, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { comingWithAccounts } from '@/lib/notice';
import { BackButton, Body, Intro } from '@/features/onboarding/parts';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

function TextLink({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} scale={false} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
      <Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>{children}</Text>
    </Press>
  );
}

/** 01c Sign in. Live: Supabase email and password. Sample data: any email and a password of 8 or more characters. */
function SignIn() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const draft = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const signIn = useApp((s) => s.signIn);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | false>(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await signIn(draft.email.trim(), pw);
      router.replace(useApp.getState().onboarded ? '/' : '/onboarding/dog');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'bad_credentials' || /invalid login/i.test(msg) ? 'mismatch' : errorCopy(e));
    } finally {
      setBusy(false);
    }
  };
  const social = async () => {
    if (isLive) return comingWithAccounts('Sign in with Apple or Google');
    await signIn('alex@kim.co', 'sample-password');
    router.replace('/');
  };

  return (
    <Screen theme="dark">
      <View style={{ paddingTop: 6, paddingHorizontal: 20 }}><BackButton /></View>
      <Body top={20} gap={18}>
        <Intro eyebrow="PackPass" title="Welcome back." />
        <Field label="Email" value={draft.email} onChangeText={(email) => { update({ email }); setError(false); }} autoComplete="email" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
        <Field label="Password" value={pw} onChangeText={(v) => { setPw(v); setError(false); }} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        {error ? (
          <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.kennelRedSoft }} accessibilityLiveRegion="polite">
            <Text variant="label" weight="600" color={c.kennelRed}>{error === 'mismatch' ? "That email and password don't match. Try again or reset your password." : error}</Text>
          </View>
        ) : null}
        <TextLink onPress={() => comingWithAccounts('Reset your password')}>Forgot password</TextLink>
        <Button block disabled={busy} onPress={submit}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <Text variant="caption" muted center style={{ marginTop: 6 }}>Or</Text>
        <View style={{ gap: 8 }}>
          <Button variant="quiet" block onPress={social}>Continue with Apple</Button>
          <Button variant="quiet" block onPress={social}>Continue with Google</Button>
        </View>
      </Body>
      <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: bottom, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
        <Text variant="label" muted>New to PackPass? </Text>
        <Press onPress={() => router.replace('/sign-up')} scale={false} accessibilityRole="link">
          <Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>Create account</Text>
        </Press>
      </View>
    </Screen>
  );
}

export default themed('dark', SignIn);
