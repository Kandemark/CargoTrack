import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  MapPin,
  Brain,
  Bell,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import client from '@/api/client'

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/shipments',   label: 'Shipments',      icon: Package },
  { to: '/tracking',    label: 'Live Tracking',  icon: MapPin },
  { to: '/predictions', label: 'Predictions',    icon: Brain },
  { to: '/alerts',      label: 'Alerts',         icon: Bell },
]

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await client.post('/accounts/logout/')
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '?'

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-gray-900 flex flex-col">
      {/* Wordmark */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ct-orange)' }}
          >
            <span className="text-white font-bold text-sm leading-none">CT</span>
          </div>
          <div className="leading-tight">
            <p className="text-white font-bold text-sm">CargoTrack</p>
            <p className="text-gray-500 text-xs">Logistics Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? '' : 'group-hover:text-gray-200')}
                    style={isActive ? { color: 'var(--ct-orange)' } : undefined}
                  />
                  {label}
                </span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'var(--ct-navy)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-200 text-sm font-medium truncate">
              {user ? `${user.first_name} ${user.last_name}` : 'User'}
            </p>
            <p className="text-gray-500 text-xs truncate capitalize">{user?.role ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-gray-500 hover:text-gray-200 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
