import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Redirect, Tabs, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/ds/Icon';
import { useBottom } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { useWide } from '@/ds/responsive';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useApp, useDog, useUnseenMissed, useUnseenRecordDenial } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const TABS: { name: string; label: string; icon?: IconName }[] = [
  { name: 'index', label: 'Today', icon: 'house' },
  { name: 'book', label: 'Book', icon: 'calendar-search' },
  { name: 'log', label: 'Log', icon: 'activity' },
  { name: 'dog', label: '' },
];

/** v3 TabBar: 83pt with the home indicator, hairline on top, active ink, inactive ink-faint, the dog's photo as the last tab. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const dog = useDog();
  const bottom = useBottom(16);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', minHeight: 83, paddingTop: 8, paddingHorizontal: 8, paddingBottom: bottom, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
      {state.routes.map((route, i) => {
        const found = TABS.find((t) => t.name === route.name);
        const tab = found && found.name === 'dog' ? { ...found, label: dog.name } : found;
        if (!tab) return null;
        const active = state.index === i;
        const color = active ? c.ink : c.inkFaint;
        return (
          <Press
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ width: 64, alignItems: 'center', gap: 4, paddingVertical: 4 }}
          >
            {tab.icon ? (
              <Icon name={tab.icon} size={24} color={color} />
            ) : (
              <View style={{ borderRadius: 9999, boxShadow: active ? `0 0 0 2px ${c.surface}, 0 0 0 3.5px ${c.ink}` : undefined }}>
                <Photo name={dog.photo} style={{ width: 24, height: 24, borderRadius: 9999, opacity: active ? 1 : 0.7 }} />
              </View>
            )}
            <Text style={{ fontSize: 10, lineHeight: 12 }} weight="500" color={color} numberOfLines={1}>{tab.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const onboarded = useApp((s) => s.onboarded);
  const denied = useUnseenRecordDenial();
  const missed = useUnseenMissed();
  // Desktop navigates from the sidebar.
  const wide = useWide();
  // Back on the tabs with a dog half added (backed out of 01e, or the app closed mid-way): nothing was saved.
  useFocusEffect(useCallback(() => useApp.getState().cancelAddDog(), []));
  if (!onboarded) return <Redirect href="/welcome" />;
  // PackPass denied a dog's vet record: show why before anything else, once per denial.
  if (denied) return <Redirect href={`/onboarding/records-denied?dog=${denied}`} />;
  // A class the dog missed without cancelling in time: say so once, the next time the app opens.
  if (missed) return <Redirect href={`/missed/${missed.bookingId}`} />;
  return (
    <Tabs tabBar={(p) => (wide ? null : <TabBar {...p} />)} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="book" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="dog" />
    </Tabs>
  );
}
