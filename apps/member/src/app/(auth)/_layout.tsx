import { Redirect, Stack } from 'expo-router';

import { useApp } from '@/store/app';

export default function AuthLayout() {
  const onboarded = useApp((s) => s.onboarded);
  if (onboarded) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0e0f0e' } }} />;
}
