import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient, dashboardApi, shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
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
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#f5801e" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Glass greeting header ──────────────────────────────────── */}
        <GlassCard variant="elevated" accentColor="#f5801e" accentPosition="left" className="mt-ct-lg mb-ct-lg">
          <View className="p-ct-lg">
            <View className="flex-row items-center mb-ct-md">
              <LiveDot className="mr-2" />
              <Text className="text-ct-sm font-bold text-ct-text-brand dark:text-slate-300">{greeting}</Text>
            </View>
            <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white tracking-tight">{firstName}</Text>

            {!!data && (
              <View className="flex-row mt-ct-lg gap-2">
                <View className="flex-1 bg-blue-500/15 dark:bg-blue-500/10 rounded-ct-md p-2.5">
                  <Text className="text-[10px] font-bold text-blue-700 dark:text-blue-300">IN TRANSIT</Text>
                  <AnimatedKpiValue value={data.summary.active_shipments} className="text-ct-xl font-extrabold text-blue-800 dark:text-blue-200" />
                </View>
                <View className="flex-1 bg-red-100 dark:bg-red-500/15 rounded-ct-md p-2.5">
                  <Text className="text-[10px] font-bold text-red-700 dark:text-red-300">DELAYED</Text>
                  <AnimatedKpiValue value={data.summary.delayed_shipments} className="text-ct-xl font-extrabold text-red-800 dark:text-red-200" />
                </View>
                <View className="flex-1 bg-orange-100 dark:bg-ct-orange/15 rounded-ct-md p-2.5">
                  <Text className="text-[10px] font-bold text-orange-700 dark:text-orange-300">ALERTS</Text>
                  <AnimatedKpiValue value={data.summary.open_alerts} className="text-ct-xl font-extrabold text-orange-800 dark:text-orange-200" />
                </View>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Loading */}
        {loading && (
          <>
            <Skeleton variant="kpi-glass-row" className="mb-ct-lg" />
            <Skeleton variant="card" className="h-[180px] mb-ct-lg" />
            <Skeleton variant="card" className="h-[220px]" />
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <View className="items-center pt-16 px-6">
            <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
            <Text className="text-ct-base text-ct-text-muted dark:text-slate-300 mt-ct-md text-center leading-5">{error}</Text>
            <TouchableOpacity onPress={() => load()} activeOpacity={0.8} className="mt-5 px-6 py-2.5 bg-ct-orange rounded-ct-md">
              <Text className="text-ct-base font-bold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Data */}
        {!loading && data && (
          <>
            {/* KPI row */}
            <View className="mb-ct-lg">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
                <KpiCard icon="cube" iconColor="#0f2d5e" label="Total Shipments" value={data.summary.total_shipments} />
                <KpiCard icon="navigate" iconColor="#3b82f6" label="In Transit" value={data.summary.active_shipments} className="ml-ct-md" />
                <KpiCard icon="checkmark-circle" iconColor="#10b981" label="Delivered" value={data.summary.delivered_shipments} className="ml-ct-md" />
                <KpiCard icon="warning" iconColor="#ef4444" label="Delayed" value={data.summary.delayed_shipments} className="ml-ct-md" />
                <KpiCard icon="notifications" iconColor="#f59e0b" label="Open Alerts" value={data.summary.open_alerts} className="ml-ct-md" />
              </ScrollView>
            </View>

            {/* On-time + alerts */}
            <GlassCard variant="subtle" className="mb-ct-lg">
              <View className="p-ct-lg">
                <SectionLabel label="On-Time Performance & Alerts" />
                <View className="flex-row items-center mt-2">
                  <OnTimeRing rate={data.summary.on_time_rate} />
                  <View className="flex-1 ml-4">
                    {severityCounts && SEVERITY_ORDER.map((s) => {
                      const c = ALERT_SEVERITY_COLORS[s]
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => router.push('/(tabs)/alerts')}
                          className="flex-row items-center rounded-full px-ct-md py-1.5 mb-1.5 border"
                          style={{ backgroundColor: c.background, borderColor: c.border }}
                          activeOpacity={0.75}
                        >
                          <View className="w-[7px] h-[7px] rounded-full mr-1.5" style={{ backgroundColor: c.dot }} />
                          <Text className="text-ct-xs font-bold" style={{ color: c.text }}>
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
              <GlassCard variant="subtle" className="mb-ct-lg">
                <View className="p-ct-lg">
                  <SectionLabel label="Delay Risk — Top Shipments" />
                  <View className="flex-row mb-2 mt-2">
                    <Text className="w-[110px] text-[10px] text-ct-text-faint dark:text-slate-400">Tracking #</Text>
                    <Text className="flex-1 text-[10px] text-ct-text-faint dark:text-slate-400 mx-2">Risk</Text>
                    <Text className="w-[34px] text-[10px] text-ct-text-faint dark:text-slate-400 text-right">Score</Text>
                  </View>
                  {data.riskItems.map((item) => (
                    <RiskRow key={item.id} id={item.id} trackingNumber={item.tracking_number} score={item.delay_risk_score} />
                  ))}
                </View>
              </GlassCard>
            )}

            {/* Carrier performance */}
            {data.carriers.length > 0 && (
              <GlassCard variant="subtle" className="mb-ct-lg">
                <View className="p-ct-lg">
                  <SectionLabel label="Carrier Performance" />
                  <View className="flex-row mb-1.5 px-2.5 mt-2">
                    <Text className="flex-[2] text-[10px] text-ct-text-faint dark:text-slate-400">Carrier</Text>
                    <Text className="flex-1 text-[10px] text-ct-text-faint dark:text-slate-400 text-center">Ships</Text>
                    <Text className="flex-1 text-[10px] text-ct-text-faint dark:text-slate-400 text-center">Avg Risk</Text>
                    <Text className="flex-1 text-[10px] text-ct-text-faint dark:text-slate-400 text-right">On-Time</Text>
                  </View>
                  {data.carriers.map((c, i) => <CarrierRow key={i} c={c} />)}
                </View>
              </GlassCard>
            )}

            {/* Recent events feed */}
            {data.events.length > 0 && (
              <GlassCard variant="subtle" className="mb-ct-lg">
                <View className="p-ct-lg">
                  <SectionLabel label="Recent Tracking Events" />
                  <View className="mt-2">
                    {data.events.slice(0, 10).map((ev, idx) => {
                      const dotColor = EVENT_DOT[ev.event_type as EventType] ?? '#9ca3af'
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
            <GlassCard variant="subtle" className="mb-ct-lg">
              <View className="p-ct-lg">
                <SectionLabel label="Execution Control" />
                <View className="flex-row gap-2.5 mt-2 mb-ct-md">
                  <View className="flex-1 bg-blue-50 dark:bg-blue-500/10 rounded-ct-md p-ct-md">
                    <Text className="text-ct-xs font-bold text-blue-700 dark:text-blue-300 uppercase">SLA compliance</Text>
                    <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white mt-1">
                      {data.sla ? `${data.sla.compliance_pct}%` : '—'}
                    </Text>
                    <Text className="text-ct-sm text-ct-text-faint dark:text-slate-400 mt-1">
                      {data.sla ? `${data.sla.on_time} on time · ${data.sla.breached} breached` : 'No SLA data'}
                    </Text>
                  </View>
                  <View className="flex-1 bg-lime-50 dark:bg-lime-500/10 rounded-ct-md p-ct-md">
                    <Text className="text-ct-xs font-bold text-lime-700 dark:text-lime-300 uppercase">Fleet utilisation</Text>
                    <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white mt-1">
                      {data.fleet ? `${data.fleet.fleet_utilisation}%` : '—'}
                    </Text>
                    <Text className="text-ct-sm text-lime-600 dark:text-lime-400 mt-1">
                      {data.fleet ? `${data.fleet.trucks_active}/${data.fleet.trucks} trucks active` : 'Unavailable'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row flex-wrap -mx-1">
                  <View className="flex-1 min-w-[46%] bg-slate-50 dark:bg-white/[0.04] rounded-ct-md p-ct-md m-1">
                    <Text className="text-[10px] font-bold text-ct-text-faint dark:text-slate-400 uppercase">Drivers on route</Text>
                    <Text className="text-ct-lg font-extrabold text-ct-text-primary dark:text-white mt-1">{data.fleet?.drivers_on_route ?? '—'}</Text>
                    {data.fleet && <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{data.fleet.drivers} drivers total</Text>}
                  </View>
                  <View className="flex-1 min-w-[46%] bg-slate-50 dark:bg-white/[0.04] rounded-ct-md p-ct-md m-1">
                    <Text className="text-[10px] font-bold text-ct-text-faint dark:text-slate-400 uppercase">At-risk loads</Text>
                    <Text className="text-ct-lg font-extrabold text-ct-text-primary dark:text-white mt-1">{data.sla?.at_risk ?? '—'}</Text>
                    <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">Needs monitoring</Text>
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* Finance & Compliance */}
            <GlassCard variant="subtle" className="mb-ct-lg">
              <View className="p-ct-lg">
                <SectionLabel label="Finance & Compliance" />
                <View className="flex-row gap-2.5 mt-2 mb-ct-md">
                  <View className="flex-1 bg-orange-50 dark:bg-orange-500/10 rounded-ct-md p-ct-md">
                    <Text className="text-ct-xs font-bold text-orange-700 dark:text-orange-300 uppercase">Open invoices</Text>
                    <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white mt-1">
                      {data.invoices.filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length}
                    </Text>
                    <Text className="text-ct-sm text-orange-600 dark:text-orange-300 mt-1">
                      {data.invoices.filter((i) => i.status === 'PAID').length} paid this cycle
                    </Text>
                  </View>
                  <View className="flex-1 bg-red-50 dark:bg-red-500/10 rounded-ct-md p-ct-md">
                    <Text className="text-ct-xs font-bold text-red-700 dark:text-red-300 uppercase">Expiring docs</Text>
                    <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white mt-1">
                      {data.compliance.filter((d) => d.days_until_expiry !== null && d.days_until_expiry <= 14).length}
                    </Text>
                    <Text className="text-ct-sm text-red-600 dark:text-red-300 mt-1">{data.compliance.length} tracked</Text>
                  </View>
                </View>
                {data.invoices.slice(0, 3).map((inv) => (
                  <TouchableOpacity
                    key={inv.id} onPress={() => router.push('/(tabs)/payments')} activeOpacity={0.75}
                    className="flex-row justify-between items-center py-2.5 border-t border-slate-200 dark:border-white/[0.06]"
                  >
                    <View className="flex-1 mr-2.5">
                      <Text className="text-ct-sm font-bold text-ct-text-primary dark:text-white">{inv.invoice_number}</Text>
                      <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{inv.shipment_tracking}</Text>
                    </View>
                    <Text className="text-ct-sm font-bold" style={{ color: inv.status === 'PAID' ? '#4ade80' : '#fb923c' }}>
                      {Number(inv.amount_kes).toLocaleString()} {inv.currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>

            {/* Sustainability & Comms */}
            <GlassCard variant="subtle" className="mb-ct-lg">
              <View className="p-ct-lg">
                <SectionLabel label="Sustainability & Comms" />
                <View className="flex-row gap-2.5 mt-2 mb-ct-md">
                  <View className="flex-1 bg-cyan-50 dark:bg-cyan-500/10 rounded-ct-md p-ct-md">
                    <Text className="text-ct-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase">Net carbon</Text>
                    <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white mt-1">
                      {data.carbon ? `${Math.round(data.carbon.net_kg)} kg` : '—'}
                    </Text>
                    <Text className="text-ct-sm text-cyan-600 dark:text-cyan-400 mt-1">
                      {data.carbon ? `${Math.round(data.carbon.offset_kg)} kg offset` : 'Unavailable'}
                    </Text>
                  </View>
                  <View className="flex-1 bg-purple-50 dark:bg-purple-500/10 rounded-ct-md p-ct-md">
                    <Text className="text-ct-xs font-bold text-purple-700 dark:text-purple-300 uppercase">Unread updates</Text>
                    <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white mt-1">{data.notifications.length}</Text>
                    <Text className="text-ct-sm text-purple-600 dark:text-purple-400 mt-1">Waiting in your inbox</Text>
                  </View>
                </View>
                {data.carbon?.by_carrier?.[0] && (
                  <View className="bg-slate-50 dark:bg-white/[0.04] rounded-ct-md p-ct-md mb-2.5">
                    <Text className="text-ct-xs font-bold text-ct-text-faint dark:text-slate-400 uppercase">Highest emitting carrier</Text>
                    <Text className="text-ct-md font-extrabold text-ct-text-primary dark:text-white mt-1">{data.carbon.by_carrier[0].name}</Text>
                    <Text className="text-ct-sm text-ct-text-faint dark:text-slate-400 mt-0.5">
                      {Math.round(data.carbon.by_carrier[0].total_kg)} kg CO2 · Grade {data.carbon.by_carrier[0].grade}
                    </Text>
                  </View>
                )}
                {data.notifications.slice(0, 3).map((item) => (
                  <TouchableOpacity
                    key={item.id} onPress={() => router.push('/(tabs)/account')} activeOpacity={0.75}
                    className="py-2.5 border-t border-slate-200 dark:border-white/[0.06]"
                  >
                    <Text className="text-ct-sm font-bold text-ct-text-primary dark:text-white">{item.title}</Text>
                    <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5" numberOfLines={2}>{item.message}</Text>
                    <Text className="text-[10px] text-ct-text-faint dark:text-slate-500 mt-1">{timeAgo(item.created_at)}</Text>
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
