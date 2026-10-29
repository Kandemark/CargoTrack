import { Pressable, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, usePathname } from 'expo-router'
import { useAuthStore } from '@/lib/store'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '@/lib/useAppTheme'
import { Txt } from '@/components/ui'

type IconName = React.ComponentProps<typeof Ionicons>['name']

/**
 * Every screen the menu can open, defined once. Home, Shipments and Alerts
 * are not here: they are on the tab bar, and the menu never repeats them.
 * Account is reached from the profile row at the top.
 */
const ITEMS = {
  messages:      { route: '/messages',            label: 'Messages',          icon: 'chatbubbles-outline' },
  notifications: { route: '/notifications',       label: 'Notifications',     icon: 'megaphone-outline' },
  ops:           { route: '/ops/dashboard',       label: 'Operations',        icon: 'pulse-outline' },
  liveMap:       { route: '/live-map',            label: 'Live map',          icon: 'map-outline' },
  sla:           { route: '/sla',                 label: 'SLA monitor',       icon: 'speedometer-outline' },
  pod:           { route: '/pod',                 label: 'Proof of delivery', icon: 'checkmark-done-outline' },
  coldChain:     { route: '/cold-chain',          label: 'Cold chain',        icon: 'thermometer-outline' },
  jobBoard:      { route: '/job-board',           label: 'Job board',         icon: 'briefcase-outline' },
  carriers:      { route: '/carriers',            label: 'Carriers',          icon: 'business-outline' },
  trucks:        { route: '/fleet/trucks',        label: 'Trucks',            icon: 'bus-outline' },
  drivers:       { route: '/fleet/drivers',       label: 'Drivers',           icon: 'id-card-outline' },
  fleetStats:    { route: '/fleet/analytics',     label: 'Fleet use',         icon: 'pie-chart-outline' },
  carbon:        { route: '/carbon',              label: 'Carbon',            icon: 'leaf-outline' },
  dispatchQueue: { route: '/dispatch/queue',      label: 'Dispatch queue',    icon: 'list-outline' },
  routes:        { route: '/dispatch/routes',     label: 'Route planning',    icon: 'git-branch-outline' },
  customsQueue:  { route: '/customs/queue',       label: 'Clearance queue',   icon: 'hourglass-outline' },
  customsDocs:   { route: '/customs/documents',   label: 'Customs documents', icon: 'folder-open-outline' },
  inventory:     { route: '/warehouse/inventory', label: 'Inventory',         icon: 'file-tray-stacked-outline' },
  inbound:       { route: '/warehouse/inbound',   label: 'Inbound',           icon: 'arrow-down-circle-outline' },
  outbound:      { route: '/warehouse/outbound',  label: 'Outbound',          icon: 'arrow-up-circle-outline' },
  vessels:       { route: '/port/vessels',        label: 'Vessel schedule',   icon: 'boat-outline' },
  containers:    { route: '/port/containers',     label: 'Containers',        icon: 'cube-outline' },
  manifests:     { route: '/port/manifest',       label: 'Manifests',         icon: 'clipboard-outline' },
  payments:      { route: '/payments',            label: 'Payments',          icon: 'card-outline' },
  rates:         { route: '/rates',               label: 'Rate cards',        icon: 'pricetags-outline' },
  revenue:       { route: '/finance/revenue',     label: 'Revenue',           icon: 'cash-outline' },
  financeReports:{ route: '/finance/reports',     label: 'Finance reports',   icon: 'receipt-outline' },
  analytics:     { route: '/analytics',           label: 'Analytics',         icon: 'bar-chart-outline' },
  performance:   { route: '/performance',         label: 'Performance',       icon: 'trophy-outline' },
  documents:     { route: '/documents',           label: 'Documents',         icon: 'document-text-outline' },
  compliance:    { route: '/compliance',          label: 'Compliance',        icon: 'shield-checkmark-outline' },
  audit:         { route: '/audit',               label: 'Audit log',         icon: 'reader-outline' },
  integrations:  { route: '/integrations',        label: 'Integrations',      icon: 'link-outline' },
  team:          { route: '/team',                label: 'Team',              icon: 'people-outline' },
  settings:      { route: '/settings',            label: 'Settings',          icon: 'settings-outline' },
} satisfies Record<string, { route: string; label: string; icon: IconName }>

type ItemKey = keyof typeof ITEMS
type NavSection = { title?: string; items: ItemKey[] }

const INBOX: NavSection = { items: ['messages', 'notifications'] }
const SETTINGS: NavSection = { items: ['settings'] }

// Each role sees each screen once, under the heading where its work happens.
const DRAWER_SECTIONS: Record<string, NavSection[]> = {
  ADMIN: [
    INBOX,
    { title: 'Operations', items: ['ops', 'liveMap', 'sla', 'pod', 'coldChain', 'jobBoard'] },
    { title: 'Fleet', items: ['carriers', 'trucks', 'drivers', 'fleetStats', 'carbon'] },
    { title: 'Money', items: ['payments', 'rates'] },
    { title: 'Reports and records', items: ['analytics', 'performance', 'documents', 'compliance', 'audit'] },
    { title: 'Organisation', items: ['team', 'integrations', 'settings'] },
  ],
  LOGISTICS_MGR: [
    INBOX,
    { title: 'Operations', items: ['liveMap', 'sla', 'pod', 'coldChain'] },
    { title: 'Fleet', items: ['carriers', 'trucks', 'drivers', 'fleetStats', 'carbon'] },
    { title: 'Money', items: ['payments', 'rates'] },
    { title: 'Reports and records', items: ['analytics', 'performance', 'documents', 'compliance'] },
    SETTINGS,
  ],
  CARRIER: [
    INBOX,
    { title: 'Work', items: ['jobBoard', 'liveMap', 'pod', 'documents'] },
    SETTINGS,
  ],
  CLIENT: [
    INBOX,
    { title: 'My cargo', items: ['jobBoard', 'liveMap', 'pod'] },
    { title: 'Money', items: ['payments'] },
    { title: 'Records', items: ['documents', 'compliance'] },
    SETTINGS,
  ],
  DISPATCHER: [
    INBOX,
    { title: 'Dispatch', items: ['dispatchQueue', 'routes', 'jobBoard', 'liveMap', 'sla', 'pod'] },
    { title: 'Fleet', items: ['carriers', 'trucks', 'drivers', 'fleetStats'] },
    SETTINGS,
  ],
  CUSTOMS_BROKER: [
    INBOX,
    { title: 'Clearance', items: ['customsQueue', 'customsDocs', 'compliance'] },
    { title: 'Tracking', items: ['liveMap', 'audit'] },
    SETTINGS,
  ],
  WAREHOUSE_MGR: [
    INBOX,
    { title: 'Warehouse', items: ['inventory', 'inbound', 'outbound', 'coldChain', 'pod'] },
    { title: 'Reports and records', items: ['liveMap', 'analytics', 'documents', 'compliance'] },
    SETTINGS,
  ],
  PORT_AGENT: [
    INBOX,
    { title: 'Port', items: ['vessels', 'containers', 'manifests', 'customsDocs'] },
    { title: 'Tracking', items: ['liveMap', 'pod', 'compliance'] },
    SETTINGS,
  ],
  FINANCE_OFFICER: [
    INBOX,
    { title: 'Money', items: ['payments', 'revenue', 'financeReports', 'rates'] },
    { title: 'Reports and records', items: ['analytics', 'carbon', 'pod', 'documents', 'audit'] },
    SETTINGS,
  ],
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:           'Administrator',
  LOGISTICS_MGR:   'Logistics manager',
  CARRIER:         'Carrier',
  CLIENT:          'Client',
  DISPATCHER:      'Dispatcher',
  CUSTOMS_BROKER:  'Customs broker',
  WAREHOUSE_MGR:   'Warehouse manager',
  PORT_AGENT:      'Port agent',
  FINANCE_OFFICER: 'Finance officer',
}

// ── Component ─────────────────────────────────────────────────────────────────

function routeMatch(current: string, navRoute: string): boolean {
  return current.replace(/^\//, '') === navRoute.replace(/^\//, '')
}

/**
 * The side menu: who you are at the top (tap for Account), then the
 * screens for your role in short groups. Rows are plain lines, the
 * current screen in the accent colour; nothing moves.
 */
export default function DrawerContent({ drawerNav }: { drawerNav?: any }) {
  const user = useAuthStore((s) => s.user)
  const insets = useSafeAreaInsets()
  const { colors, brand, isDark } = useAppTheme()
  const currentPath = usePathname()

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || (user.username?.[0] ?? '?').toUpperCase()
    : '?'
  const role = user?.role ?? ''
  const sections = DRAWER_SECTIONS[role] ?? [INBOX, SETTINGS]
  const roleLabel = ROLE_LABELS[role] ?? user?.role_display ?? ''
  const on = isDark ? brand.accent : brand.primary

  function go(route: string) {
    const name = route.replace(/^\//, '')
    if (drawerNav) {
      drawerNav.navigate(name)
      try { drawerNav.closeDrawer() } catch { /* not a drawer navigator */ }
    } else {
      router.push(route as any)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <Pressable
        onPress={() => go('/account')}
        accessibilityRole="button"
        accessibilityLabel="Your account"
        style={({ pressed }) => ({
          backgroundColor: brand.primary,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: 24,
          opacity: pressed ? 0.85 : 1,
        })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: brand.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Txt variant="heading" tone="inverse">{initials}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" tone="inverse" numberOfLines={1}>
              {user ? `${user.first_name} ${user.last_name}`.trim() || user.username : 'Guest'}
            </Txt>
            {roleLabel ? (
              <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2 }} numberOfLines={1}>
                {roleLabel}
              </Txt>
            ) : null}
            {user?.org_name ? (
              <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
                {user.org_name}
              </Txt>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </View>
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        {sections.map((section, si) => (
          <View key={si} style={{ marginTop: si === 0 ? 0 : 20 }}>
            {section.title ? (
              <Txt variant="label" tone="faint" style={{ paddingHorizontal: 24, marginBottom: 4 }}>
                {section.title}
              </Txt>
            ) : null}
            {section.items.map((key) => {
              const item = ITEMS[key]
              const active = routeMatch(currentPath, item.route)
              return (
                <Pressable
                  key={key}
                  onPress={() => go(item.route)}
                  accessibilityRole="button"
                  accessibilityState={active ? { selected: true } : {}}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <Ionicons name={item.icon} size={20} color={active ? on : colors.textMuted} />
                  <Txt variant={active ? 'bodyStrong' : 'body'} style={{ flex: 1, color: active ? on : colors.text }}>
                    {item.label}
                  </Txt>
                </Pressable>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
