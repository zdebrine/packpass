import { Alert, Platform } from 'react-native';

/** Simple message for actions that need the backend (phase 2). Alert.alert is a no-op on web. */
export function notice(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export const comingWithAccounts = (what: string) =>
  notice(what, 'This needs PackPass accounts, which arrive in the next build. Everything else in this preview works on sample data.');
