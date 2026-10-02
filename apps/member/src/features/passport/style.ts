import type { Clearance } from '@/data/passport';
import { useTheme } from '@/theme/ThemeProvider';

/** Badge colors and icon for each clearance status. */
export function useClearanceStyle() {
  const { c } = useTheme();
  return (k: Clearance) =>
    ({
      cleared: { bg: c.pitch, fg: c.onPitch, icon: 'shield-check' as const, color: c.ink },
      expired: { bg: c.kennelRedSoft, fg: c.kennelRed, icon: 'shield-alert' as const, color: c.kennelRed },
      working: { bg: c.turfSoft, fg: c.turf, icon: 'trending-up' as const, color: c.turf },
      needs: { bg: c.surfaceSunken, fg: c.inkMuted, icon: 'shield' as const, color: c.inkMuted },
    })[k.status];
}
