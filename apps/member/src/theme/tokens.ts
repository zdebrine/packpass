// Ported from the Pack Athletic Club v2 design system (tokens/*.css).

export type ThemeName = 'light' | 'dark';

const light = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#f3f3f1',
  surfaceSunken: '#ebebe8',
  line: '#e6e6e3',
  ink: '#0e0f0e',
  inkMuted: '#6a6d6b',
  inkFaint: '#a3a6a4',
  inverse: '#0e0f0e',
  onInverse: '#ffffff',
  pitch: '#16322a',
  onPitch: '#f4f5f1',
  onPitchMuted: '#b9c7bf',
  turf: '#3f6b4f',
  turfSoft: '#e3ece5',
  onTurf: '#ffffff',
  agility: '#f2c230',
  onAgility: '#0e0f0e',
  kennelRed: '#b63f2a',
  kennelRedSoft: '#f8e4df',
  glass: 'rgba(255,255,255,0.22)',
  onGlass: '#ffffff',
  shadowFloat: '0px 8px 32px -8px rgba(14,15,14,0.18)',
  shadowCard: '0px 24px 48px -20px rgba(14,15,14,0.45)',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#0e0f0e',
  surface: '#141514',
  surfaceRaised: '#222322',
  surfaceSunken: '#2c2d2c',
  line: '#2e302e',
  ink: '#f4f4f2',
  inkMuted: '#9c9f9d',
  inkFaint: '#5f625f',
  inverse: '#f4f4f2',
  onInverse: '#0e0f0e',
  pitch: '#1b3a30',
  onPitch: '#f4f5f1',
  onPitchMuted: '#b9c7bf',
  turf: '#7fb592',
  turfSoft: '#1f2e26',
  onTurf: '#0e0f0e',
  agility: '#f2c230',
  onAgility: '#0e0f0e',
  kennelRed: '#f08470',
  kennelRedSoft: '#3a1d17',
  glass: 'rgba(255,255,255,0.14)',
  onGlass: '#ffffff',
  shadowFloat: '0px 8px 32px -8px rgba(0,0,0,0.6)',
  shadowCard: '0px 24px 48px -20px rgba(0,0,0,0.8)',
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

export const fonts = {
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemibold: 'Geist_600SemiBold',
  display: 'ArchivoDisplay', // Archivo 800, width 112
  wide: 'ArchivoWide', // Archivo 600, width 125
  wideBold: 'ArchivoWideBold', // Archivo 700, width 125
} as const;

export const radius = { sm: 12, tile: 20, card: 28, sheet: 32, pill: 9999 } as const;

export const space = { gutter: 20, section: 32 } as const;

export const motion = {
  // cubic-bezier(.2,.8,.2,1)
  easeOut: [0.2, 0.8, 0.2, 1] as const,
  fast: 140,
  base: 260,
  slow: 520,
  pressScale: 0.97,
};

// Text variants. Letter spacing is in px here (em * size).
export const type = {
  display2xl: { fontFamily: fonts.display, fontSize: 64, lineHeight: 58, letterSpacing: -1.6 },
  displayXl: { fontFamily: fonts.display, fontSize: 44, lineHeight: 42, letterSpacing: -1.1 },
  displayLg: { fontFamily: fonts.display, fontSize: 32, lineHeight: 32, letterSpacing: -0.8 },
  displayMd: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, letterSpacing: -0.33 },
  wide: { fontFamily: fonts.wide, fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: 'uppercase' },
  title: { fontFamily: fonts.sansSemibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.sansSemibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.085 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },
} as const;

export type TypeVariant = keyof typeof type;
