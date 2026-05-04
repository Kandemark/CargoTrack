/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand
        'ct-navy':        '#0f2d5e',
        'ct-navy-light':  '#1a3a6b',
        'ct-orange':      '#f5801e',
        'ct-orange-soft': 'rgba(245,128,30,0.18)',

        // Text hierarchy
        'ct-text-primary':    '#111827',
        'ct-text-secondary':  '#374151',
        'ct-text-muted':      '#6B7280',
        'ct-text-faint':      '#9CA3AF',
        'ct-text-inverse':    '#FFFFFF',
        'ct-text-brand':      '#93B4D8',

        // Surface
        'ct-surface-bg':    '#F1F5F9',
        'ct-surface-card':  '#FFFFFF',
        'ct-surface-muted': '#F8FAFC',

        // Status
        'ct-in-transit': '#2563EB',
        'ct-customs':    '#F59E0B',
        'ct-delayed':    '#EF4444',
        'ct-delivered':  '#16A34A',
        'ct-pending':    '#94A3B8',

        // Risk
        'ct-risk-low':    '#16A34A',
        'ct-risk-medium': '#F59E0B',
        'ct-risk-high':   '#EF4444',

        // UI
        'ct-danger':  '#EF4444',
        'ct-success': '#10B981',
        'ct-info':    '#3B82F6',

        // Border
        'ct-border-light': '#E5E7EB',
        'ct-border-mid':   '#D1D5DB',

        // Dark mode surfaces
        'ct-dark-bg':        '#0a1929',
        'ct-dark-surface':   '#0d1117',
        'ct-dark-card':      '#1a2235',
        'ct-dark-border':    '#1e293b',
        'ct-dark-text':        '#e2e8f0',
        'ct-dark-text-muted':  '#94a3b8',

        // Glass morphism
        'ct-glass-dark':  'rgba(10,25,41,0.85)',
        'ct-glass-light': 'rgba(255,255,255,0.85)',
        'ct-glass-border': 'rgba(255,255,255,0.08)',

        // Glows
        'ct-glow-orange': 'rgba(245,128,30,0.4)',
        'ct-glow-blue':   'rgba(37,99,235,0.4)',
        'ct-glow-red':    'rgba(239,68,68,0.4)',
        'ct-glow-green':  'rgba(22,163,74,0.4)',
      },
      fontFamily: {
        heading: ['SpaceGrotesk', 'System'],
        body:    ['DMSans', 'System'],
      },
      fontSize: {
        'ct-xs':   ['10px', { lineHeight: '14px' }],
        'ct-sm':   ['11px', { lineHeight: '15px' }],
        'ct-base': ['13px', { lineHeight: '18px' }],
        'ct-md':   ['14px', { lineHeight: '20px' }],
        'ct-lg':   ['16px', { lineHeight: '22px' }],
        'ct-xl':   ['20px', { lineHeight: '26px' }],
        'ct-2xl':  ['22px', { lineHeight: '28px' }],
        'ct-3xl':  ['28px', { lineHeight: '34px' }],
      },
      borderRadius: {
        'ct-sm':  '8px',
        'ct-md':  '12px',
        'ct-lg':  '16px',
        'ct-xl':  '20px',
        'ct-2xl': '24px',
      },
      spacing: {
        'ct-xs':  '4',
        'ct-sm':  '8',
        'ct-md':  '12',
        'ct-lg':  '16',
        'ct-xl':  '20',
        'ct-2xl': '24',
        'ct-3xl': '32',
        'ct-4xl': '40',
      },
    },
  },
  plugins: [],
}
