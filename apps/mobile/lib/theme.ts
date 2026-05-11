/**
 * @file mobile/lib/theme.ts
 *
 * Re-exports canonical design tokens from @cargotrack/design-tokens.
 * This file exists so mobile-specific code can import from `@/lib/theme`
 * while sourcing values from the shared, cross-platform token package.
 *
 * Usage:
 *   import { T } from '@/lib/theme'
 *   import { useAppTheme } from '@/lib/useAppTheme'
 *   const { colors, spacing, radius } = useAppTheme()
 */

import {
  brand,
  status,
  risk,
  ui,
  map,
  light,
  dark,
  spacing,
  radius,
  family,
  size,
  weight,
  cardShadow,
  sheetShadow,
  fabShadow,
} from '@cargotrack/design-tokens'

export { brand, status, risk, ui, map, light, dark, spacing, radius }

export const T = {
  color: { brand, status, risk, map, ui },
  light,
  dark,
  spacing,
  radius,
  font: {
    family,
    size,
    weight,
  },
  shadow: {
    card: cardShadow,
    sheet: sheetShadow,
    fab: fabShadow,
  },
} as const

export type Theme = typeof T
