import { Platform } from 'react-native';

export const colors = {
  background: '#F6F2EA',
  surface: '#FFFFFF',
  surfaceWarm: '#FBF9F4',
  surfaceBlue: '#EDF1F4',
  rail: '#EAEFF2',
  ink: '#1E2630',
  charcoal: '#2C3540',
  muted: '#6C7682',
  faint: '#9AA1AB',
  border: '#ECE4D5',
  borderStrong: '#E4DDCF',
  gold: '#B88A4E',
  goldDark: '#A9763A',
  blue: '#5B7895',
  blueDark: '#46627E',
  blueLine: '#CFE0EE',
  blueChip: '#E3ECF4',
  danger: '#8A3F36',
  dangerSurface: '#FFF2EF',
  dangerBorder: '#E4B8A8',
  white: '#FFFFFF',
};

export const radii = {
  card: 14,
  control: 12,
  pill: 999,
};

// Web uses CSS stacks (families come from the Google Fonts <link> in app/+html.tsx).
// Native resolves fontFamily to an exact font loaded in app/_layout.tsx, so each
// weight/style needs its own token — fontWeight alone cannot switch faces on iOS.
const serifStack = 'Newsreader, Georgia, serif';
const sansStack = 'Hanken Grotesk, system-ui, sans-serif';
const monoStack = 'Space Mono, ui-monospace, monospace';

export const fonts = {
  serif: Platform.select({ web: serifStack, default: 'Newsreader_400Regular' }),
  serifLight: Platform.select({ web: serifStack, default: 'Newsreader_300Light' }),
  serifItalic: Platform.select({ web: serifStack, default: 'Newsreader_400Regular_Italic' }),
  serifLightItalic: Platform.select({ web: serifStack, default: 'Newsreader_300Light_Italic' }),
  sans: Platform.select({ web: sansStack, default: 'HankenGrotesk_400Regular' }),
  sansMedium: Platform.select({ web: sansStack, default: 'HankenGrotesk_500Medium' }),
  sansSemiBold: Platform.select({ web: sansStack, default: 'HankenGrotesk_600SemiBold' }),
  mono: Platform.select({ web: monoStack, default: 'SpaceMono_400Regular' }),
  monoBold: Platform.select({ web: monoStack, default: 'SpaceMono_700Bold' }),
};

export const typography = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 2.2,
  },
  screenTitle: {
    fontFamily: fonts.serifLight,
    fontSize: 46,
    fontWeight: '300' as const,
    lineHeight: 52,
    letterSpacing: 0,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 26,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
};

export const textureColors: Record<string, string> = {
  Hopeful: '#B88A4E',
  Tender: '#B08F8C',
  Reflective: '#6B8198',
  Relaxed: '#8A9A86',
  Warm: '#B88A4E',
  Curious: '#8A7790',
  Grateful: '#8A9A86',
  Unprocessed: '#8A939E',
};

export function getTextureColor(texture: string | null | undefined) {
  return texture ? textureColors[texture] ?? '#8A939E' : '#8A939E';
}
