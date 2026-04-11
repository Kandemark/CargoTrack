/**
 * Navbar.tsx — Top bar with dark mode toggle, breadcrumbs, alert bell, ⌘K hint.
 */
import { Bell, Sun, Moon, Search, ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

// ── Breadcrumb helpers ────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  admin:      'Admin',
  ops:        'Operations',
  driver:     'Driver',
  portal:     'Client Portal',
  shared:     '',
  dashboard:  'Dashboard',
  shipments:  'Shipments',
  tracking:   'Live Tracking',
  alerts:     'Alerts',
  predictions:'AI Predictions',
  'live-map': 'Live Map',
  payments:   'Payments',
  documents:  'Documents',
  team:       'Team',
  settings:   'Settings',
  new:        'New Shipment',
  'log-event':'Log Event',
}

function useBreadcrumbs(): { label: string; to: string }[] {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; to: string }[] = []
  let path = ''
  for (const seg of segments) {
    path += `/${seg}`
    const label = SEGMENT_LABELS[seg] ?? seg
    if (label) crumbs.push({ label, to: path })
  }
  return crumbs
}

export default function Navbar({ onCmdK }: { onCmdK?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const unreadAlerts = useAlertStore((s) => s.unreadCount)
  const { dark, toggle: toggleTheme } = useThemeStore()
  const crumbs = useBreadcrumbs()

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '??'

  return (
    <header className={cn(
      'h-13 shrink-0 z-10 flex items-center justify-between px-6',
      'bg-white dark:bg-[#111827] border-b border-gray-100 dark:border-white/8',
    )}>
      {/* Left — breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm overflow-hidden">
        {crumbs.map((c, i) => (
          <span key={c.to} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-white/20 shrink-0" />}
            {i === crumbs.length - 1 ? (
              <span className="text-gray-700 dark:text-white/80 font-medium truncate">{c.label}</span>
            ) : (
              <Link to={c.to} className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition-colors truncate">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5">

        {/* ⌘K search hint */}
        <button
          onClick={onCmdK}
          className={cn(
            'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs',
            'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10',
            'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70',
            'transition-colors',
          )}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-white/10 font-mono">⌘K</kbd>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-400 dark:text-white/50 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Alert bell */}
        <Link
          to="/shared/alerts"
          className="relative p-2 rounded-lg text-gray-400 dark:text-white/50 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#111827]" />
          )}
        </Link>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

        {/* User avatar */}
        <button className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'var(--ct-navy)' }}
          >
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-white/80 hidden sm:block max-w-[120px] truncate">
            {user ? `${user.first_name} ${user.last_name}` : 'Account'}
          </span>
        </button>
      </div>
    </header>
  )
}
