import { router, usePathname } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { monthHeader } from '@/lib/log';
import { useAllowance, useApp, useDog, useNotifications } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

type Section = 'today' | 'book' | 'log' | 'dog';

const NAV: { key: Section; href: string; label: string; icon?: IconName }[] = [
  { key: 'today', href: '/', label: 'Today', icon: 'house' },
  { key: 'book', href: '/book', label: 'Book', icon: 'calendar-search' },
  { key: 'log', href: '/log', label: 'Log', icon: 'activity' },
  { key: 'dog', href: '/dog', label: '' },
];

/** Which nav item a page sits under: a class under Book, a goal under the dog, an assessment under Log. */
function sectionOf(path: string): Section | null {
  if (path === '/') return 'today';
  if (path.startsWith('/book') || path.startsWith('/class')) return 'book';
  if (path.startsWith('/log') || path.startsWith('/assessment')) return 'log';
  if (path.startsWith('/dog') || path.startsWith('/goal') || path.startsWith('/passport') || path.startsWith('/vaccines')) return 'dog';
  return null;
}

function NavItem({ label, active, onPress, children }: { label: string; active: boolean; onPress: () => void; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      scale={false}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{ height: 48, borderRadius: 9999, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: active ? c.surfaceRaised : 'transparent' }}
      activeStyle={active ? null : { backgroundColor: c.surfaceRaised }}
    >
      {children}
      <Text style={{ fontSize: 15, lineHeight: 20 }} weight={active ? '600' : '500'} color={active ? c.ink : c.inkMuted}>{label}</Text>
    </Press>
  );
}

/** Desktop left rail from Pack Member App Desktop: nav, notifications, credits, Check in. */
export function Sidebar() {
  const { c } = useTheme();
  const path = usePathname();
  const dog = useDog();
  const credits = useApp((s) => s.credits);
  const allowance = useAllowance();
  const read = useApp((s) => s.readNotifications);
  const unread = useNotifications().some((n) => n.isNew && !read.includes(n.id));
  const section = sectionOf(path);
  const bars = Math.max(allowance ?? credits, credits);

  return (
    <View style={{ width: 232, height: '100%', paddingTop: 28, paddingHorizontal: 14, paddingBottom: 20, gap: 4, borderRightWidth: 1, borderRightColor: c.line, backgroundColor: c.bg }}>
      <View style={{ paddingTop: 4, paddingHorizontal: 14, paddingBottom: 28 }}>
        <Text variant="wide" weight="700" style={{ fontSize: 15, lineHeight: 20 }}>PackPass</Text>
      </View>
      {NAV.map((n) => {
        const active = section === n.key;
        const color = active ? c.ink : c.inkMuted;
        return (
          <NavItem key={n.key} label={n.icon ? n.label : dog.name} active={active} onPress={() => router.navigate(n.href as never)}>
            {n.icon ? <Icon name={n.icon} size={22} color={color} /> : <Photo name={dog.photo} style={{ width: 24, height: 24, borderRadius: 9999 }} />}
          </NavItem>
        );
      })}
      <NavItem label="Notifications" active={path === '/notifications'} onPress={() => router.push('/notifications')}>
        <View style={{ width: 22, height: 22 }}>
          <Icon name="bell" size={22} color={path === '/notifications' ? c.ink : c.inkMuted} />
          {unread ? <View style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 9999, backgroundColor: c.agility, boxShadow: `0 0 0 2px ${c.bg}` }} /> : null}
        </View>
      </NavItem>
      <View style={{ flex: 1 }} />
      <Press
        onPress={() => router.push('/plan')}
        scale={false}
        accessibilityLabel={`${allowance ? `${credits} of ${allowance}` : credits} credits left. Plan and credits`}
        style={{ padding: 16, borderRadius: 24, backgroundColor: c.surfaceRaised, gap: 12 }}
        activeStyle={{ backgroundColor: c.surfaceSunken }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="displayLg" num>{credits}</Text>
          <Text variant="label" muted>{allowance ? `of ${allowance}` : credits === 1 ? 'credit' : 'credits'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: bars }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 9999, backgroundColor: i < credits ? c.ink : c.surfaceSunken }} />
          ))}
        </View>
        <Text variant="caption" muted>{allowance ? `Credits left · resets ${monthHeader().resets}` : 'No plan yet'}</Text>
      </Press>
      <View style={{ marginTop: 8 }}>
        <Button block onPress={() => router.push('/check-in/scan')}>Check in</Button>
      </View>
    </View>
  );
}
