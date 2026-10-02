import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { NOW, photos } from '@/data/fixtures';
import { Button } from '@/ds/controls';
import { IconButton, Screen, useTop, themed } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { QrArt } from '@/features/QrArt';
import { activeBookings } from '@/lib/booking';
import { startsCopy } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const FRAME = 250;

function Corners() {
  const s = { position: 'absolute' as const, width: 44, height: 44, borderColor: '#fff' };
  return (
    <View style={{ width: FRAME, height: FRAME }} pointerEvents="none">
      <View style={[s, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 28 }]} />
      <View style={[s, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 28 }]} />
      <View style={[s, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 28 }]} />
      <View style={[s, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 28 }]} />
    </View>
  );
}

/**
 * 14 Scan to check in. Uses the live camera when allowed (iOS, Android, and web over HTTPS).
 * Without camera access it shows the design's still frame, and the 4-digit code always works.
 */
function Scan() {
  const top = useTop();
  const { booking: bookingId } = useLocalSearchParams<{ booking?: string }>();
  const bookings = useApp((s) => s.bookings);
  const checkIn = useApp((s) => s.checkIn);
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState('');
  const handled = useRef(false);

  const upcoming = activeBookings(bookings).filter((x) => x.booking.status === 'booked' && x.v.session.startsAt >= NOW);
  const target = upcoming.find((x) => x.booking.id === bookingId) ?? upcoming[0];

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm().catch(() => {});
  }, [perm, requestPerm]);

  const done = () => {
    if (handled.current || !target) return;
    handled.current = true;
    checkIn(target.booking.id);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(`/check-in/done?booking=${target.booking.id}`);
  };

  const live = !!perm?.granted;

  return (
    <Screen theme="dark" bleed statusLight style={{ backgroundColor: '#000' }}>
      {live ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={done} />
      ) : (
        <>
          <Image source={photos.wall} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={2} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 286, alignItems: 'center' }} pointerEvents="none">
            <View style={{ padding: 14, borderRadius: 14, backgroundColor: '#fff', transform: [{ rotate: '-4deg' }, { skewX: '2deg' }], boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
              <QrArt size={168} />
            </View>
          </View>
        </>
      )}

      {/* Dim everything outside the frame. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 260, alignItems: 'center' }} pointerEvents="none">
        <View style={{ width: FRAME, height: FRAME, borderRadius: 28, boxShadow: '0 0 0 999px rgba(0,0,0,0.55)' }} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 260, alignItems: 'center' }}><Corners /></View>

      <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton glass icon="x" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text variant="wide" color="#fff" style={{ fontSize: 13 }}>Check in</Text>
        <IconButton glass icon="flashlight" label={torch ? 'Torch off' : 'Torch on'} onPress={() => setTorch((t) => !t)} style={torch ? { backgroundColor: 'rgba(255,255,255,0.45)' } : undefined} />
      </View>
      <Text variant="label" color="#fff" center style={{ position: 'absolute', top: 150, left: 40, right: 40 }}>
        {live ? 'Point the camera at the PackPass code at the entrance.' : 'Allow the camera to scan the PackPass code at the entrance, or enter the code instead.'}
      </Text>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <Card>
          {target ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Photo name={target.v.cls.image} style={{ width: 52, height: 52, borderRadius: 12 }} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" muted>{startsCopy(target.v.session.startsAt)}</Text>
                <Text variant="label" weight="600">{target.v.cls.title}</Text>
                <Text variant="caption" muted>{`${target.v.partner.name} · ${target.v.partner.street}`}</Text>
              </View>
            </View>
          ) : (
            <Text variant="label">Nothing booked to check in to.</Text>
          )}
          {codeMode ? (
            <CodeEntry code={code} setCode={setCode} onSubmit={done} />
          ) : (
            <Button variant="quiet" block disabled={!target} onPress={() => setCodeMode(true)}>Enter code instead</Button>
          )}
          {!live && perm && !perm.granted && !codeMode ? (
            <Button block disabled={!target} onPress={() => requestPerm().catch(() => {})}>Allow camera</Button>
          ) : null}
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={{ padding: 20, borderRadius: 32, backgroundColor: c.bg, gap: 14 }}>{children}</View>;
}

function CodeEntry({ code, setCode, onSubmit }: { code: string; setCode: (s: string) => void; onSubmit: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        autoFocus
        maxLength={4}
        placeholder="4-digit code"
        placeholderTextColor={c.inkFaint}
        accessibilityLabel="Check-in code"
        style={{ height: 52, borderRadius: 9999, backgroundColor: c.surfaceRaised, paddingHorizontal: 20, color: c.ink, fontFamily: fonts.display, fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
      />
      <Text variant="caption" muted center>The code is on the sign at the entrance. Any 4 digits work in this preview.</Text>
      <Button block disabled={code.length < 4} onPress={onSubmit}>Check in</Button>
    </View>
  );
}

export default themed('dark', Scan);
