import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/ds/controls';
import { Footer, Screen, themed } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { BackButton, Intro } from '@/features/onboarding/parts';
import { isLive } from '@/api/client';
import { errorCopy } from '@/api/errors';
import { resendCode } from '@/api/live';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** 01d Verify email. Six boxes backed by one hidden input, so paste and one-time-code autofill work. */
function Verify() {
  const { c } = useTheme();
  const email = useApp((s) => s.draft.email);
  const [code, setCode] = useState('');
  // Supabase allows one email a minute per address.
  const [resendIn, setResendIn] = useState(60);
  const input = useRef<TextInput>(null);
  const verifyEmail = useApp((s) => s.verifyEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(code);
      router.push('/onboarding/dog');
    } catch (e) {
      setError(/expired|invalid/i.test((e as Error).message) ? errorCopy('otp_expired') : errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  return (
    <Screen theme="dark">
      <View style={{ paddingTop: 6, paddingHorizontal: 20 }}><BackButton /></View>
      <View style={{ flex: 1, padding: 20, gap: 22 }}>
        <Intro eyebrow="Check your inbox" title="Enter the code." lede={`We sent a 6-digit code to ${email}.`} />
        <Press scale={false} onPress={() => input.current?.focus()} accessibilityLabel="Verification code" style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <View
              key={i}
              style={{ flex: 1, aspectRatio: 0.82, borderRadius: 16, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center', boxShadow: i === code.length ? `inset 0 0 0 2px ${c.ink}` : undefined }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 32 }}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </Press>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {resendIn > 0 ? (
            <Text variant="label" muted>{`Resend in ${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`}</Text>
          ) : (
            <Press onPress={() => { setResendIn(60); setError(null); if (isLive) resendCode(email).catch((e) => setError(errorCopy(e))); }} scale={false}><Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>Resend code</Text></Press>
          )}
          <Press onPress={() => router.back()} scale={false} accessibilityRole="link">
            <Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>Change email</Text>
          </Press>
        </View>
      </View>
      <Footer>
        {error ? <Text variant="label" weight="600" color={c.kennelRed} center accessibilityLiveRegion="polite">{error}</Text> : null}
        <Button block disabled={code.length < 6 || busy} onPress={verify}>{busy ? 'Checking…' : 'Verify'}</Button>
        {isLive ? null : <Text variant="caption" muted center>Any 6 digits work in this preview.</Text>}
      </Footer>
    </Screen>
  );
}

export default themed('dark', Verify);
