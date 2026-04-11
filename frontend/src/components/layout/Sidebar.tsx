/**
 * Sidebar.tsx — Collapsible left navigation with role-aware sections.
 * Collapses to icon-only (w-16); expands to full labels (w-60).
 * State persisted via sidebarStore (localStorage).
 */
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Map,
  BarChart3,
  CreditCard,
  FileText,
  Users,
  Settings,
  Bell,
  Brain,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useSidebarStore } from '@/store/sidebarStore'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const ROLE_SECTIONS: Record<string, NavSection[]> = {
  ADMIN: [
    {
      items: [
        { to: '/admin/dashboard', label: 'Admin Home',   icon: LayoutDashboard },
        { to: '/ops/dashboard',   label: 'Operations',   icon: BarChart3        },
      ],
    },
    {
      title: 'Logistics',
      items: [
        { to: '/ops/shipments',   label: 'Shipments',    icon: Package  },
        { to: '/live-map',        label: 'Live Map',     icon: Map      },
        { to: '/ops/predictions', label: 'AI Predictions', icon: Brain  },
        { to: '/shared/alerts',   label: 'Alerts',       icon: Bell     },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/payments',        label: 'Payments',     icon: CreditCard },
        { to: '/documents',       label: 'Documents',    icon: FileText   },
      ],
    },
    {
      title: 'Admin',
      items: [
        { to: '/team',            label: 'Team',         icon: Users    },
        { to: '/settings',        label: 'Settings',     icon: Settings },
      ],
    },
  ],

  LOGISTICS_MGR: [
    {
      items: [
        { to: '/ops/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
      ],
    },
    {
      title: 'Logistics',
      items: [
        { to: '/ops/shipments',   label: 'Shipments',    icon: Package   },
        { to: '/live-map',        label: 'Live Map',     icon: Map       },
        { to: '/ops/predictions', label: 'AI Predictions', icon: Brain   },
        { to: '/shared/alerts',   label: 'Alerts',       icon: Bell      },
        { to: '/documents',       label: 'Documents',    icon: FileText  },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/payments',        label: 'Payments',     icon: CreditCard },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/settings',        label: 'Settings',     icon: Settings },
      ],
    },
  ],

  CARRIER: [
    {
      items: [
        { to: '/driver/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
      ],
    },
    {
      title: 'Shipments',
      items: [
        { to: '/driver/shipments', label: 'My Shipments', icon: Package },
        { to: '/live-map',         label: 'Live Map',      icon: Map    },
        { to: '/shared/alerts',    label: 'Alerts',        icon: Bell   },
        { to: '/documents',        label: 'Documents',     icon: FileText },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/settings',         label: 'Settings',     icon: Settings },
      ],
    },
  ],

  CLIENT: [
    {
      items: [
        { to: '/portal/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
      ],
    },
    {
      title: 'My Cargo',
      items: [
        { to: '/portal/shipments', label: 'Shipments',   icon: Package     },
        { to: '/live-map',         label: 'Live Map',    icon: Map         },
        { to: '/shared/alerts',    label: 'Alerts',      icon: Bell        },
        { to: '/documents',        label: 'Documents',   icon: FileText    },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/payments',         label: 'Payments',    icon: CreditCard },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/settings',         label: 'Settings',    icon: Settings },
      ],
    },
  ],
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:         'Administrator',
  LOGISTICS_MGR: 'Logistics Manager',
  CARRIER:       'Carrier / Driver',
  CLIENT:        'Client',
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { collapsed, toggle } = useSidebarStore()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '?'

  const sections: NavSection[] = user ? (ROLE_SECTIONS[user.role] ?? []) : []

  return (
    <aside
      className={cn(
        'shrink-0 h-screen sticky top-0 flex flex-col overflow-hidden',
        'transition-[width] duration-[var(--duration-base)] ease-in-out',
        'bg-ct-navy dark:bg-[#0a1e3d]',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* ── Wordmark ──────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-white/10',
        collapsed ? 'px-3 pt-4 pb-3 justify-center' : 'px-4 pt-4 pb-3 gap-2.5',
      )}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--ct-orange)' }}
        >
          <span className="text-white font-bold text-sm leading-none">CT</span>
        </div>
        {!collapsed && (
          <div className="leading-tight overflow-hidden">
            <p className="text-white font-bold text-sm font-heading truncate">CargoTrack</p>
            <p className="text-white/50 text-xs truncate">Logistics Intelligence</p>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {sections.map((section, si) => (
          <div key={si} className={cn('mb-1', si > 0 && !collapsed && 'mt-4')}>
            {section.title && !collapsed && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {section.title}
              </p>
            )}
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 mx-2 rounded-lg text-sm font-medium',
                    'transition-colors duration-[var(--duration-fast)]',
                    collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-white/15 text-white border-l-2 border-ct-orange'
                      : 'text-white/60 hover:bg-white/10 hover:text-white border-l-2 border-transparent',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'shrink-0 transition-colors',
                        collapsed ? 'w-5 h-5' : 'w-4 h-4',
                        isActive ? 'text-ct-orange' : 'group-hover:text-white/90',
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{label}</span>
                        {isActive && (
                          <ChevronRight className="w-3 h-3 text-white/40 shrink-0" />
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle ────────────────────────────────────────────────── */}
      <div className="px-2 pb-2">
        <button
          onClick={toggle}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
            'text-white/40 hover:text-white/80 hover:bg-white/10',
            'transition-colors text-xs font-medium',
            collapsed && 'justify-center',
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <><PanelLeftClose className="w-4 h-4" /><span>Collapse</span></>
          }
        </button>
      </div>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 p-2">
        <div className={cn(
          'flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors',
          collapsed && 'justify-center px-1',
        )}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'rgba(249,115,22,0.7)' }}
          >
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-xs font-semibold truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'User'}
                </p>
                <span className="inline-block mt-0.5 px-1.5 py-px rounded text-[9px] font-bold bg-white/10 text-white/60 uppercase tracking-wide truncate">
                  {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? ''}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="text-white/30 hover:text-white/80 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
