import { View, Text, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { DrawerContentScrollView } from '@react-navigation/drawer'
import { DrawerActions } from '@react-navigation/native'
import { useAuthStore, useAlertStore } from '@/lib/store'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AnimatedPressable from './animated/AnimatedPressable'

type IconName = React.ComponentProps<typeof Ionicons>['name']

interface NavItem {
  route: string
  label: string
  icon: IconName
  alertBadge?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

// ── Role → nav sections (mirrors web Sidebar.tsx) ────────────────────────────

const DRAWER_SECTIONS: Record<string, NavSection[]> = {
  ADMIN: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Admin Home',      icon: 'grid-outline' },
        { route: '/ops/dashboard',    label: 'Operations',       icon: 'stats-chart-outline' },
        { route: '/messages',         label: 'Messages',         icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Logistics',
      items: [
        { route: '/(tabs)/shipments', label: 'Shipments',       icon: 'cube-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/carriers',         label: 'Carriers',        icon: 'car-outline' },
        { route: '/job-board',        label: 'Job Board',       icon: 'hammer-outline' },
        { route: '/predictions',      label: 'AI Predictions',  icon: 'bulb-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/sla',              label: 'SLA Monitor',     icon: 'alert-circle-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/cold-chain',       label: 'Cold Chain',      icon: 'thermometer-outline' },
        { route: '/eta',              label: 'ETA Tracker',     icon: 'time-outline' },
      ],
    },
    {
      title: 'Fleet',
      items: [
        { route: '/fleet/trucks',     label: 'Trucks',          icon: 'car-outline' },
        { route: '/fleet/drivers',    label: 'Drivers',         icon: 'person-outline' },
        { route: '/fleet/analytics',  label: 'Fleet Analytics', icon: 'trending-up-outline' },
        { route: '/carbon',           label: 'Carbon Tracker',  icon: 'leaf-outline' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { route: '/payments',         label: 'Payments',        icon: 'card-outline' },
        { route: '/rates',            label: 'Rate Cards',      icon: 'cash-outline' },
        { route: '/documents',        label: 'Documents',       icon: 'document-text-outline' },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { route: '/analytics',        label: 'Analytics',       icon: 'bar-chart-outline' },
        { route: '/performance',      label: 'Performance',     icon: 'trending-up-outline' },
        { route: '/compliance',       label: 'Compliance',      icon: 'shield-checkmark-outline' },
        { route: '/integrations',     label: 'Integrations',    icon: 'link-outline' },
        { route: '/audit',            label: 'Audit Log',       icon: 'reader-outline' },
      ],
    },
    {
      title: 'Admin',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/team',             label: 'Team',            icon: 'people-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  LOGISTICS_MGR: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Dashboard',       icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Logistics',
      items: [
        { route: '/(tabs)/shipments', label: 'Shipments',       icon: 'cube-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/carriers',         label: 'Carriers',        icon: 'car-outline' },
        { route: '/predictions',      label: 'AI Predictions',  icon: 'bulb-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/sla',              label: 'SLA Monitor',     icon: 'alert-circle-outline' },
        { route: '/documents',        label: 'Documents',       icon: 'document-text-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/cold-chain',       label: 'Cold Chain',      icon: 'thermometer-outline' },
        { route: '/eta',              label: 'ETA Tracker',     icon: 'time-outline' },
      ],
    },
    {
      title: 'Fleet',
      items: [
        { route: '/fleet/trucks',     label: 'Trucks',          icon: 'car-outline' },
        { route: '/fleet/drivers',    label: 'Drivers',         icon: 'person-outline' },
        { route: '/fleet/analytics',  label: 'Fleet Analytics', icon: 'trending-up-outline' },
        { route: '/carbon',           label: 'Carbon Tracker',  icon: 'leaf-outline' },
      ],
    },
    {
      title: 'Finance & Reports',
      items: [
        { route: '/payments',         label: 'Payments',        icon: 'card-outline' },
        { route: '/rates',            label: 'Rate Cards',      icon: 'cash-outline' },
        { route: '/analytics',        label: 'Analytics',       icon: 'bar-chart-outline' },
        { route: '/performance',      label: 'Performance',     icon: 'trending-up-outline' },
        { route: '/compliance',       label: 'Compliance',      icon: 'shield-checkmark-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  CARRIER: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Dashboard',       icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Shipments',
      items: [
        { route: '/job-board',        label: 'Job Board',       icon: 'hammer-outline' },
        { route: '/(tabs)/shipments', label: 'My Shipments',    icon: 'cube-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/documents',        label: 'Documents',       icon: 'document-text-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/eta',              label: 'ETA Tracker',     icon: 'time-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  CLIENT: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Dashboard',       icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'My Cargo',
      items: [
        { route: '/job-board',        label: 'Job Board',       icon: 'hammer-outline' },
        { route: '/(tabs)/shipments', label: 'Shipments',       icon: 'cube-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/documents',        label: 'Documents',       icon: 'document-text-outline' },
        { route: '/compliance',       label: 'Compliance',      icon: 'shield-checkmark-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/eta',              label: 'ETA Tracker',     icon: 'time-outline' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { route: '/payments',         label: 'Payments',        icon: 'card-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  DISPATCHER: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Dispatch Hub',   icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Dispatch',
      items: [
        { route: '/job-board',        label: 'Job Board',       icon: 'hammer-outline' },
        { route: '/dispatch/queue',   label: 'Dispatch Queue',  icon: 'git-compare-outline' },
        { route: '/dispatch/routes',  label: 'Route Planning',  icon: 'git-branch-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/carriers',         label: 'Carriers',        icon: 'car-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/sla',              label: 'SLA Monitor',     icon: 'alert-circle-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/eta',              label: 'ETA Tracker',     icon: 'time-outline' },
      ],
    },
    {
      title: 'Fleet',
      items: [
        { route: '/fleet/trucks',     label: 'Trucks',          icon: 'car-outline' },
        { route: '/fleet/drivers',    label: 'Drivers',         icon: 'person-outline' },
        { route: '/fleet/analytics',  label: 'Fleet Analytics', icon: 'trending-up-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  CUSTOMS_BROKER: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Customs Hub',     icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Clearance',
      items: [
        { route: '/customs/queue',    label: 'Clearance Queue', icon: 'git-compare-outline' },
        { route: '/customs/documents',label: 'Documents',       icon: 'document-text-outline' },
        { route: '/compliance',       label: 'Compliance',      icon: 'shield-checkmark-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
      ],
    },
    {
      title: 'Tracking',
      items: [
        { route: '/(tabs)/shipments', label: 'Shipments',       icon: 'cube-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/audit',            label: 'Audit Log',       icon: 'reader-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  WAREHOUSE_MGR: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Warehouse Hub',   icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { route: '/warehouse/inventory', label: 'Inventory',    icon: 'cube-outline' },
        { route: '/warehouse/inbound',   label: 'Inbound',      icon: 'download-outline' },
        { route: '/warehouse/outbound',  label: 'Outbound',     icon: 'arrow-forward-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/compliance',       label: 'Compliance',      icon: 'shield-checkmark-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/cold-chain',       label: 'Cold Chain',      icon: 'thermometer-outline' },
      ],
    },
    {
      title: 'Documents',
      items: [
        { route: '/documents',        label: 'Documents',       icon: 'document-text-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/analytics',        label: 'Analytics',       icon: 'bar-chart-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  PORT_AGENT: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Port Hub',        icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Port Ops',
      items: [
        { route: '/port/vessels',     label: 'Vessel Schedule', icon: 'boat-outline' },
        { route: '/port/containers',  label: 'Containers',      icon: 'cube-outline' },
        { route: '/port/manifest',    label: 'Manifests',       icon: 'git-compare-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/compliance',       label: 'Compliance',      icon: 'shield-checkmark-outline' },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
        { route: '/eta',              label: 'ETA Tracker',     icon: 'time-outline' },
      ],
    },
    {
      title: 'Tracking',
      items: [
        { route: '/(tabs)/shipments', label: 'Shipments',       icon: 'cube-outline' },
        { route: '/live-map',     label: 'Live Map',        icon: 'map-outline' },
        { route: '/customs/documents',label: 'Documents',       icon: 'document-text-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],

  FINANCE_OFFICER: [
    {
      items: [
        { route: '/(tabs)/index',     label: 'Finance Hub',     icon: 'grid-outline' },
        { route: '/messages',         label: 'Messages',        icon: 'chatbubbles-outline' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { route: '/payments',         label: 'Invoices',        icon: 'card-outline' },
        { route: '/finance/revenue',  label: 'Revenue',         icon: 'trending-up-outline' },
        { route: '/finance/reports',  label: 'Reports',         icon: 'bar-chart-outline' },
        { route: '/rates',            label: 'Rate Cards',      icon: 'cash-outline' },
        { route: '/(tabs)/alerts',    label: 'Alerts',          icon: 'notifications-outline', alertBadge: true },
        { route: '/pod',              label: 'Proof of Delivery', icon: 'checkmark-done-outline' },
      ],
    },
    {
      title: 'Reporting',
      items: [
        { route: '/analytics',        label: 'Analytics',       icon: 'bar-chart-outline' },
        { route: '/carbon',           label: 'Carbon Tracker',  icon: 'leaf-outline' },
        { route: '/(tabs)/shipments', label: 'Shipments',       icon: 'cube-outline' },
        { route: '/documents',        label: 'Documents',       icon: 'document-text-outline' },
        { route: '/audit',            label: 'Audit Log',       icon: 'reader-outline' },
      ],
    },
    {
      title: 'Account',
      items: [
        { route: '/account',         label: 'My Account',     icon: 'person-circle-outline' },
        { route: '/notifications',    label: 'Notifications',   icon: 'megaphone-outline' },
        { route: '/settings',         label: 'Settings',        icon: 'settings-outline' },
      ],
    },
  ],
}

// ── Role display helpers ─────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
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

// Map of existing routes — if a route is not in this set, navigating to it
// shows a "coming soon" alert instead of crashing.
const EXISTING_ROUTES = new Set([
  // Tabs
  '/(tabs)/index',
  '/(tabs)/shipments',
  '/(tabs)/alerts',
  '/(tabs)/menu',
  // Top-level feature screens
  '/live-map',
  '/notifications',
  '/messages',
  '/settings',
  '/analytics',
  '/performance',
  '/compliance',
  '/integrations',
  '/audit',
  '/carriers',
  '/job-board',
  '/predictions',
  '/sla',
  '/pod',
  '/cold-chain',
  '/eta',
  '/carbon',
  '/rates',
  '/team',
  '/payments',
  '/documents',
  '/account',
  // Shipment detail
  '/shipment/[id]',
  '/shipment/log-event',
  // Fleet
  '/fleet/trucks',
  '/fleet/drivers',
  '/fleet/analytics',
  // Dispatch
  '/dispatch/queue',
  '/dispatch/routes',
  // Customs
  '/customs/queue',
  '/customs/documents',
  // Warehouse
  '/warehouse/inventory',
  '/warehouse/inbound',
  '/warehouse/outbound',
  // Port
  '/port/vessels',
  '/port/containers',
  '/port/manifest',
  // Finance
  '/finance/revenue',
  '/finance/reports',
  // Ops
  '/ops/dashboard',
])

// ── Component ─────────────────────────────────────────────────────────────────

export default function DrawerContent({ drawerNav }: { drawerNav?: any }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const unreadCount = useAlertStore((s) => s.unreadCount)
  const insets = useSafeAreaInsets()

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '?'

  const role = user?.role ?? ''
  const sections = DRAWER_SECTIONS[role] ?? []
  const roleColor = ROLE_COLORS[role] ?? '#0f2d5e'
  const roleLabel = ROLE_LABELS[role] ?? role

  function handleNavigate(route: string) {
    if (!EXISTING_ROUTES.has(route)) {
      Alert.alert('Coming Soon', `The "${route.replace('/', '').replace('/', ' › ')}" screen will be available in an upcoming update.`)
      return
    }

    const nav = drawerNav
    if (!nav) {
      // Fallback: use Expo Router (URL-based, layout groups stripped from path)
      if (route === '/(tabs)/index') {
        router.push('/')
      } else if (route.startsWith('/(tabs)/')) {
        router.push(`/${route.replace(/^\/(tabs)\//, '')}` as any)
      } else {
        router.push(route as any)
      }
      return
    }

    // Tab routes: "/(tabs)/index" → navigate to drawer screen "(tabs)" then tab screen "index"
    if (route.startsWith('/(tabs)/')) {
      const screen = route.replace(/^\/(tabs)\//, '')
      nav.navigate('(tabs)', { screen })
    } else {
      // Drawer routes: "/analytics" → "analytics", "/fleet/trucks" → "fleet/trucks"
      const name = route.startsWith('/') ? route.substring(1) : route
      nav.navigate(name)
    }

    // Close the drawer after navigation
    try { nav.closeDrawer() } catch { /* not a drawer navigator */ }
  }

  async function handleLogout() {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1929' }}>
      {/* Brand header */}
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#f5801e', shadowColor: '#f5801e', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
          }}>
            <Ionicons name="cube" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15, letterSpacing: -0.3 }}>CargoTrack</Text>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Logistics Intelligence
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation sections */}
      <DrawerContentScrollView style={{ flex: 1, paddingTop: 8 }}>
        {sections.map((section, si) => (
          <View key={si} style={{ marginBottom: 4 }}>
            {section.title && (
              <Text style={{
                fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase', letterSpacing: 1.2,
                paddingHorizontal: 20, marginTop: si > 0 ? 14 : 4, marginBottom: 6,
              }}>
                {section.title}
              </Text>
            )}
            {section.items.map((item) => (
              <AnimatedPressable
                key={item.route}
                onPress={() => handleNavigate(item.route)}
                scaleTo={0.97}
                haptic={false}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginHorizontal: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  gap: 12,
                }}
              >
                <View style={{ width: 22, alignItems: 'center' }}>
                  <Ionicons name={item.icon} size={18} color="rgba(255,255,255,0.4)" />
                </View>
                <Text style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  {item.label}
                </Text>
                {item.alertBadge && unreadCount > 0 && (
                  <View style={{
                    minWidth: 20, height: 20, borderRadius: 10,
                    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 5,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </AnimatedPressable>
            ))}
          </View>
        ))}
      </DrawerContentScrollView>

      {/* User footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingBottom: insets.bottom }}>
        <AnimatedPressable
          onPress={handleLogout}
          scaleTo={0.97}
          haptic={false}
          style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
            paddingVertical: 12, gap: 12,
          }}
        >
          <View style={{
            width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
            backgroundColor: roleColor,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
              {user ? `${user.first_name} ${user.last_name}` : 'User'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' }}>
              {roleLabel}
            </Text>
          </View>
          <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.3)" />
        </AnimatedPressable>
      </View>
    </View>
  )
}
