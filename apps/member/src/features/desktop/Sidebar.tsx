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
  if (path.startsWith('/dog') || path.startsWith('/goal') || path.startsWith('/passport') || path.startsWith('/vaccines') || path.startsWith('/ready') || path.startsWith('/waiver')) return 'dog';
  return null;
}

function NavItem({ label, active, onPress, count, children }: { label: string; active: boolean; onPress: () => void; count?: number; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      scale={false}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{ height: 36, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: active ? c.surfaceRaised : 'transparent' }}
      activeStyle={active ? null : { backgroundColor: c.hover }}
    >
      {children}
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18 }} weight="500" color={active ? c.ink : c.inkMuted} numberOfLines={1}>{label}</Text>
      {count ? (
        <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9999, backgroundColor: c.agility, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, lineHeight: 14 }} weight="600" color={c.onAgility} num>{count}</Text>
        </View>
      ) : null}
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
  const unread = useNotifications().filter((n) => n.isNew && !read.includes(n.id)).length;
  const section = sectionOf(path);
  const bars = Math.max(allowance ?? credits, credits);

  return (
    <View style={{ width: 220, height: '100%', paddingTop: 20, paddingHorizontal: 12, paddingBottom: 16, gap: 2, borderRightWidth: 1, borderRightColor: c.line, backgroundColor: c.surface }}>
      <View style={{ paddingTop: 4, paddingHorizontal: 10, paddingBottom: 20 }}>
        <Text variant="wide" weight="700" style={{ fontSize: 15, lineHeight: 20 }}>PackPass</Text>
      </View>
      {NAV.map((n) => {
        const active = section === n.key;
        const color = active ? c.ink : c.inkMuted;
        return (
          <NavItem key={n.key} label={n.icon ? n.label : dog.name} active={active} onPress={() => router.navigate(n.href as never)}>
            {n.icon ? <Icon name={n.icon} size={16} color={color} /> : <Photo name={dog.photo} style={{ width: 18, height: 18, borderRadius: 9999 }} />}
          </NavItem>
        );
      })}
      <NavItem label="Notifications" active={path === '/notifications'} count={unread} onPress={() => router.push('/notifications')}>
        <Icon name="bell" size={16} color={path === '/notifications' ? c.ink : c.inkMuted} />
      </NavItem>
      <View style={{ flex: 1 }} />
      <Press
        onPress={() => router.push('/plan')}
        scale={false}
        accessibilityLabel={`${allowance ? `${credits} of ${allowance}` : credits} credits left. Plan and credits`}
        style={{ padding: 12, borderRadius: 12, boxShadow: `inset 0 0 0 1px ${c.line}`, gap: 8 }}
        activeStyle={{ backgroundColor: c.hover }}
      >
        <Text variant="eyebrow" muted>Credits left</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="statNum" style={{ fontSize: 24, lineHeight: 24 }}>{credits}</Text>
          <Text variant="caption" muted>{allowance ? `of ${allowance} · resets ${monthHeader().resets}` : 'No plan yet'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: bars }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 9999, backgroundColor: i < credits ? c.ink : c.surfaceSunken }} />
          ))}
        </View>
      </Press>
      <View style={{ marginTop: 8 }}>
        <Button block size="sm" icon="scan-line" onPress={() => router.push('/check-in/scan')}>Check in</Button>
      </View>
    </View>
  );
}
