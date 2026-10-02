import { Linking, Platform } from 'react-native';

import type { Partner } from '@/data/types';

/** Opens the partner's address in Apple Maps on iOS, Google Maps elsewhere. */
export function openDirections(p: Partner) {
  const q = encodeURIComponent(`${p.name}, ${p.address}, Austin, TX`);
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  Linking.openURL(url).catch(() => {});
}
