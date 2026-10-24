import {
  Activity, ArrowRight, Award, Ban, BatteryFull, Bell, Bookmark, Building, Cake, Calendar, CalendarCheck, CalendarPlus, CalendarSearch, CalendarX, Camera, Check, CircleDot, Coffee, DoorClosed, Eye, Footprints, Leaf, Mountain, Puzzle, Store, Target,
  ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock, Fence, FilePen, FilePlus, FileText, Flashlight, House, Link, List, Lock, LockOpen, Map, MapPin, MessageSquare,
  Minus, Navigation, Plus, Repeat, RotateCcw, ScanLine, Search, Settings, Share, Shield, ShieldAlert, ShieldCheck, Sparkles, Star, Stethoscope, Syringe, Ticket,
  Timer, Trees, TrendingUp, Trophy, UserRound, Users, Wallet, X, Zap, type LucideIcon,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';

const ICONS = {
  activity: Activity, 'arrow-right': ArrowRight, award: Award, ban: Ban, 'battery-full': BatteryFull, bell: Bell, bookmark: Bookmark, building: Building,
  cake: Cake, calendar: Calendar, 'calendar-check': CalendarCheck, 'calendar-plus': CalendarPlus, 'calendar-search': CalendarSearch, 'calendar-x': CalendarX, camera: Camera,
  check: Check, 'circle-dot': CircleDot, coffee: Coffee, 'door-closed': DoorClosed, eye: Eye, footprints: Footprints, leaf: Leaf, mountain: Mountain, puzzle: Puzzle, store: Store, target: Target,
  'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'circle-alert': CircleAlert, clock: Clock,
  fence: Fence, 'file-pen': FilePen, 'file-plus': FilePlus, 'file-text': FileText, flashlight: Flashlight, house: House, link: Link, list: List, lock: Lock, 'lock-open': LockOpen, map: Map, 'map-pin': MapPin,
  'message-square': MessageSquare, minus: Minus, navigation: Navigation, plus: Plus, repeat: Repeat, 'rotate-ccw': RotateCcw, 'scan-line': ScanLine, search: Search, settings: Settings,
  share: Share, shield: Shield, 'shield-alert': ShieldAlert, 'shield-check': ShieldCheck, sparkles: Sparkles, star: Star,
  stethoscope: Stethoscope, syringe: Syringe, ticket: Ticket, timer: Timer, trees: Trees, 'trending-up': TrendingUp, trophy: Trophy,
  'user-round': UserRound, users: Users, wallet: Wallet, x: X, zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Lucide outline icon, 2px stroke, rounded caps (design system iconography). */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color ?? c.ink} strokeWidth={2} absoluteStrokeWidth={false} />;
}
