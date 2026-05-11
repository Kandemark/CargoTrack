/** Surface, text, border, and glass colors — light and dark mode. */

export const light = {
  surface: {
    background: '#F1F5F9',
    card:       '#FFFFFF',
    muted:      '#F8FAFC',
  },
  text: {
    primary:    '#111827',
    secondary:  '#374151',
    muted:      '#6B7280',
    faint:      '#9CA3AF',
    inverse:    '#FFFFFF',
    brandMuted: '#93B4D8',
  },
  border: {
    light: '#E5E7EB',
    mid:   '#D1D5DB',
  },
  glass: {
    card:   'rgba(255,255,255,0.85)',
    border: 'rgba(0,0,0,0.06)',
    tabBar: 'rgba(255,255,255,0.92)',
  },
} as const

export const dark = {
  surface: {
    background: '#0a1929',
    card:       '#1a2235',
    muted:      '#0d1117',
  },
  text: {
    primary:    '#e2e8f0',
    secondary:  '#cbd5e1',
    muted:      '#94a3b8',
    faint:      '#64748b',
    inverse:    '#0a1929',
    brandMuted: '#93B4D8',
  },
  border: {
    light: '#1e293b',
    mid:   '#334155',
  },
  glass: {
    card:   'rgba(10,25,41,0.85)',
    border: 'rgba(255,255,255,0.08)',
    tabBar: 'rgba(10,25,41,0.92)',
  },
} as const
