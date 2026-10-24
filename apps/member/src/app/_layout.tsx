import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { useFonts } from 'expo-font';
import { Stack, useGlobalSearchParams, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isLive, supabase } from '@/api/client';
import { useWide } from '@/ds/responsive';
import { Sidebar } from '@/features/desktop/Sidebar';
import { setLiveClock } from '@/lib/clock';
import { identify, wrap } from '@/lib/monitoring';
import { usePush } from '@/lib/push';
import { useApp } from '@/store/app';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});
setLiveClock(isLive);

function useHydrated() {
  const [done, setDone] = useState(useApp.persist.hasHydrated());
  useEffect(() => useApp.persist.onFinishHydration(() => setDone(true)), []);
  return done;
}

/**
 * On web the phone-sized designs sit in a centered column (docs/TECH_SPEC.md §1). A desktop-width
 * browser gets the full-width layout from Pack Member App Desktop, with the sidebar once signed in.
 */
function WebFrame({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const wide = useWide();
  const segments = useSegments() as string[];
  const onboarded = useApp((s) => s.onboarded);
  if (Platform.OS !== 'web') return <>{children}</>;
  if (wide) {
    const inApp = onboarded && segments[0] !== '(auth)' && segments[0] !== 'onboarding';
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
        {inApp ? <Sidebar /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg === '#ffffff' ? '#e4e4e1' : '#050605', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: c.bg, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 30px 80px -30px rgba(0,0,0,0.35)' }}>
        {children}
      </View>
    </View>
  );
}

/** Desktop shows sheets and full-screen modals as dialogs over the page, so the page has to stay rendered underneath. */
function useModal(phone: 'transparentModal' | 'fullScreenModal' | undefined, animation?: 'fade' | 'none') {
  const wide = useWide();
  if (wide) return { presentation: 'transparentModal' as const, animation: 'fade' as const };
  return { presentation: phone, animation };
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    ArchivoDisplay: require('../../assets/fonts/ArchivoDisplay.ttf'),
    ArchivoWide: require('../../assets/fonts/ArchivoWide.ttf'),
    ArchivoWideBold: require('../../assets/fonts/ArchivoWideBold.ttf'),
  });
  const hydrated = useHydrated();
  const dataReady = useApp((s) => s.ready);
  const ready = fontsLoaded && hydrated && dataReady;
  usePush();
  // Phone sheets open over the screen they came from and animate themselves (ds/sheet).
  const sheet = useModal('transparentModal', 'none');
  const fade = useModal('fullScreenModal', 'fade');
  const scan = useModal('fullScreenModal');
  const page = useModal(undefined);

  // A link that names a dog (notifications: /goal/…?dog=<id>) shows that dog.
  const { dog } = useGlobalSearchParams<{ dog?: string }>();
  const dogCount = useApp((s) => s.dogs.length);
  useEffect(() => {
    if (typeof dog === 'string' && dataReady) useApp.getState().selectDog(dog).catch(() => {});
  }, [dog, dataReady, dogCount]);

  // Live mode: load the catalog and the member, and reload when the session changes.
  useEffect(() => {
    if (!supabase) return;
    const refresh = () => useApp.getState().refresh().catch(() => useApp.setState({ ready: true }));
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      identify(session?.user.id ?? null);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WebFrame>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="book/[sessionId]" options={sheet} />
            <Stack.Screen name="passport/[type]" options={sheet} />
            <Stack.Screen name="clearance-earned" options={fade} />
            <Stack.Screen name="check-in/scan" options={scan} />
            <Stack.Screen name="check-in/done" options={fade} />
            <Stack.Screen name="notifications" options={page} />
            <Stack.Screen name="missed/[id]" options={page} />
            <Stack.Screen name="month" options={page} />
            <Stack.Screen name="series-date/[bookingId]" options={sheet} />
            <Stack.Screen name="log-activity" options={sheet} />
            <Stack.Screen name="practice-goal" options={sheet} />
          </Stack>
        </WebFrame>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default wrap(RootLayout);
