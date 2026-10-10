import {
  Activity, ArrowRight, Award, BatteryFull, Bell, Bookmark, Cake, Calendar, CalendarCheck, CalendarSearch, CalendarX, Camera, Check,
  ChevronDown, ChevronLeft, ChevronRight, Clock, Fence, FileText, Flashlight, House, Link, Lock, LockOpen, MapPin, MessageSquare,
  Minus, Plus, RotateCcw, Search, Settings, Share, Shield, ShieldAlert, ShieldCheck, Star, Stethoscope, Syringe, Ticket,
  Trees, TrendingUp, Trophy, UserRound, Users, X, Zap, type LucideIcon,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';

const ICONS = {
  activity: Activity, 'arrow-right': ArrowRight, award: Award, 'battery-full': BatteryFull, bell: Bell, bookmark: Bookmark,
  cake: Cake, calendar: Calendar, 'calendar-check': CalendarCheck, 'calendar-search': CalendarSearch, 'calendar-x': CalendarX, camera: Camera,
  check: Check, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, clock: Clock,
  fence: Fence, 'file-text': FileText, flashlight: Flashlight, house: House, link: Link, lock: Lock, 'lock-open': LockOpen, 'map-pin': MapPin,
  'message-square': MessageSquare, minus: Minus, plus: Plus, 'rotate-ccw': RotateCcw, search: Search, settings: Settings,
  share: Share, shield: Shield, 'shield-alert': ShieldAlert, 'shield-check': ShieldCheck, star: Star,
  stethoscope: Stethoscope, syringe: Syringe, ticket: Ticket, trees: Trees, 'trending-up': TrendingUp, trophy: Trophy,
  'user-round': UserRound, users: Users, x: X, zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Lucide outline icon, 2px stroke, rounded caps (design system iconography). */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color ?? c.ink} strokeWidth={2} absoluteStrokeWidth={false} />;
}
