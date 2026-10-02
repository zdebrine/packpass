import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useApp } from '@/store/app';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useHydrated() {
  const [done, setDone] = useState(useApp.persist.hasHydrated());
  useEffect(() => useApp.persist.onFinishHydration(() => setDone(true)), []);
  return done;
}

/** On web the phone-sized designs sit in a centered column (docs/TECH_SPEC.md §1). */
function WebFrame({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg === '#ffffff' ? '#e4e4e1' : '#050605', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: c.bg, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 30px 80px -30px rgba(0,0,0,0.35)' }}>
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
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
  const ready = fontsLoaded && hydrated;

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
            <Stack.Screen name="book/[sessionId]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
            <Stack.Screen name="passport/[type]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
            <Stack.Screen name="clearance-earned" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="check-in/scan" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="check-in/done" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack>
        </WebFrame>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
