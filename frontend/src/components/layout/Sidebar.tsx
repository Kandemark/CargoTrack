/**
 * @file Sidebar.tsx
 * @description Left navigation sidebar for authenticated pages.  Renders
 * role-aware nav links — some items are only visible to ADMIN or LOGISTICS_MGR
 * users (e.g. Predictions).
 *
 * Reads from:
 *   - `useAuthStore` — current user role for conditional nav visibility
 *
 * Active link detection uses React Router's `NavLink` with an `isActive`
 * callback so the highlight follows the current route automatically.
 *
 * @returns The fixed-width left sidebar element.
 */
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  MapPin,
  Brain,
  Bell,
  LogOut,
  ChevronRight,
  UserCog,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface NavItem { to: string; label: string; icon: React.ElementType }

/** Nav items visible to each role. Keys match CustomUser.Role values. */
const ROLE_NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { to: '/admin/dashboard', label: 'Admin Home',    icon: Settings        },
    { to: '/ops/dashboard',   label: 'Operations',    icon: LayoutDashboard },
    { to: '/ops/shipments',   label: 'Shipments',     icon: Package         },
    { to: '/shared/tracking', label: 'Live Tracking', icon: MapPin          },
    { to: '/shared/alerts',   label: 'Alerts',        icon: Bell            },
    { to: '/ops/predictions', label: 'Predictions',   icon: Brain           },
    { to: '/admin/dashboard', label: 'User Mgmt',     icon: UserCog         },
  ],
  LOGISTICS_MGR: [
    { to: '/ops/dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/ops/shipments',   label: 'Shipments',     icon: Package         },
    { to: '/shared/tracking', label: 'Live Tracking', icon: MapPin          },
    { to: '/shared/alerts',   label: 'Alerts',        icon: Bell            },
    { to: '/ops/predictions', label: 'Predictions',   icon: Brain           },
  ],
  CARRIER: [
    { to: '/driver/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/driver/shipments',  label: 'My Shipments',  icon: Package         },
    { to: '/shared/tracking',   label: 'Live Tracking', icon: MapPin          },
    { to: '/shared/alerts',     label: 'Alerts',        icon: Bell            },
  ],
  CLIENT: [
    { to: '/portal/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/portal/shipments',  label: 'My Shipments',  icon: Package         },
    { to: '/shared/tracking',   label: 'Live Tracking', icon: MapPin          },
    { to: '/shared/alerts',     label: 'Alerts',        icon: Bell            },
  ],
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '?'

  const navItems: NavItem[] = user ? (ROLE_NAV[user.role] ?? []) : []

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
        {navItems.map(({ to, label, icon: Icon }) => (
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

      {/* User footer */}
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
            <p className="text-gray-500 text-xs truncate">
              {user?.role?.replace('_', ' ').toLowerCase() ?? ''}
            </p>
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
