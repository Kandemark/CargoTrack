/**
 * @file mobile/lib/theme.ts
 * @description CargoTrack design tokens — single source of truth for all
 * colors, spacing, typography, and radius values.
 *
 * Usage:
 *   import { T } from '@/lib/theme'
 *   style={{ backgroundColor: T.color.brand.primary }}
 */

export const T = {
  color: {
    brand: {
      primary:   '#0f2d5e',   // Navy blue — primary background, headers
      secondary: '#1a3a6b',   // Slightly lighter navy
      accent:    '#f5801e',   // CargoTrack orange — CTAs, active states
      accentSoft:'rgba(245,128,30,0.18)',
    },
    status: {
      inTransit: '#2563EB',
      customs:   '#F59E0B',
      delayed:   '#EF4444',
      delivered: '#16A34A',
      pending:   '#94A3B8',
    },
    risk: {
      low:      '#16A34A',
      medium:   '#F59E0B',
      high:     '#EF4444',
    },
    surface: {
      background: '#F1F5F9',  // App background
      card:       '#FFFFFF',  // Card surface
      muted:      '#F8FAFC',  // Subtle input / stat box bg
    },
    map: {
      background: '#F5F3EF',  // CargoTrack map base
      water:      '#C8DCF0',  // Brand-tinted water
      greenery:   '#DFF0D8',  // Parks
    },
    text: {
      primary:   '#111827',
      secondary: '#374151',
      muted:     '#6B7280',
      faint:     '#9CA3AF',
      inverse:   '#FFFFFF',
      brandMuted:'#93B4D8',   // Light blue text on navy header
    },
    border: {
      light: '#E5E7EB',
      mid:   '#D1D5DB',
    },
    ui: {
      danger:  '#EF4444',
      success: '#10B981',
      info:    '#3B82F6',
    },
  },

  spacing: {
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },

  radius: {
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    '2xl': 24,
    full: 9999,
  },

  font: {
    size: {
      xs:   10,
      sm:   11,
      base: 13,
      md:   14,
      lg:   16,
      xl:   20,
      '2xl': 22,
      '3xl': 28,
    },
    weight: {
      normal:    '400' as const,
      semibold:  '600' as const,
      bold:      '700' as const,
      extrabold: '800' as const,
    },
  },

  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 4,
      elevation: 2,
    },
    sheet: {
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: -3 },
      shadowRadius: 10,
      elevation: 10,
    },
  },
} as const

export type Theme = typeof T
