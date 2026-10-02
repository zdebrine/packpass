import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useApp } from '@/store/app';
import { palettes, type Palette, type ThemeName } from './tokens';

type Theme = { name: ThemeName; c: Palette };

const ThemeContext = createContext<Theme>({ name: 'light', c: palettes.light });

/** App-wide theme: follows the device unless the member picked one in Settings. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useApp((s) => s.appearance);
  const name: ThemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return <ThemeContext.Provider value={{ name, c: palettes[name] }}>{children}</ThemeContext.Provider>;
}

/** Forces a theme for a subtree, like `data-theme` in the design files. */
export function ThemeScope({ name, children }: { name: ThemeName; children: ReactNode }) {
  return <ThemeContext.Provider value={{ name, c: palettes[name] }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
