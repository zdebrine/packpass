import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/ds/controls';
import { Field, Footer, MiniButton, Screen, themed } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { BackButton, Body, Intro } from '@/features/onboarding/parts';
import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { comingWithAccounts } from '@/lib/notice';
import { useApp } from '@/store/app';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 01b Create account */
function SignUp() {
  const draft = useApp((s) => s.draft);
  const update = useApp((s) => s.updateDraft);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signUp = useApp((s) => s.signUp);
  const pwOk = pw.length >= 8;
  const valid = draft.ownerName.trim().length > 0 && EMAIL.test(draft.email.trim()) && pwOk;

  return (
    <Screen theme="dark">
      <View style={{ paddingTop: 6, paddingHorizontal: 20 }}><BackButton /></View>
      <Body top={20} gap={18}>
        <Intro eyebrow="Join PackPass" title="Create your account." />
        <View style={{ gap: 8 }}>
          <Button block onPress={() => (isLive ? comingWithAccounts('Sign up with Apple') : router.push('/onboarding/dog'))}>Continue with Apple</Button>
          <Button variant="quiet" block onPress={() => (isLive ? comingWithAccounts('Sign up with Google') : router.push('/onboarding/dog'))}>Continue with Google</Button>
        </View>
        <Text variant="caption" muted center style={{ marginTop: 4 }}>Or use your email</Text>
        <Field label="Your name" value={draft.ownerName} onChangeText={(ownerName) => update({ ownerName })} autoComplete="name" textContentType="name" />
        <Field label="Email" value={draft.email} onChangeText={(email) => update({ email })} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" />
        <View style={{ gap: 8 }}>
          <Field
            label="Password"
            value={pw}
            onChangeText={setPw}
            secureTextEntry={!show}
            autoComplete="new-password"
            textContentType="newPassword"
            right={<MiniButton onPress={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</MiniButton>}
          />
          <Text variant="caption" muted>{pwOk ? 'Strong enough.' : 'At least 8 characters.'}</Text>
        </View>
      </Body>
      <Footer>
        {error ? <Text variant="label" weight="600" color="#f08470" center accessibilityLiveRegion="polite">{error}</Text> : null}
        <Button
          block
          disabled={!valid || busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await signUp(draft.email.trim(), pw);
              router.push('/verify');
            } catch (e) {
              setError(errorCopy(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
        <Text variant="caption" muted center>By continuing you agree to the Membership terms and Privacy policy.</Text>
      </Footer>
    </Screen>
  );
}

export default themed('dark', SignUp);
