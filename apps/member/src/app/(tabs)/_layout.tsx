import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { dogs } from '@/data/fixtures';
import { Icon, type IconName } from '@/ds/Icon';
import { useBottom } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const TABS: { name: string; label: string; icon?: IconName }[] = [
  { name: 'index', label: 'Today', icon: 'house' },
  { name: 'book', label: 'Book', icon: 'calendar-search' },
  { name: 'log', label: 'Log', icon: 'activity' },
  { name: 'dog', label: dogs.juno.name },
];

/** Tab bar from the design: hairline on top, active ink, inactive ink-faint, the dog's photo as the last tab. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const bottom = useBottom(16);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 12, paddingBottom: bottom, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
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
                <Photo name={dogs.juno.photo} style={{ width: 26, height: 26, borderRadius: 9999, opacity: active ? 1 : 0.7 }} />
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
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="book" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="dog" />
    </Tabs>
  );
}
