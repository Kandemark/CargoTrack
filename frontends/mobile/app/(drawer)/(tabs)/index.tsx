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
const SEVERITY_ICONS: Record<AlertSeverity, React.ComponentProps<typeof Ionicons>['name']> = {
  CRITICAL: 'flame-outline', HIGH: 'warning-outline', MEDIUM: 'alert-circle-outline', LOW: 'information-circle-outline',
}

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
  const { colors, font, spacing, radius, brand, isDark } = useAppTheme()
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

  const role = user?.role ?? ''
  const roleColor = brand.primary
  const initials = user ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || (user.username?.[0] ?? '?').toUpperCase() : '?'

  const severityCounts = data
    ? SEVERITY_ORDER.reduce<Record<AlertSeverity, number>>((acc, s) => {
        acc[s] = data.alerts.filter((a) => a.severity === s).length; return acc
      }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 })
    : null

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0a1929' : '#F1F5F9' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          style={s.flex1}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#f5801e" />}
          showsVerticalScrollIndicator={false}
        >
          {/* ═══ HERO SECTION ═══ */}
          <View style={s.hero}>
            {/* Decorative rings (like login screen) */}
            <View style={[s.ring, { width: 280, height: 280, borderRadius: 140, top: -80, right: -80 }]} />
            <View style={[s.ring, { width: 180, height: 180, borderRadius: 90, top: 20, right: 60 }]} />

            {/* Greeting row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroGreeting}>{greeting}</Text>
                <Text style={s.heroName}>{firstName}</Text>
                {user?.org_name ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="business-outline" size={12} color="rgba(255,255,255,0.5)" />
                    <Text style={s.heroOrg}>{user.org_name}</Text>
                  </View>
                ) : null}
              </View>
              {/* Role badge + initials */}
              <View style={{ alignItems: 'center' }}>
                <View style={[s.avatarCircle, { backgroundColor: '#f5801e' }]}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
                <View style={[s.roleBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={s.roleBadgeText}>{role.replace(/_/g, ' ')}</Text>
                </View>
              </View>
            </View>

            {/* Mini KPI strip */}
            {data && (
              <View style={s.heroKpiRow}>
                <View style={s.heroKpi}>
                  <AnimatedKpiValue value={data.summary.active_shipments} style={s.heroKpiVal} />
                  <Text style={s.heroKpiLabel}>In Transit</Text>
                </View>
                <View style={[s.heroKpiDivider]} />
                <View style={s.heroKpi}>
                  <AnimatedKpiValue value={data.summary.delayed_shipments} style={[s.heroKpiVal, { color: '#fca5a5' }]} />
                  <Text style={s.heroKpiLabel}>Delayed</Text>
                </View>
                <View style={[s.heroKpiDivider]} />
                <View style={s.heroKpi}>
                  <AnimatedKpiValue value={data.summary.on_time_rate} suffix="%" style={s.heroKpiVal} />
                  <Text style={s.heroKpiLabel}>On-Time</Text>
                </View>
                <View style={[s.heroKpiDivider]} />
                <View style={s.heroKpi}>
                  <AnimatedKpiValue value={data.summary.open_alerts} style={[s.heroKpiVal, { color: '#fdba74' }]} />
                  <Text style={s.heroKpiLabel}>Alerts</Text>
                </View>
              </View>
            )}
          </View>

          {/* ═══ CONTENT CARD (overlaps hero) ═══ */}
          <View style={[s.contentCard, {
            backgroundColor: isDark ? '#0d1b2e' : '#F1F5F9',
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            marginTop: -22,
          }]}>

            {/* Loading state */}
            {loading && (
              <View style={{ padding: spacing.lg }}>
                <Skeleton variant="kpi-glass-row" style={{ marginBottom: spacing.lg }} />
                <Skeleton variant="card" style={{ height: 180, marginBottom: spacing.lg }} />
                <Skeleton variant="card" style={{ height: 220 }} />
              </View>
            )}

            {/* Error state */}
            {!loading && error && (
              <View style={[s.center, { paddingTop: 64, paddingHorizontal: 24 }]}>
                <View style={[s.emptyIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
                  <Ionicons name="cloud-offline-outline" size={40} color="#94a3b8" />
                </View>
                <Text style={{ fontSize: font.size.base, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }}>{error}</Text>
                <TouchableOpacity onPress={() => load()} activeOpacity={0.8} style={s.retryBtn}>
                  <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: font.size.sm, fontWeight: '700', color: '#fff' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Data sections */}
            {!loading && data && (
              <View style={{ padding: spacing.lg }}>

                {/* KPI row */}
                <View style={{ marginBottom: spacing.lg }}>
                  <SectionLabel label="Overview" style={{ marginBottom: spacing.md }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                    <KpiCard icon="cube" iconColor={brand.primary} label="Total Shipments" value={data.summary.total_shipments} />
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
                    <View style={[s.row, { marginTop: 12 }]}>
                      <OnTimeRing rate={data.summary.on_time_rate} />
                      <View style={{ flex: 1, marginLeft: 16 }}>
                        {severityCounts && SEVERITY_ORDER.map((s) => {
                          const c = ALERT_SEVERITY_COLORS[s]
                          return (
                            <TouchableOpacity
                              key={s}
                              onPress={() => router.push('/(tabs)/alerts' as any)}
                              style={[
                                { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, paddingHorizontal: spacing.md, paddingVertical: 7, marginBottom: 6, borderWidth: 1 },
                                { backgroundColor: c.background, borderColor: c.border },
                              ]}
                              activeOpacity={0.75}
                            >
                              <Ionicons name={SEVERITY_ICONS[s]} size={12} color={c.dot} style={{ marginRight: 6 }} />
                              <Text style={{ fontSize: font.size.xs, fontWeight: '700', color: c.text, flex: 1 }}>
                                {s.charAt(0) + s.slice(1).toLowerCase()}
                              </Text>
                              <Text style={{ fontSize: font.size.xs, fontWeight: '800', color: c.text }}>{severityCounts[s]}</Text>
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
                      <View style={[s.row, { marginBottom: 8, marginTop: 12 }]}>
                        <Text style={{ width: 110, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tracking #</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 8 }}>Risk</Text>
                        <Text style={{ width: 34, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Score</Text>
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
                      <View style={[s.row, { marginBottom: 8, paddingHorizontal: 10, marginTop: 12 }]}>
                        <Text style={{ flex: 2, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Carrier</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Ships</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Avg Risk</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>On-Time</Text>
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
                      <View style={{ marginTop: 12 }}>
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
                    <View style={[s.row, { gap: 10, marginTop: 12, marginBottom: spacing.md }]}>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={[s.metricLabel, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>SLA compliance</Text>
                        <Text style={[s.metricValue, { color: colors.text }]}>{data.sla ? `${data.sla.compliance_pct}%` : '—'}</Text>
                        <Text style={[s.metricSub, { color: colors.textFaint }]}>
                          {data.sla ? `${data.sla.on_time} on time · ${data.sla.breached} breached` : 'No SLA data'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(132,204,22,0.1)' : '#f7fee7', borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={[s.metricLabel, { color: isDark ? '#bef264' : '#4d7c0f' }]}>Fleet utilisation</Text>
                        <Text style={[s.metricValue, { color: colors.text }]}>{data.fleet ? `${data.fleet.fleet_utilisation}%` : '—'}</Text>
                        <Text style={[s.metricSub, { color: isDark ? '#a3e635' : '#65a30d' }]}>
                          {data.fleet ? `${data.fleet.trucks_active}/${data.fleet.trucks} trucks active` : 'Unavailable'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                      <View style={[s.subMetricCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }]}>
                        <Text style={[s.metricLabel, { color: colors.textFaint }]}>Drivers on route</Text>
                        <Text style={[s.metricValue, { color: colors.text, fontSize: font.size.lg }]}>{data.fleet?.drivers_on_route ?? '—'}</Text>
                        {data.fleet && <Text style={[s.metricSub, { color: colors.textFaint }]}>{data.fleet.drivers} drivers total</Text>}
                      </View>
                      <View style={[s.subMetricCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }]}>
                        <Text style={[s.metricLabel, { color: colors.textFaint }]}>At-risk loads</Text>
                        <Text style={[s.metricValue, { color: colors.text, fontSize: font.size.lg }]}>{data.sla?.at_risk ?? '—'}</Text>
                        <Text style={[s.metricSub, { color: colors.textFaint }]}>Needs monitoring</Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>

                {/* Finance & Compliance */}
                <GlassCard variant="subtle" style={{ marginBottom: spacing.lg }}>
                  <View style={{ padding: spacing.lg }}>
                    <SectionLabel label="Finance & Compliance" />
                    <View style={[s.row, { gap: 10, marginTop: 12, marginBottom: spacing.md }]}>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(249,115,22,0.1)' : '#fff7ed', borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={[s.metricLabel, { color: isDark ? '#fdba74' : '#c2410c' }]}>Open invoices</Text>
                        <Text style={[s.metricValue, { color: colors.text }]}>{data.invoices.filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length}</Text>
                        <Text style={[s.metricSub, { color: isDark ? '#fdba74' : '#c2410c' }]}>{data.invoices.filter((i) => i.status === 'PAID').length} paid this cycle</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={[s.metricLabel, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>Expiring docs</Text>
                        <Text style={[s.metricValue, { color: colors.text }]}>{data.compliance.filter((d) => d.days_until_expiry !== null && d.days_until_expiry <= 14).length}</Text>
                        <Text style={[s.metricSub, { color: isDark ? '#fca5a5' : '#dc2626' }]}>{data.compliance.length} tracked</Text>
                      </View>
                    </View>
                    {data.invoices.slice(0, 3).map((inv) => (
                      <TouchableOpacity
                        key={inv.id} onPress={() => router.push('/(tabs)/payments' as any)} activeOpacity={0.75}
                        style={[s.rowSpaceBetween, { paddingVertical: 10, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }]}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ fontSize: font.size.sm, fontWeight: '700', color: colors.text }}>{inv.invoice_number}</Text>
                          <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{inv.shipment_tracking}</Text>
                        </View>
                        <Text style={{ fontSize: font.size.sm, fontWeight: '700', color: inv.status === 'PAID' ? '#4ade80' : '#fb923c' }}>
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
                    <View style={[s.row, { gap: 10, marginTop: 12, marginBottom: spacing.md }]}>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(6,182,212,0.1)' : '#ecfeff', borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={[s.metricLabel, { color: isDark ? '#67e8f9' : '#0e7490' }]}>Net carbon</Text>
                        <Text style={[s.metricValue, { color: colors.text }]}>{data.carbon ? `${Math.round(data.carbon.net_kg)} kg` : '—'}</Text>
                        <Text style={[s.metricSub, { color: isDark ? '#22d3ee' : '#0891b2' }]}>
                          {data.carbon ? `${Math.round(data.carbon.offset_kg)} kg offset` : 'Unavailable'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : '#faf5ff', borderRadius: radius.md, padding: spacing.md }}>
                        <Text style={[s.metricLabel, { color: isDark ? '#d8b4fe' : '#7e22ce' }]}>Unread updates</Text>
                        <Text style={[s.metricValue, { color: colors.text }]}>{data.notifications.length}</Text>
                        <Text style={[s.metricSub, { color: isDark ? '#c084fc' : '#9333ea' }]}>Waiting in your inbox</Text>
                      </View>
                    </View>
                    {data.carbon?.by_carrier?.[0] && (
                      <View style={[s.highlightRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }]}>
                        <Text style={[s.metricLabel, { color: colors.textFaint }]}>Highest emitting carrier</Text>
                        <Text style={{ fontSize: font.size.md, fontWeight: '800', color: colors.text, marginTop: 4 }}>{data.carbon.by_carrier[0].name}</Text>
                        <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 2 }}>
                          {Math.round(data.carbon.by_carrier[0].total_kg)} kg CO2 · Grade {data.carbon.by_carrier[0].grade}
                        </Text>
                      </View>
                    )}
                    {data.notifications.slice(0, 3).map((item) => (
                      <TouchableOpacity
                        key={item.id} onPress={() => router.push('/notifications' as any)} activeOpacity={0.75}
                        style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}
                      >
                        <Text style={{ fontSize: font.size.sm, fontWeight: '700', color: colors.text }}>{item.title}</Text>
                        <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }} numberOfLines={2}>{item.message}</Text>
                        <Text style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginTop: 4 }}>{timeAgo(item.created_at)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </GlassCard>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowSpaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center' },

  // ── Hero ──
  hero: {
    backgroundColor: '#0f2d5e',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroGreeting: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroOrg: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5801e',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  roleBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  heroKpiRow: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
  },
  heroKpi: {
    flex: 1,
    alignItems: 'center',
  },
  heroKpiVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  heroKpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroKpiDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 4,
  },

  // ── Content card ──
  contentCard: {
    flex: 1,
    minHeight: 400,
  },

  // ── Shared metric styles ──
  metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 22, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] as any },
  metricSub: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  subMetricCard: { flex: 1, minWidth: '46%', borderRadius: 10, padding: 12, margin: 4 },
  highlightRow: { borderRadius: 10, padding: 12, marginBottom: 10 },

  // ── Empty / error ──
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#f5801e',
    borderRadius: 10,
  },
})
