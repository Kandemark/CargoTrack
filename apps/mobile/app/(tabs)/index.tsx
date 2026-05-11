import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Dimensions, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient, dashboardApi, shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
import { timeAgo } from '@shared/utils/formatters'
import {
  GlassCard,
  KpiCard,
  SectionLabel,
  Skeleton,
  TimelineEvent,
} from '@/components/ui'
import OnTimeRing from '@/components/OnTimeRing'
import RiskRow from '@/components/RiskRow'
import CarrierRow from '@/components/CarrierRow'
import LiveDot from '@/components/LiveDot'
import AnimatedKpiValue from '@/components/AnimatedKpiValue'
import type {
  DashboardSummary,
  CarrierPerformance,
  TrackingEvent,
  Alert as AlertType,
  AlertSeverity,
  EventType,
} from '@shared/api/types'

const { width: SCREEN_W } = Dimensions.get('window')

const EVENT_DOT: Record<EventType, string> = {
  DEPARTURE: '#3b82f6', CHECKPOINT: '#6b7280', CUSTOMS_ENTRY: '#f59e0b',
  CUSTOMS_CLEAR: '#f59e0b', ARRIVAL: '#10b981', DELAY: '#ef4444', NOTE: '#9ca3af',
}
const SEVERITY_ORDER: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

interface PageData {
  summary: DashboardSummary
  carriers: CarrierPerformance[]
  events: TrackingEvent[]
  riskItems: { id: number; tracking_number: string; delay_risk_score: number }[]
  alerts: AlertType[]
  invoices: Array<{ id: number; invoice_number: string; amount_kes: string; currency: string; status: string; shipment_tracking: string }>
  compliance: Array<{ id: number; tracking_number: string; doc_type_display: string; status_display: string; days_until_expiry: number | null }>
  notifications: Array<{ id: number; title: string; message: string; created_at: string; is_read: boolean }>
  fleet: { trucks: number; trucks_active: number; drivers: number; drivers_on_route: number; fleet_utilisation: number } | null
  carbon: { total_kg: number; offset_kg: number; net_kg: number; by_carrier: Array<{ name: string; total_kg: number; grade: string }> } | null
  sla: { compliance_pct: number; total: number; on_time: number; at_risk: number; breached: number } | null
}

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const { colors, font, spacing, radius, isDark } = useAppTheme()
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

      const [statsRes, shipmentsRes, alertsRes, slaData, carbonData, fleetData, invoicesData, complianceData, notificationsData] =
        await Promise.all([
          dashboardApi.getStats(),
          shipmentsApi.list({ page: 1, page_size: 20 }),
          dashboardApi.getAlerts({ all: true }),
          safeGet<any>('/api/v1/sla/'),
          safeGet<any>('/api/v1/carbon/'),
          safeGet<any>('/api/v1/fleet/stats/'),
          safeGet<any>('/api/v1/invoices/?page_size=20'),
          safeGet<any>('/api/v1/compliance/?page_size=20'),
          safeGet<any>('/api/v1/notifications/?unread=1&page_size=8'),
        ])

      const statsData = statsRes.data
      const shipmentsList = Array.isArray(shipmentsRes.data)
        ? shipmentsRes.data : (shipmentsRes.data as any).results ?? []

      const riskItems = [...shipmentsList]
        .sort((a, b) => (b.delay_risk_score ?? 0) - (a.delay_risk_score ?? 0))
        .slice(0, 8)
        .map((s) => ({ id: s.id, tracking_number: s.tracking_number, delay_risk_score: s.delay_risk_score ?? 0 }))

      const alertsList: AlertType[] = alertsRes.data.results ?? []
      const invoiceList = Array.isArray(invoicesData) ? invoicesData : invoicesData?.results ?? []
      const complianceList = Array.isArray(complianceData) ? complianceData : complianceData?.results ?? []
      const notificationList = Array.isArray(notificationsData) ? notificationsData : notificationsData?.results ?? []

      setData({
        summary: statsData.summary,
        carriers: (statsData.carrier_performance ?? []).sort((a, b) => b.avg_risk - a.avg_risk),
        events: statsData.recent_events ?? [],
        riskItems,
        alerts: alertsList,
        invoices: invoiceList,
        compliance: complianceList,
        notifications: notificationList,
        fleet: fleetData,
        carbon: carbonData,
        sla: slaData,
      })
    } catch {
      setError('Failed to load dashboard. Pull down to retry.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const firstName = user?.first_name || user?.username || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const severityCounts = data
    ? SEVERITY_ORDER.reduce<Record<AlertSeverity, number>>((acc, s) => {
        acc[s] = data.alerts.filter((a) => a.severity === s).length; return acc
      }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 })
    : null

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={s.flex1}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#f5801e" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Glass greeting header ──────────────────────────────────── */}
        <GlassCard variant="elevated" accentColor="#f5801e" accentPosition="left" style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ padding: spacing.lg }}>
            <View style={[s.row, { marginBottom: spacing.md }]}>
              <LiveDot style={{ marginRight: 8 }} />
              <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textBrand }}>{greeting}</Text>
            </View>
            <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, letterSpacing: -0.25 }}>{firstName}</Text>

            {!!data && (
              <View style={[s.row, { marginTop: spacing.lg, gap: 8 }]}>
                <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)', borderRadius: radius.md, padding: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: isDark ? '#93c5fd' : '#1d4ed8' }}>IN TRANSIT</Text>
                  <AnimatedKpiValue value={data.summary.active_shipments} style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: isDark ? '#bfdbfe' : '#1e40af' }} />
                </View>
                <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', borderRadius: radius.md, padding: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: isDark ? '#fca5a5' : '#b91c1c' }}>DELAYED</Text>
                  <AnimatedKpiValue value={data.summary.delayed_shipments} style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: isDark ? '#fecaca' : '#991b1b' }} />
                </View>
                <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(245,128,30,0.15)' : '#ffedd5', borderRadius: radius.md, padding: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: isDark ? '#fdba74' : '#c2410c' }}>ALERTS</Text>
                  <AnimatedKpiValue value={data.summary.open_alerts} style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: isDark ? '#fed7aa' : '#9a3412' }} />
                </View>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Loading */}
        {loading && (
          <>
            <Skeleton variant="kpi-glass-row" style={{ marginBottom: spacing.lg }} />
            <Skeleton variant="card" style={{ height: 180, marginBottom: spacing.lg }} />
            <Skeleton variant="card" style={{ height: 220 }} />
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={[s.center, { paddingTop: 64, paddingHorizontal: 24 }]}>
            <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
            <Text style={{ fontSize: font.size.base, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center', lineHeight: 20 }}>{error}</Text>
            <TouchableOpacity onPress={() => load()} activeOpacity={0.8} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#f5801e', borderRadius: radius.md }}>
              <Text style={{ fontSize: font.size.base, fontWeight: font.weight.bold, color: '#ffffff' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Data */}
        {!loading && data && (
          <>
            {/* KPI row */}
            <View style={{ marginBottom: spacing.lg }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -(spacing.lg) }} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                <KpiCard icon="cube" iconColor="#0f2d5e" label="Total Shipments" value={data.summary.total_shipments} />
                <KpiCard icon="navigate" iconColor="#3b82f6" label="In Transit" value={data.summary.active_shipments} style={{ marginLeft: spacing.md }} />
                <KpiCard icon="checkmark-circle" iconColor="#10b981" label="Delivered" value={data.summary.delivered_shipments} style={{ marginLeft: spacing.md }} />
                <KpiCard icon="warning" iconColor="#ef4444" label="Delayed" value={data.summary.delayed_shipments} style={{ marginLeft: spacing.md }} />
                <KpiCard icon="notifications" iconColor="#f59e0b" label="Open Alerts" value={data.summary.open_alerts} style={{ marginLeft: spacing.md }} />
              </ScrollView>
            </View>

            {/* On-time + alerts */}
            <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
              <View style={{ padding: spacing.lg }}>
                <SectionLabel label="On-Time Performance & Alerts" />
                <View style={[s.row, { marginTop: 8 }]}>
                  <OnTimeRing rate={data.summary.on_time_rate} />
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    {severityCounts && SEVERITY_ORDER.map((s) => {
                      const c = ALERT_SEVERITY_COLORS[s]
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => router.push('/(tabs)/alerts')}
                          style={[
                            { flexDirection: 'row', alignItems: 'center' },
                            { borderRadius: 9999, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: 6, borderWidth: 1 },
                            { backgroundColor: c.background, borderColor: c.border },
                          ]}
                          activeOpacity={0.75}
                        >
                          <View style={{ width: 7, height: 7, borderRadius: 9999, marginRight: 6, backgroundColor: c.dot }} />
                          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: c.text }}>
                            {s.charAt(0) + s.slice(1).toLowerCase()} · {severityCounts[s]}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* Risk heatmap */}
            {data.riskItems.length > 0 && (
              <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
                <View style={{ padding: spacing.lg }}>
                  <SectionLabel label="Delay Risk — Top Shipments" />
                  <View style={[s.row, { marginBottom: 8, marginTop: 8 }]}>
                    <Text style={{ width: 110, fontSize: 10, color: colors.textFaint }}>Tracking #</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: colors.textFaint, marginHorizontal: 8 }}>Risk</Text>
                    <Text style={{ width: 34, fontSize: 10, color: colors.textFaint, textAlign: 'right' }}>Score</Text>
                  </View>
                  {data.riskItems.map((item) => (
                    <RiskRow key={item.id} id={item.id} trackingNumber={item.tracking_number} score={item.delay_risk_score} />
                  ))}
                </View>
              </GlassCard>
            )}

            {/* Carrier performance */}
            {data.carriers.length > 0 && (
              <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
                <View style={{ padding: spacing.lg }}>
                  <SectionLabel label="Carrier Performance" />
                  <View style={[s.row, { marginBottom: 6, paddingHorizontal: 10, marginTop: 8 }]}>
                    <Text style={{ flex: 2, fontSize: 10, color: colors.textFaint }}>Carrier</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: colors.textFaint, textAlign: 'center' }}>Ships</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: colors.textFaint, textAlign: 'center' }}>Avg Risk</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: colors.textFaint, textAlign: 'right' }}>On-Time</Text>
                  </View>
                  {data.carriers.map((c, i) => <CarrierRow key={i} c={c} />)}
                </View>
              </GlassCard>
            )}

            {/* Recent events feed */}
            {data.events.length > 0 && (
              <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
                <View style={{ padding: spacing.lg }}>
                  <SectionLabel label="Recent Tracking Events" />
                  <View style={{ marginTop: 8 }}>
                    {data.events.slice(0, 10).map((ev, idx) => {
                      const isLast = idx === Math.min(data.events.length, 10) - 1
                      return (
                        <TimelineEvent
                          key={ev.id}
                          label={ev.event_type_display}
                          sublabel={ev.location}
                          timestamp={timeAgo(ev.timestamp)}
                          variant="completed"
                          isLast={isLast}
                        />
                      )
                    })}
                  </View>
                </View>
              </GlassCard>
            )}

            {/* SLA + Fleet */}
            <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
              <View style={{ padding: spacing.lg }}>
                <SectionLabel label="Execution Control" />
                <View style={[s.row, { gap: 10, marginTop: 8, marginBottom: spacing.md }]}>
                  <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#93c5fd' : '#1d4ed8', textTransform: 'uppercase' }}>SLA compliance</Text>
                    <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>
                      {data.sla ? `${data.sla.compliance_pct}%` : '—'}
                    </Text>
                    <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 4 }}>
                      {data.sla ? `${data.sla.on_time} on time · ${data.sla.breached} breached` : 'No SLA data'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(132,204,22,0.1)' : '#f7fee7', borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#bef264' : '#4d7c0f', textTransform: 'uppercase' }}>Fleet utilisation</Text>
                    <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>
                      {data.fleet ? `${data.fleet.fleet_utilisation}%` : '—'}
                    </Text>
                    <Text style={{ fontSize: font.size.sm, color: isDark ? '#a3e635' : '#65a30d', marginTop: 4 }}>
                      {data.fleet ? `${data.fleet.trucks_active}/${data.fleet.trucks} trucks active` : 'Unavailable'}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                  <View style={{ flex: 1, minWidth: '46%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: radius.md, padding: spacing.md, margin: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: colors.textFaint, textTransform: 'uppercase' }}>Drivers on route</Text>
                    <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>{data.fleet?.drivers_on_route ?? '—'}</Text>
                    {data.fleet && <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{data.fleet.drivers} drivers total</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: '46%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: radius.md, padding: spacing.md, margin: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: colors.textFaint, textTransform: 'uppercase' }}>At-risk loads</Text>
                    <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>{data.sla?.at_risk ?? '—'}</Text>
                    <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>Needs monitoring</Text>
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* Finance & Compliance */}
            <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
              <View style={{ padding: spacing.lg }}>
                <SectionLabel label="Finance & Compliance" />
                <View style={[s.row, { gap: 10, marginTop: 8, marginBottom: spacing.md }]}>
                  <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(249,115,22,0.1)' : '#fff7ed', borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#fdba74' : '#c2410c', textTransform: 'uppercase' }}>Open invoices</Text>
                    <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>
                      {data.invoices.filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length}
                    </Text>
                    <Text style={{ fontSize: font.size.sm, color: isDark ? '#fdba74' : '#c2410c', marginTop: 4 }}>
                      {data.invoices.filter((i) => i.status === 'PAID').length} paid this cycle
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#fca5a5' : '#b91c1c', textTransform: 'uppercase' }}>Expiring docs</Text>
                    <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>
                      {data.compliance.filter((d) => d.days_until_expiry !== null && d.days_until_expiry <= 14).length}
                    </Text>
                    <Text style={{ fontSize: font.size.sm, color: isDark ? '#fca5a5' : '#dc2626', marginTop: 4 }}>{data.compliance.length} tracked</Text>
                  </View>
                </View>
                {data.invoices.slice(0, 3).map((inv) => (
                  <TouchableOpacity
                    key={inv.id} onPress={() => router.push('/(tabs)/payments')} activeOpacity={0.75}
                    style={[s.rowSpaceBetween, { paddingVertical: 10, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }]}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text }}>{inv.invoice_number}</Text>
                      <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{inv.shipment_tracking}</Text>
                    </View>
                    <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: inv.status === 'PAID' ? '#4ade80' : '#fb923c' }}>
                      {Number(inv.amount_kes).toLocaleString()} {inv.currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>

            {/* Sustainability & Comms */}
            <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
              <View style={{ padding: spacing.lg }}>
                <SectionLabel label="Sustainability & Comms" />
                <View style={[s.row, { gap: 10, marginTop: 8, marginBottom: spacing.md }]}>
                  <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(6,182,212,0.1)' : '#ecfeff', borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#67e8f9' : '#0e7490', textTransform: 'uppercase' }}>Net carbon</Text>
                    <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>
                      {data.carbon ? `${Math.round(data.carbon.net_kg)} kg` : '—'}
                    </Text>
                    <Text style={{ fontSize: font.size.sm, color: isDark ? '#22d3ee' : '#0891b2', marginTop: 4 }}>
                      {data.carbon ? `${Math.round(data.carbon.offset_kg)} kg offset` : 'Unavailable'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : '#faf5ff', borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#d8b4fe' : '#7e22ce', textTransform: 'uppercase' }}>Unread updates</Text>
                    <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>{data.notifications.length}</Text>
                    <Text style={{ fontSize: font.size.sm, color: isDark ? '#c084fc' : '#9333ea', marginTop: 4 }}>Waiting in your inbox</Text>
                  </View>
                </View>
                {data.carbon?.by_carrier?.[0] && (
                  <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: radius.md, padding: spacing.md, marginBottom: 10 }}>
                    <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: colors.textFaint, textTransform: 'uppercase' }}>Highest emitting carrier</Text>
                    <Text style={{ fontSize: font.size.md, fontWeight: font.weight.extrabold, color: colors.text, marginTop: 4 }}>{data.carbon.by_carrier[0].name}</Text>
                    <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 2 }}>
                      {Math.round(data.carbon.by_carrier[0].total_kg)} kg CO2 · Grade {data.carbon.by_carrier[0].grade}
                    </Text>
                  </View>
                )}
                {data.notifications.slice(0, 3).map((item) => (
                  <TouchableOpacity
                    key={item.id} onPress={() => router.push('/(tabs)/account')} activeOpacity={0.75}
                    style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}
                  >
                    <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text }}>{item.title}</Text>
                    <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }} numberOfLines={2}>{item.message}</Text>
                    <Text style={{ fontSize: 10, color: isDark ? '#64748b' : colors.textFaint, marginTop: 4 }}>{timeAgo(item.created_at)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/** Reusable static layout styles (no theme-dependent values) */
const s = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowSpaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center' },
})
