/**
 * Navbar.tsx — Top application bar for CargoTrack.
 *
 * Features:
 *  - Dynamic breadcrumb trail from the current URL
 *  - Global search trigger (⌘K / Ctrl+K)
 *  - Dark / light mode toggle
 *  - Notification bell with live unread count badge + dropdown preview
 *  - User avatar menu with profile details, settings link, and sign-out
 *  - Role badge and "online" status dot visible in user menu
 */
import { useEffect, useRef, useState } from 'react'
import {
  Bell, Sun, Moon, Search, ChevronRight, Settings,
  LogOut, Home, AlertTriangle, CheckCircle2,
  Info, AlertOctagon, ExternalLink,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

// ── Breadcrumb helpers ────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  admin:           'Admin',
  ops:             'Operations',
  driver:          'Driver',
  portal:          'Client Portal',
  dispatch:        'Dispatch',
  customs:         'Customs',
  warehouse:       'Warehouse',
  port:            'Port Ops',
  finance:         'Finance',
  fleet:           'Fleet',
  shared:          '',
  dashboard:       'Dashboard',
  shipments:       'Shipments',
  tracking:        'Live Tracking',
  alerts:          'Alerts',
  predictions:     'AI Predictions',
  'live-map':      'Live Map',
  payments:        'Payments',
  documents:       'Documents',
  team:            'Team',
  settings:        'Settings',
  new:             'New Shipment',
  'log-event':     'Log Event',
  trucks:          'Trucks',
  drivers:         'Drivers',
  queue:           'Queue',
  routes:          'Route Planning',
  inventory:       'Inventory',
  inbound:         'Inbound',
  outbound:        'Outbound',
  vessels:         'Vessel Schedule',
  containers:      'Containers',
  manifest:        'Manifests',
  compliance:      'Compliance',
  revenue:         'Revenue',
  reports:         'Reports',
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

// ── Severity icon helper ──────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'CRITICAL': return <AlertOctagon className="w-3.5 h-3.5 text-red-500 shrink-0" />
    case 'HIGH':     return <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
    case 'MEDIUM':   return <Info className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
    default:         return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  }
}

// ── Alert notification dropdown ───────────────────────────────────────────────

interface Alert {
  id: number
  message: string
  severity: string
  sent_at: string
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/api/alerts').then(({ alertsApi }) =>
      alertsApi.getAlerts({ page_size: 5, acknowledged: false })
        .then((r) => setAlerts(r.data.results ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    )
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'absolute right-0 top-full mt-2 w-80 z-50',
        'bg-white dark:bg-[#111827] rounded-xl shadow-2xl',
        'border border-gray-100 dark:border-white/10 overflow-hidden',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/8">
        <p className="text-sm font-bold text-gray-800 dark:text-white">Notifications</p>
        <Link
          to="/shared/alerts"
          onClick={onClose}
          className="text-xs font-semibold text-ct-orange hover:underline flex items-center gap-1"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Alert list */}
      <div className="divide-y divide-gray-50 dark:divide-white/5">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-ct-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-white/30">
            No unread alerts
          </p>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <SeverityIcon severity={a.severity} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 dark:text-white/80 line-clamp-2 leading-relaxed">{a.message}</p>
              <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5">{timeAgo(a.sent_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── User menu dropdown ────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  ADMIN:           '#dc2626',
  LOGISTICS_MGR:   '#0f2d5e',
  CARRIER:         '#2563eb',
  CLIENT:          '#7c3aed',
  DISPATCHER:      '#0891b2',
  CUSTOMS_BROKER:  '#b45309',
  WAREHOUSE_MGR:   '#16a34a',
  PORT_AGENT:      '#0f766e',
  FINANCE_OFFICER: '#9333ea',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:           'Administrator',
  LOGISTICS_MGR:   'Logistics Manager',
  CARRIER:         'Carrier / Driver',
  CLIENT:          'Client',
  DISPATCHER:      'Dispatcher',
  CUSTOMS_BROKER:  'Customs Broker',
  WAREHOUSE_MGR:   'Warehouse Manager',
  PORT_AGENT:      'Port Agent',
  FINANCE_OFFICER: 'Finance Officer',
}

function UserMenuDropdown({ user, onClose }: { user: { first_name: string; last_name: string; role: string; email?: string; org_name?: string | null; date_joined?: string }; onClose: () => void }) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const roleColor = ROLE_COLOR[user.role] ?? '#0f2d5e'
  const roleLabel = ROLE_LABELS[user.role] ?? user.role
  const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()

  async function handleLogout() {
    onClose()
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'absolute right-0 top-full mt-2 w-72 z-50',
        'bg-white dark:bg-[#111827] rounded-xl shadow-2xl',
        'border border-gray-100 dark:border-white/10 overflow-hidden',
      )}
    >
      {/* User identity header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/8">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-offset-1 ring-gray-100 dark:ring-white/10"
              style={{ background: roleColor }}
            >
              {initials}
            </div>
            {/* Online dot */}
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#111827]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-gray-400 dark:text-white/30 truncate">{user.email}</p>
            {/* Role badge */}
            <span
              className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ background: roleColor }}
            >
              {roleLabel}
            </span>
          </div>
        </div>
        {/* Organization */}
        {user.org_name && (
          <div className="mt-3 pt-3 border-t border-gray-50 dark:border-white/5 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-ct-navy dark:text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className="text-xs text-gray-500 dark:text-white/50 truncate">{user.org_name}</span>
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="py-1">
        <Link
          to="/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-400 dark:text-white/30" />
          Settings
        </Link>
      </div>

      <div className="border-t border-gray-100 dark:border-white/8 py-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </motion.div>
  )
}

// ── Main Navbar component ─────────────────────────────────────────────────────

export default function Navbar({ onCmdK }: { onCmdK?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const unreadAlerts = useAlertStore((s) => s.unreadCount)
  const { dark, toggle: toggleTheme } = useThemeStore()
  const crumbs = useBreadcrumbs()

  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '??'
  const roleColor = ROLE_COLOR[user?.role ?? ''] ?? '#0f2d5e'

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onCmdK?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCmdK])

  return (
    <header className={cn(
      'h-14 shrink-0 z-10 flex items-center justify-between px-6',
      'bg-white/95 dark:bg-[#0d1b2e]/95 backdrop-blur-sm',
      'border-b border-gray-100/80 dark:border-white/6',
    )}>

      {/* ── Left: breadcrumbs ──────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 text-sm overflow-hidden">
        {/* Home anchor */}
        <Link to="/" className="text-gray-300 dark:text-white/20 hover:text-ct-orange transition-colors shrink-0">
          <Home className="w-3.5 h-3.5" />
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.to} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-gray-200 dark:text-white/15 shrink-0" />
            {i === crumbs.length - 1 ? (
              <span className="text-gray-700 dark:text-white/85 font-semibold truncate text-[13px]">{c.label}</span>
            ) : (
              <Link
                to={c.to}
                className="text-gray-400 dark:text-white/35 hover:text-gray-700 dark:hover:text-white/70 transition-colors truncate text-[13px]"
              >
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* ── Right: action cluster ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1">

        {/* ⌘K search trigger */}
        <button
          onClick={onCmdK}
          className={cn(
            'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs',
            'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8',
            'text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/70',
            'hover:border-gray-300 dark:hover:border-white/20 transition-all',
          )}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-white/8 font-mono text-gray-500 dark:text-white/30">
            ⌘K
          </kbd>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false) }}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              notifOpen
                ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white'
                : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8',
            )}
          >
            <Bell className="w-4 h-4" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0d1b2e] animate-pulse" />
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <NotificationDropdown onClose={() => setNotifOpen(false)} />
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-white/8 mx-0.5" />

        {/* User avatar + menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false) }}
            className={cn(
              'flex items-center gap-2.5 pl-1 pr-2.5 py-1.5 rounded-lg transition-all',
              userMenuOpen
                ? 'bg-gray-100 dark:bg-white/10'
                : 'hover:bg-gray-100 dark:hover:bg-white/8',
            )}
          >
            {/* Avatar circle */}
            <div className="relative shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: roleColor }}
              >
                {initials}
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1.5 ring-white dark:ring-[#0d1b2e]" />
            </div>
            <span className="text-[13px] font-semibold text-gray-700 dark:text-white/85 hidden sm:block max-w-[110px] truncate">
              {user ? `${user.first_name} ${user.last_name}` : 'Account'}
            </span>
          </button>

          <AnimatePresence>
            {userMenuOpen && user && (
              <UserMenuDropdown
                user={user}
                onClose={() => setUserMenuOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
