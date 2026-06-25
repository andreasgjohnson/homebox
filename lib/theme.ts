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

export const fonts = {
  serif: 'Newsreader, Georgia, serif',
  sans: 'Hanken Grotesk, system-ui, sans-serif',
  mono: 'Space Mono, ui-monospace, monospace',
};

export const typography = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 2.2,
  },
  screenTitle: {
    fontFamily: fonts.serif,
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
