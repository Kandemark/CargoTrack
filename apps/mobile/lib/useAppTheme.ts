import { useMemo } from 'react'
import { useThemeStore, type ResolvedMode } from '@/lib/themeStore'
import { T } from '@/lib/theme'

export interface AppTheme {
  isDark: boolean
  resolved: ResolvedMode
  colors: {
    background: string
    card: string
    muted: string
    text: string
    textSecondary: string
    textMuted: string
    textFaint: string
    textInverse: string
    textBrand: string
    border: string
    borderMid: string
    glassCard: string
    glassBorder: string
    glassTabBar: string
  }
  /** Mode-invariant brand/status colors */
  brand: typeof T.color.brand
  status: typeof T.color.status
  risk: typeof T.color.risk
  ui: typeof T.color.ui
  spacing: typeof T.spacing
  radius: typeof T.radius
  font: typeof T.font
  shadow: typeof T.shadow
}

export function useAppTheme(): AppTheme {
  const resolved = useThemeStore((s) => s.resolved)
  const isDark = resolved === 'dark'
  const mode = isDark ? T.dark : T.light

  return useMemo(() => ({
    isDark,
    resolved,
    colors: {
      background:     mode.surface.background,
      card:           mode.surface.card,
      muted:          mode.surface.muted,
      text:           mode.text.primary,
      textSecondary:  mode.text.secondary,
      textMuted:      mode.text.muted,
      textFaint:      mode.text.faint,
      textInverse:    mode.text.inverse,
      textBrand:      mode.text.brandMuted,
      border:         mode.border.light,
      borderMid:      mode.border.mid,
      glassCard:      mode.glass.card,
      glassBorder:    mode.glass.border,
      glassTabBar:    mode.glass.tabBar,
    },
    brand:  T.color.brand,
    status: T.color.status,
    risk:   T.color.risk,
    ui:     T.color.ui,
    spacing: T.spacing,
    radius:  T.radius,
    font:    T.font,
    shadow:  T.shadow,
  }), [isDark, mode])
}
