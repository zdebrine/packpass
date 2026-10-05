// Icons an editor can pick for a card in Sanity (the schema's icon list in sanity/schema.js matches these names).
import {
  Banknote, Calendar, CalendarCheck, CalendarPlus, Clock, Coins, Dog, Flame, Heart, Landmark, MapPin, MessageSquareText,
  ShieldCheck, Sparkles, Star, TrendingUp, UserPlus, Users, type LucideIcon,
} from 'lucide-react';

export const ICONS = {
  Banknote, Calendar, CalendarCheck, CalendarPlus, Clock, Coins, Dog, Flame, Heart, Landmark, MapPin, MessageSquareText,
  ShieldCheck, Sparkles, Star, TrendingUp, UserPlus, Users,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const icon = (name: string | undefined): LucideIcon => ICONS[name as IconName] ?? Sparkles;
