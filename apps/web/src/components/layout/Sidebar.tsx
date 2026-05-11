/**
 * Sidebar.tsx — Premium collapsible navigation for CargoTrack.
 *
 * Supports all 9 user roles with role-specific nav sections.
 */
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Map, BarChart3, CreditCard, FileText,
  Users, Settings, Bell, Brain, LogOut, ChevronRight, MessageCircle,
  PanelLeftClose, PanelLeftOpen, Truck, UserCheck,
  ClipboardList, Anchor, Warehouse, Banknote, ShieldCheck,
  Route, AlertTriangle, TrendingUp, Radio, Leaf,
  Link2, ScrollText, DollarSign, BarChart2, BellRing, Gavel,
  ClipboardCheck, Thermometer, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_COLOR, ROLE_LABELS } from '@/lib/roleUtils'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'
import { useSidebarStore } from '@/store/sidebarStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  alertBadge?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

// ── Role metadata ─────────────────────────────────────────────────────────────

// ── Role → nav sections ───────────────────────────────────────────────────────

const ROLE_SECTIONS: Record<string, NavSection[]> = {

  ADMIN: [
    {
      items: [
        { to: '/admin/dashboard', label: 'Admin Home',    icon: LayoutDashboard },
        { to: '/ops/dashboard',   label: 'Operations',    icon: BarChart3       },
        { to: '/messages',        label: 'Messages',      icon: MessageCircle   },
      ],
    },
    {
      title: 'Logistics',
      items: [
        { to: '/ops/shipments',   label: 'Shipments',     icon: Package         },
        { to: '/live-map',        label: 'Live Map',      icon: Map             },
        { to: '/carriers',        label: 'Carriers',      icon: Truck           },
        { to: '/job-board',       label: 'Job Board',     icon: Gavel           },
        { to: '/ops/predictions', label: 'AI Predictions',icon: Brain           },
        { to: '/shared/alerts',   label: 'Alerts',        icon: Bell, alertBadge: true },
        { to: '/notifications',   label: 'Notifications', icon: BellRing        },
        { to: '/sla',             label: 'SLA Monitor',   icon: AlertTriangle   },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/cold-chain',      label: 'Cold Chain',     icon: Thermometer     },
        { to: '/eta',             label: 'ETA Tracker',    icon: Clock           },
      ],
    },
    {
      title: 'Fleet',
      items: [
        { to: '/fleet/trucks',    label: 'Trucks',        icon: Truck           },
        { to: '/fleet/drivers',   label: 'Drivers',       icon: UserCheck       },
        { to: '/fleet/analytics', label: 'Fleet Analytics',icon: TrendingUp     },
        { to: '/carbon',          label: 'Carbon Tracker',icon: Leaf            },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/payments',        label: 'Payments',      icon: CreditCard      },
        { to: '/rates',           label: 'Rate Cards',    icon: DollarSign      },
        { to: '/documents',       label: 'Documents',     icon: FileText        },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { to: '/analytics',       label: 'Analytics',     icon: BarChart2       },
        { to: '/performance',     label: 'Performance',   icon: TrendingUp      },
        { to: '/compliance',      label: 'Compliance',    icon: ShieldCheck     },
        { to: '/integrations',    label: 'Integrations',  icon: Link2           },
        { to: '/audit',           label: 'Audit Log',     icon: ScrollText      },
      ],
    },
    {
      title: 'Admin',
      items: [
        { to: '/team',            label: 'Team',          icon: Users           },
        { to: '/settings',        label: 'Settings',      icon: Settings        },
      ],
    },
  ],

  LOGISTICS_MGR: [
    {
      items: [
        { to: '/ops/dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
        { to: '/messages',        label: 'Messages',      icon: MessageCircle   },
      ],
    },
    {
      title: 'Logistics',
      items: [
        { to: '/ops/shipments',   label: 'Shipments',     icon: Package         },
        { to: '/live-map',        label: 'Live Map',      icon: Map             },
        { to: '/carriers',        label: 'Carriers',      icon: Truck           },
        { to: '/ops/predictions', label: 'AI Predictions',icon: Brain           },
        { to: '/shared/alerts',   label: 'Alerts',        icon: Bell, alertBadge: true },
        { to: '/sla',             label: 'SLA Monitor',   icon: AlertTriangle   },
        { to: '/documents',       label: 'Documents',     icon: FileText        },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/cold-chain',      label: 'Cold Chain',     icon: Thermometer     },
        { to: '/eta',             label: 'ETA Tracker',    icon: Clock           },
      ],
    },
    {
      title: 'Fleet',
      items: [
        { to: '/fleet/trucks',    label: 'Trucks',        icon: Truck           },
        { to: '/fleet/drivers',   label: 'Drivers',       icon: UserCheck       },
        { to: '/fleet/analytics', label: 'Fleet Analytics',icon: TrendingUp     },
        { to: '/carbon',          label: 'Carbon Tracker',icon: Leaf            },
      ],
    },
    {
      title: 'Finance & Reports',
      items: [
        { to: '/payments',        label: 'Payments',      icon: CreditCard      },
        { to: '/rates',           label: 'Rate Cards',    icon: DollarSign      },
        { to: '/analytics',       label: 'Analytics',     icon: BarChart2       },
        { to: '/performance',     label: 'Performance',   icon: TrendingUp      },
        { to: '/compliance',      label: 'Compliance',    icon: ShieldCheck     },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',   label: 'Notifications', icon: BellRing        },
        { to: '/settings',        label: 'Settings',      icon: Settings        },
      ],
    },
  ],

  CARRIER: [
    {
      items: [
        { to: '/driver/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
        { to: '/messages',         label: 'Messages',     icon: MessageCircle   },
      ],
    },
    {
      title: 'Shipments',
      items: [
        { to: '/job-board',        label: 'Job Board',    icon: Gavel           },
        { to: '/driver/shipments', label: 'My Shipments', icon: Package         },
        { to: '/live-map',         label: 'Live Map',     icon: Map             },
        { to: '/shared/alerts',    label: 'Alerts',       icon: Bell, alertBadge: true },
        { to: '/documents',        label: 'Documents',    icon: FileText        },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/eta',             label: 'ETA Tracker',    icon: Clock           },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',    label: 'Notifications',icon: BellRing        },
        { to: '/settings',         label: 'Settings',     icon: Settings        },
      ],
    },
  ],

  CLIENT: [
    {
      items: [
        { to: '/portal/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
        { to: '/messages',         label: 'Messages',     icon: MessageCircle   },
      ],
    },
    {
      title: 'My Cargo',
      items: [
        { to: '/job-board',        label: 'Job Board',    icon: Gavel           },
        { to: '/portal/shipments', label: 'Shipments',    icon: Package         },
        { to: '/live-map',         label: 'Live Map',     icon: Map             },
        { to: '/shared/alerts',    label: 'Alerts',       icon: Bell, alertBadge: true },
        { to: '/documents',        label: 'Documents',    icon: FileText        },
        { to: '/compliance',       label: 'Compliance',   icon: ShieldCheck     },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/eta',             label: 'ETA Tracker',    icon: Clock           },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/payments',         label: 'Payments',     icon: CreditCard      },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',    label: 'Notifications',icon: BellRing        },
        { to: '/settings',         label: 'Settings',     icon: Settings        },
      ],
    },
  ],

  DISPATCHER: [
    {
      items: [
        { to: '/dispatch/dashboard', label: 'Dispatch Hub', icon: LayoutDashboard },
        { to: '/messages',           label: 'Messages',     icon: MessageCircle   },
      ],
    },
    {
      title: 'Dispatch',
      items: [
        { to: '/job-board',          label: 'Job Board',      icon: Gavel           },
        { to: '/dispatch/queue',     label: 'Dispatch Queue', icon: ClipboardList   },
        { to: '/dispatch/routes',    label: 'Route Planning', icon: Route           },
        { to: '/live-map',           label: 'Live Map',       icon: Map             },
        { to: '/carriers',           label: 'Carriers',       icon: Truck           },
        { to: '/shared/alerts',      label: 'Alerts',         icon: Bell, alertBadge: true },
        { to: '/sla',                label: 'SLA Monitor',    icon: AlertTriangle   },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/eta',             label: 'ETA Tracker',    icon: Clock           },
      ],
    },
    {
      title: 'Fleet',
      items: [
        { to: '/fleet/trucks',       label: 'Trucks',         icon: Truck           },
        { to: '/fleet/drivers',      label: 'Drivers',        icon: UserCheck       },
        { to: '/fleet/analytics',    label: 'Fleet Analytics', icon: TrendingUp      },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',      label: 'Notifications',  icon: BellRing        },
        { to: '/settings',           label: 'Settings',       icon: Settings        },
      ],
    },
  ],

  CUSTOMS_BROKER: [
    {
      items: [
        { to: '/customs/dashboard',  label: 'Customs Hub',    icon: LayoutDashboard },
        { to: '/messages',           label: 'Messages',       icon: MessageCircle   },
      ],
    },
    {
      title: 'Clearance',
      items: [
        { to: '/customs/queue',      label: 'Clearance Queue',icon: ClipboardList   },
        { to: '/customs/documents',  label: 'Documents',      icon: FileText        },
        { to: '/compliance',         label: 'Compliance',     icon: ShieldCheck     },
        { to: '/shared/alerts',      label: 'Alerts',         icon: Bell, alertBadge: true },
      ],
    },
    {
      title: 'Tracking',
      items: [
        { to: '/ops/shipments',      label: 'Shipments',      icon: Package         },
        { to: '/live-map',           label: 'Live Map',       icon: Map             },
        { to: '/audit',              label: 'Audit Log',      icon: ScrollText      },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',      label: 'Notifications',  icon: BellRing        },
        { to: '/settings',           label: 'Settings',       icon: Settings        },
      ],
    },
  ],

  WAREHOUSE_MGR: [
    {
      items: [
        { to: '/warehouse/dashboard',label: 'Warehouse Hub',  icon: LayoutDashboard },
        { to: '/messages',           label: 'Messages',       icon: MessageCircle   },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/warehouse/inventory',label: 'Inventory',      icon: Warehouse       },
        { to: '/warehouse/inbound',  label: 'Inbound',        icon: Package         },
        { to: '/warehouse/outbound', label: 'Outbound',       icon: Truck           },
        { to: '/shared/alerts',      label: 'Alerts',         icon: Bell, alertBadge: true },
        { to: '/compliance',         label: 'Compliance',     icon: ShieldCheck     },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/cold-chain',      label: 'Cold Chain',     icon: Thermometer     },
      ],
    },
    {
      title: 'Documents',
      items: [
        { to: '/documents',          label: 'Documents',      icon: FileText        },
        { to: '/live-map',           label: 'Live Map',       icon: Map             },
        { to: '/analytics',          label: 'Analytics',      icon: BarChart2       },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',      label: 'Notifications',  icon: BellRing        },
        { to: '/settings',           label: 'Settings',       icon: Settings        },
      ],
    },
  ],

  PORT_AGENT: [
    {
      items: [
        { to: '/port/dashboard',     label: 'Port Hub',       icon: LayoutDashboard },
        { to: '/messages',           label: 'Messages',       icon: MessageCircle   },
      ],
    },
    {
      title: 'Port Ops',
      items: [
        { to: '/port/vessels',       label: 'Vessel Schedule',icon: Anchor          },
        { to: '/port/containers',    label: 'Containers',     icon: Package         },
        { to: '/port/manifest',      label: 'Manifests',      icon: ClipboardList   },
        { to: '/shared/alerts',      label: 'Alerts',         icon: Bell, alertBadge: true },
        { to: '/compliance',         label: 'Compliance',     icon: ShieldCheck     },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
        { to: '/eta',             label: 'ETA Tracker',    icon: Clock           },
      ],
    },
    {
      title: 'Tracking',
      items: [
        { to: '/ops/shipments',      label: 'Shipments',      icon: Package         },
        { to: '/live-map',           label: 'Live Map',       icon: Map             },
        { to: '/customs/documents',  label: 'Documents',      icon: FileText        },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',      label: 'Notifications',  icon: BellRing        },
        { to: '/settings',           label: 'Settings',       icon: Settings        },
      ],
    },
  ],

  FINANCE_OFFICER: [
    {
      items: [
        { to: '/finance/dashboard',  label: 'Finance Hub',    icon: LayoutDashboard },
        { to: '/messages',           label: 'Messages',       icon: MessageCircle   },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/payments',           label: 'Invoices',       icon: CreditCard      },
        { to: '/finance/revenue',    label: 'Revenue',        icon: TrendingUp      },
        { to: '/finance/reports',    label: 'Reports',        icon: BarChart3       },
        { to: '/rates',              label: 'Rate Cards',     icon: DollarSign      },
        { to: '/shared/alerts',      label: 'Alerts',         icon: Bell, alertBadge: true },
        { to: '/pod',             label: 'Proof of Delivery', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Reporting',
      items: [
        { to: '/analytics',          label: 'Analytics',      icon: BarChart2       },
        { to: '/carbon',             label: 'Carbon Tracker', icon: Leaf            },
        { to: '/ops/shipments',      label: 'Shipments',      icon: Package         },
        { to: '/documents',          label: 'Documents',      icon: FileText        },
        { to: '/audit',              label: 'Audit Log',      icon: ScrollText      },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/notifications',      label: 'Notifications',  icon: BellRing        },
        { to: '/settings',           label: 'Settings',       icon: Settings        },
      ],
    },
  ],
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { collapsed, toggle } = useSidebarStore()
  const unreadAlerts = useAlertStore((s) => s.unreadCount)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '?'

  const role = user?.role ?? ''
  const sections: NavSection[] = ROLE_SECTIONS[role] ?? []
  const roleColor = ROLE_COLOR[role] ?? '#0f2d5e'
  const roleLabel = ROLE_LABELS[role] ?? role

  return (
    <aside
      className={cn(
        'shrink-0 h-screen sticky top-0 flex flex-col overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
        'bg-[#0a1929] border-r border-white/5',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* ── Wordmark ──────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-white/8',
        collapsed ? 'px-3 pt-4 pb-3 justify-center' : 'px-4 pt-5 pb-4 gap-3',
      )}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
        >
          <Radio className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm tracking-tight font-heading truncate">CargoTrack</p>
            <p className="text-white/35 text-[10px] tracking-widest uppercase truncate">Logistics Intelligence</p>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-none">
        {sections.map((section, si) => (
          <div key={si} className={cn('mb-0.5', si > 0 && 'mt-3')}>

            {section.title && !collapsed && (
              <div className="flex items-center gap-2 px-4 pb-1.5 mt-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">
                  {section.title}
                </span>
                <div className="flex-1 h-px bg-white/6" />
              </div>
            )}

            {section.items.map(({ to, label, icon: Icon, alertBadge }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 mx-2 rounded-lg text-sm',
                    'transition-all duration-150',
                    collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-white/12 text-white font-semibold'
                      : 'text-white/55 hover:bg-white/7 hover:text-white/90 font-medium',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                        style={{ background: 'var(--ct-orange)' }}
                      />
                    )}

                    <div className="relative shrink-0">
                      <Icon
                        className={cn(
                          'transition-colors',
                          collapsed ? 'w-5 h-5' : 'w-4 h-4',
                          isActive ? 'text-ct-orange' : 'text-white/40 group-hover:text-white/80',
                        )}
                      />
                      {alertBadge && unreadAlerts > 0 && collapsed && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-1 ring-[#0a1929]" />
                      )}
                    </div>

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{label}</span>
                        {alertBadge && unreadAlerts > 0 && (
                          <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-red-500">
                            {unreadAlerts > 99 ? '99+' : unreadAlerts}
                          </span>
                        )}
                        {isActive && !alertBadge && (
                          <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
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
      <div className="px-2 pb-1">
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
            'text-white/30 hover:text-white/70 hover:bg-white/7',
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
      <div className="border-t border-white/8 p-2">
        <div className={cn(
          'flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/7 transition-colors cursor-pointer',
          collapsed && 'justify-center px-1',
        )}>
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: roleColor }}
            >
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a1929]" />
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-xs font-semibold truncate leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'User'}
                </p>
                <span
                  className="inline-block mt-0.5 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide truncate text-white/90"
                  style={{ background: `${roleColor}55` }}
                >
                  {roleLabel}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="text-white/25 hover:text-white/80 hover:bg-white/10 p-1.5 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
