import { useColorScheme } from 'react-native';

/**
 * One accent, three status colours, and greys. Hierarchy comes from type
 * size, weight and space, not from boxes, borders or shadows. Contrast is
 * chosen for phones read outdoors: body text is near-black on white, and
 * white on the accent passes WCAG AA.
 */
const light = {
  paper: '#FFFFFF',
  ink: '#111418',
  muted: '#5B6470',
  faint: '#8A929C',
  line: '#E6E8EB',
  sunken: '#F5F6F7',
  accent: '#C2410C',
  onAccent: '#FFFFFF',
  ok: '#15803D',
  warn: '#B45309',
  danger: '#B91C1C',
};

const dark: typeof light = {
  paper: '#0B0D10',
  ink: '#F2F4F6',
  muted: '#A3ACB7',
  faint: '#6E7782',
  line: '#22262B',
  sunken: '#14171B',
  accent: '#F97316',
  onAccent: '#0B0D10',
  ok: '#4ADE80',
  warn: '#FBBF24',
  danger: '#F87171',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;

/** System fonts only: nothing to download, nothing to fail at start-up. */
export const type = {
  display: { fontSize: 36, lineHeight: 42, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4 },
} as const;

/** Content never stretches wider than this on desktop. */
export const maxContentWidth = 720;

/** Minimum touch target, for use with one hand in a moving cab. */
export const touch = 48;
