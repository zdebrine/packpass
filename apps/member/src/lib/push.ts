import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { isLive } from '@/api/client';
import { useApp } from '@/store/app';

/**
 * Push notifications (hold reminders, released holds, clearances). Phones only, in live mode, and
 * only in a development or store build: Expo Go and the web don't get remote pushes. Expo needs the
 * EAS project id (`eas init` writes it to app.json › extra.eas.projectId).
 */
export const pushAvailable = isLive && Platform.OS !== 'web' && Device.isDevice;

if (pushAvailable) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Gets this device's Expo push token. Only asks for permission when `ask` is set; returns null if not allowed. */
async function deviceToken(ask: boolean): Promise<string | null> {
  if (!pushAvailable) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'PackPass', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask && canAskAgain) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/**
 * Asks for notification permission at a moment it clearly helps (after holding spots) and links the
 * device to the member. Safe to call anywhere; does nothing off-device or in sample mode.
 */
export async function enablePush(ask = true) {
  try {
    const token = await deviceToken(ask);
    if (token) await useApp.getState().registerPush(token, Platform.OS as 'ios' | 'android');
  } catch {
    // Push is a nice-to-have; the same reminder is always in the app's notifications.
  }
}

/** Root layout: re-links the device on sign-in (without prompting) and opens the screen a tapped push points to. */
export function usePush() {
  const signedIn = useApp((s) => s.signedIn);
  useEffect(() => {
    if (pushAvailable && signedIn) enablePush(false);
  }, [signedIn]);

  useEffect(() => {
    if (!pushAvailable) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const href = r?.notification.request.content.data?.href;
      if (typeof href === 'string' && href.startsWith('/')) router.push(href as Href);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
