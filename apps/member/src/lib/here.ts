import * as Location from 'expo-location';

import type { Origin } from './location';

/**
 * The phone's position, for "Distances from › My location". Asks for when-in-use permission the
 * first time; resolves null if the member says no or no fix comes back. A city-block fix is plenty,
 * so it uses balanced accuracy and takes a recent cached fix when there is one.
 */
export async function currentOrigin(): Promise<Origin | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null);
  const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
  return fix ? { label: 'Near you', lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
}
