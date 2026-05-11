/** Mode-invariant colors — brand, status, risk, UI, and map. */

export const brand = {
  primary:    '#0f2d5e',
  secondary:  '#1a3a6b',
  accent:     '#f5801e',
  accentSoft: 'rgba(245,128,30,0.18)',
} as const

export const status = {
  inTransit: '#2563EB',
  customs:   '#F59E0B',
  delayed:   '#EF4444',
  delivered: '#16A34A',
  pending:   '#94A3B8',
} as const

export const risk = {
  low:    '#16A34A',
  medium: '#F59E0B',
  high:   '#EF4444',
} as const

export const ui = {
  danger:  '#EF4444',
  success: '#10B981',
  info:    '#3B82F6',
} as const

export const map = {
  background: '#F5F3EF',
  water:      '#C8DCF0',
  greenery:   '#DFF0D8',
} as const
