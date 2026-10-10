import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/ds/Icon';
import { useBottom } from '@/ds/layout';
import { Press } from '@/ds/Press';
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

/** Tab bar from the design: hairline on top, active ink, inactive ink-faint, the dog's photo as the last tab. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const dog = useDog();
  const bottom = useBottom(16);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 12, paddingBottom: bottom, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
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
            style={{ width: 72, alignItems: 'center', gap: 5 }}
          >
            {tab.icon ? (
              <Icon name={tab.icon} size={24} color={color} />
            ) : (
              <View style={{ borderRadius: 9999, boxShadow: active ? `0 0 0 2px ${c.bg}, 0 0 0 3.5px ${c.ink}` : undefined }}>
                <Photo name={dog.photo} style={{ width: 26, height: 26, borderRadius: 9999, opacity: active ? 1 : 0.7 }} />
              </View>
            )}
            <Text style={{ fontSize: 12, lineHeight: 16 }} weight={active ? '600' : '500'} color={color}>{tab.label}</Text>
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
  if (!onboarded) return <Redirect href="/welcome" />;
  // PackPass denied the vet record: show why before anything else, once per denial.
  if (denied) return <Redirect href="/onboarding/records-denied" />;
  // A class the dog missed without cancelling in time: say so once, the next time the app opens.
  if (missed) return <Redirect href={`/missed/${missed.bookingId}`} />;
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="book" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="dog" />
    </Tabs>
  );
}
