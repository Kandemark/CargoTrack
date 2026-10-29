import { useEffect, useState, useCallback, type ComponentProps } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient, dashboardApi, shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { timeAgo } from '@shared/utils/formatters'
import {
  Button,
  HeroStats,
  ListRow,
  ScreenFrame,
  Section,
  Skeleton,
  Stat,
  StatGrid,
  Txt,
} from '@/components/ui'
import type {
  DashboardSummary,
  CarrierPerformance,
  TrackingEvent,
  Alert as AlertType,
  EventType,
  ShipmentListItem,
} from '@shared/api/types'

/**
 * Home. Each fact appears once: three numbers in the header, then what
 * needs action (one line per shipment, whatever the reason), then recent
 * activity, the month's figures and carriers. The shipment list itself
 * lives on the Shipments tab, not here.
 */

const EVENT_ICON: Record<EventType, ComponentProps<typeof Ionicons>['name']> = {
  DEPARTURE: 'navigate-outline',
  CHECKPOINT: 'flag-outline',
  CUSTOMS_ENTRY: 'document-text-outline',
  CUSTOMS_CLEAR: 'checkmark-done-outline',
  ARRIVAL: 'checkmark-circle-outline',
  DELAY: 'time-outline',
  NOTE: 'chatbox-outline',
}

interface PageData {
  summary: DashboardSummary
  shipments: ShipmentListItem[]
  carriers: CarrierPerformance[]
  events: TrackingEvent[]
  riskItems: { id: number; tracking_number: string; delay_risk_score: number }[]
  alerts: AlertType[]
  invoices: Array<{ id: number; invoice_number: string; amount_kes: string; currency: string; status: string; shipment_tracking: string }>
  compliance: Array<{ id: number; tracking_number: string; doc_type_display: string; status_display: string; days_until_expiry: number | null }>
  fleet: { trucks: number; trucks_active: number; drivers: number; drivers_on_route: number; fleet_utilisation: number } | null
  carbon: { total_kg: number; offset_kg: number; net_kg: number; by_carrier: Array<{ name: string; total_kg: number; grade: string }> } | null
  sla: { compliance_pct: number; total: number; on_time: number; at_risk: number; breached: number } | null
}

type AttentionItem = {
  key: string
  icon: ComponentProps<typeof Ionicons>['name']
  color: string
  title: string
  subtitle: string
  onPress: () => void
}

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const { ui, status, brand, colors } = useAppTheme()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)
    try {
      const safeGet = async <T,>(url: string) => {
        try { const res = await apiClient.get<T>(url); return res.data } catch { return null }
      }

      const [statsRes, shipmentsRes, alertsRes, slaData, carbonData, fleetData, invoicesData, complianceData] =
        await Promise.all([
          dashboardApi.getStats(),
          shipmentsApi.list({ page: 1, page_size: 20 }),
          dashboardApi.getAlerts({ all: true }),
          safeGet<any>('/api/v1/sla/'),
          safeGet<any>('/api/v1/carbon/'),
          safeGet<any>('/api/v1/fleet/stats/'),
          safeGet<any>('/api/v1/invoices/?page_size=20'),
          safeGet<any>('/api/v1/compliance/?page_size=20'),
        ])

      const statsData = statsRes.data
      const shipmentsList: ShipmentListItem[] = Array.isArray(shipmentsRes.data)
        ? shipmentsRes.data : (shipmentsRes.data as any).results ?? []

      const riskItems = [...shipmentsList]
        .sort((a, b) => (b.delay_risk_score ?? 0) - (a.delay_risk_score ?? 0))
        .slice(0, 8)
        .map((s) => ({ id: s.id, tracking_number: s.tracking_number, delay_risk_score: s.delay_risk_score ?? 0 }))

      const list = <T,>(d: any): T[] => (Array.isArray(d) ? d : d?.results ?? [])

      setData({
        summary: statsData.summary,
        shipments: shipmentsList,
        carriers: (statsData.carrier_performance ?? []).sort((a, b) => b.avg_risk - a.avg_risk),
        events: statsData.recent_events ?? [],
        riskItems,
        alerts: alertsRes.data.results ?? [],
        invoices: list(invoicesData),
        compliance: list(complianceData),
        fleet: fleetData,
        carbon: carbonData,
        sla: slaData,
      })
    } catch {
      setError('Could not load your dashboard. Check your connection and try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const firstName = user?.first_name || user?.username || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || (user.username?.[0] ?? '?').toUpperCase()
    : '?'

  const avatar = (
    <Pressable onPress={() => router.push('/(drawer)/account' as any)} accessibilityRole="button" accessibilityLabel="Account">
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: brand.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="heading" tone="inverse">{initials}</Txt>
      </View>
    </Pressable>
  )

  const hero = data ? (
    <HeroStats
      items={[
        { label: 'In transit', value: String(data.summary.active_shipments) },
        { label: 'Delivered', value: String(data.summary.delivered_shipments) },
        { label: 'On time', value: `${Math.round(data.summary.on_time_rate)}%` },
      ]}
    />
  ) : null

  return (
    <ScreenFrame
      eyebrow={user?.org_name ? `${greeting} · ${user.org_name}` : greeting}
      title={firstName}
      trailing={avatar}
      hero={hero}
      refreshing={refreshing}
      onRefresh={() => load(true)}>
      {loading ? (
        <View style={{ gap: 16 }}>
          <Skeleton variant="card" style={{ height: 120 }} />
          <Skeleton variant="card" style={{ height: 220 }} />
        </View>
      ) : error || !data ? (
        <View style={{ alignItems: 'center', paddingTop: 40, gap: 16 }}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textFaint} />
          <Txt variant="body" tone="muted" style={{ textAlign: 'center' }}>{error}</Txt>
          <Button variant="primary" onPress={() => load()}>Try again</Button>
        </View>
      ) : (
        <Content data={data} danger={ui.danger} warning={status.customs} />
      )}
    </ScreenFrame>
  )
}

function Content({ data, danger, warning }: { data: PageData; danger: string; warning: string }) {
  const attention = attentionItems(data, danger, warning)
  const openInvoices = data.invoices.filter((i) => i.status === 'PENDING' || i.status === 'FAILED' || i.status === 'OVERDUE')

  return (
    <>
      <Section label="Needs attention">
        {attention.length === 0 ? (
          <ListRow icon="checkmark-circle-outline" iconColor="#16A34A" title="All clear" subtitle="Nothing needs your action right now." last />
        ) : (
          attention.map((a, i) => (
            <ListRow key={a.key} icon={a.icon} iconColor={a.color} title={a.title} subtitle={a.subtitle} onPress={a.onPress} last={i === attention.length - 1} />
          ))
        )}
      </Section>

      {data.events.length > 0 ? (
        <Section label="Recent activity">
          {data.events.slice(0, 5).map((ev, i, all) => (
            <ListRow
              key={ev.id}
              icon={EVENT_ICON[ev.event_type] ?? 'ellipse-outline'}
              title={ev.event_type_display}
              subtitle={`${ev.location} · ${timeAgo(ev.timestamp)}`}
              last={i === all.length - 1}
            />
          ))}
        </Section>
      ) : null}

      <Section label="This month">
        <StatGrid>
          <Stat
            label="SLA met"
            value={data.sla ? `${data.sla.compliance_pct}%` : '—'}
            caption={data.sla ? `${data.sla.on_time} on time · ${data.sla.breached} breached` : 'No SLA data yet'}
            tone={data.sla && data.sla.breached > 0 ? 'danger' : undefined}
          />
          <Stat
            label="Fleet in use"
            value={data.fleet ? `${data.fleet.fleet_utilisation}%` : '—'}
            caption={data.fleet ? `${data.fleet.trucks_active} of ${data.fleet.trucks} trucks` : 'No fleet data yet'}
          />
          <Stat
            label="Open invoices"
            value={String(openInvoices.length)}
            caption={`${data.invoices.filter((i) => i.status === 'PAID').length} paid`}
            tone={openInvoices.length > 0 ? 'warning' : undefined}
          />
          <Stat
            label="Net carbon"
            value={data.carbon ? `${Math.round(data.carbon.net_kg).toLocaleString()} kg` : '—'}
            caption={data.carbon ? `${Math.round(data.carbon.offset_kg).toLocaleString()} kg offset` : 'No data yet'}
          />
        </StatGrid>
      </Section>

      {data.carriers.length > 0 ? (
        <Section label="Carriers">
          {data.carriers.slice(0, 5).map((c, i, all) => (
            <ListRow
              key={c.carrier_name}
              title={c.carrier_name}
              subtitle={`${c.shipment_count} shipments · average delay risk ${Math.round(c.avg_risk * 100)}%`}
              trailing={`${c.on_time} on time`}
              last={i === all.length - 1}
            />
          ))}
        </Section>
      ) : null}
    </>
  )
}

/**
 * Everything that needs action, most urgent first, at most six. A shipment
 * appears once: if it is delayed, its alerts and risk are not repeated.
 */
function attentionItems(data: PageData, danger: string, warning: string): AttentionItem[] {
  const items: AttentionItem[] = []
  const seen = new Set<string>()
  for (const s of data.shipments.filter((x) => x.status === 'DELAYED')) {
    seen.add(s.tracking_number)
    items.push({
      key: `delayed-${s.id}`,
      icon: 'time-outline',
      color: danger,
      title: `Delayed · ${s.route.origin} → ${s.route.destination}`,
      subtitle: `${s.tracking_number} · ${s.carrier_name || 'No carrier yet'}`,
      onPress: () => router.push(`/(drawer)/shipment/${s.id}` as any),
    })
  }
  for (const a of data.alerts.filter((x) => !x.acknowledged && (x.severity === 'CRITICAL' || x.severity === 'HIGH'))) {
    if (seen.has(a.shipment_tracking)) continue
    seen.add(a.shipment_tracking)
    items.push({
      key: `alert-${a.id}`,
      icon: a.severity === 'CRITICAL' ? 'flame-outline' : 'warning-outline',
      color: danger,
      title: a.title || `${a.severity_display} alert`,
      subtitle: `${a.shipment_tracking} · ${a.message}`,
      onPress: () => router.push('/(drawer)/(tabs)/alerts' as any),
    })
  }
  for (const r of data.riskItems.filter((x) => x.delay_risk_score >= 0.7 && !seen.has(x.tracking_number))) {
    seen.add(r.tracking_number)
    items.push({
      key: `risk-${r.id}`,
      icon: 'trending-up-outline',
      color: danger,
      title: `High delay risk · ${r.tracking_number}`,
      subtitle: `${Math.round(r.delay_risk_score * 100)}% likely to arrive late`,
      onPress: () => router.push(`/(drawer)/shipment/${r.id}` as any),
    })
  }
  for (const d of data.compliance.filter((x) => x.days_until_expiry !== null && x.days_until_expiry <= 14)) {
    items.push({
      key: `doc-${d.id}`,
      icon: 'document-outline',
      color: warning,
      title: `${d.doc_type_display} expires ${d.days_until_expiry! <= 0 ? 'today' : `in ${d.days_until_expiry} days`}`,
      subtitle: d.tracking_number,
      onPress: () => router.push('/(drawer)/compliance' as any),
    })
  }
  for (const inv of data.invoices.filter((x) => x.status === 'FAILED' || x.status === 'OVERDUE')) {
    items.push({
      key: `inv-${inv.id}`,
      icon: 'card-outline',
      color: warning,
      title: `${inv.status === 'FAILED' ? 'Payment failed' : 'Overdue'} · ${inv.invoice_number}`,
      subtitle: `${Number(inv.amount_kes).toLocaleString()} ${inv.currency} · ${inv.shipment_tracking}`,
      onPress: () => router.push('/(drawer)/payments' as any),
    })
  }
  return items.slice(0, 6)
}

