/** Typography tokens — font families, sizes, and weights. */

export const family = {
  heading: 'SpaceGrotesk',
  body:    'DMSans',
  mono:    'SpaceMono',
} as const

export const size = {
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   16,
  xl:   20,
  '2xl': 22,
  '3xl': 28,
} as const

export const weight = {
  normal:    '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
} as const
