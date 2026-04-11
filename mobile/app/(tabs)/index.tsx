import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle, Path } from 'react-native-svg'
import { dashboardApi, shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { riskLevel, ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
import { timeAgo } from '@shared/utils/formatters'
import type {
  DashboardSummary,
  CarrierPerformance,
  TrackingEvent,
  Alert as AlertType,
  AlertSeverity,
  EventType,
} from '@shared/api/types'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ w, h, radius = 8 }: { w: number | string; h: number; radius?: number }) {
  return (
    <View
      style={{
        width: w as number,
        height: h,
        borderRadius: radius,
        backgroundColor: '#e2e8f0',
      }}
    />
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, accent, iconName,
}: {
  label: string
  value: string | number
  accent: string
  iconName: React.ComponentProps<typeof Ionicons>['name']
}) {
  return (
    <View
      style={{
        width: 130,
        marginRight: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${accent}22`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <Ionicons name={iconName} size={17} color={accent} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{label}</Text>
    </View>
  )
}

// ─── On-time ring ─────────────────────────────────────────────────────────────

function OnTimeRing({ rate }: { rate: number }) {
  const size    = 120
  const stroke  = 10
  const r       = (size - stroke) / 2
  const circ    = 2 * Math.PI * r
  const pct     = Math.min(Math.max(rate, 0), 100)
  const dash    = (pct / 100) * circ
  const color   = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="#e5e7eb" strokeWidth={stroke} fill="none"
        />
        {/* Arc — rotate -90° so 0% starts at top */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color, letterSpacing: -1 }}>
          {pct.toFixed(1)}%
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>On-Time Rate</Text>
    </View>
  )
}

// ─── Risk bar row ─────────────────────────────────────────────────────────────

function RiskRow({
  id, trackingNumber, score,
}: {
  id: number; trackingNumber: string; score: number
}) {
  const risk = riskLevel(score)
  const pct  = Math.round(score * 100)
  return (
    <TouchableOpacity
      onPress={() => router.push(`/shipment/${id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 11, color: '#374151', width: 110, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {trackingNumber}
      </Text>
      <View style={{ flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginHorizontal: 8 }}>
        <View style={{ width: `${pct}%`, height: 6, backgroundColor: risk.color, borderRadius: 3 }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: risk.color, width: 34, textAlign: 'right' }}>
        {pct}%
      </Text>
    </TouchableOpacity>
  )
}

// ─── Carrier row ──────────────────────────────────────────────────────────────

function CarrierRow({ c }: { c: CarrierPerformance }) {
  const highRisk = c.avg_risk > 0.5
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: highRisk ? '#fef2f2' : 'transparent',
        marginBottom: 2,
      }}
    >
      <Text style={{ flex: 2, fontSize: 12, color: '#111827', fontWeight: '600' }} numberOfLines={1}>
        {c.carrier_name}
      </Text>
      <Text style={{ flex: 1, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
        {c.shipment_count}
      </Text>
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: riskLevel(c.avg_risk).color, textAlign: 'center' }}>
        {Math.round(c.avg_risk * 100)}%
      </Text>
      <Text style={{ flex: 1, fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
        {c.on_time}
      </Text>
    </View>
  )
}

// ─── Event type display info ──────────────────────────────────────────────────

const EVENT_DOT: Record<EventType, string> = {
  DEPARTURE:     '#3b82f6',
  CHECKPOINT:    '#6b7280',
  CUSTOMS_ENTRY: '#f59e0b',
  CUSTOMS_CLEAR: '#f59e0b',
  ARRIVAL:       '#10b981',
  DELAY:         '#ef4444',
  NOTE:          '#9ca3af',
}
const EVENT_EMOJI: Record<EventType, string> = {
  DEPARTURE:     '✈️',
  CHECKPOINT:    '📍',
  CUSTOMS_ENTRY: '🛃',
  CUSTOMS_CLEAR: '✅',
  ARRIVAL:       '🏁',
  DELAY:         '⚠️',
  NOTE:          '📝',
}

// ─── Alert severity pill ──────────────────────────────────────────────────────

const SEVERITY_ORDER: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function SeverityPill({
  severity, count,
}: {
  severity: AlertSeverity; count: number
}) {
  const c = ALERT_SEVERITY_COLORS[severity]
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/alerts')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.background,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        borderWidth: 1,
        borderColor: c.border,
      }}
      activeOpacity={0.75}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.dot, marginRight: 5 }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>
        {severity.charAt(0) + severity.slice(1).toLowerCase()} · {count}
      </Text>
    </TouchableOpacity>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
      {title}
    </Text>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={[{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 2,
      }, style]}
    >
      {children}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface PageData {
  summary: DashboardSummary
  carriers: CarrierPerformance[]
  events: TrackingEvent[]
  riskItems: { id: number; tracking_number: string; delay_risk_score: number }[]
  alerts: AlertType[]
}

export default function DashboardScreen() {
  const { user, logout } = useAuthStore()
  const [data, setData]         = useState<PageData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)
    try {
      const [statsRes, shipmentsRes, alertsRes] = await Promise.all([
        dashboardApi.getStats(),
        shipmentsApi.list({ page: 1, page_size: 20 }),
        dashboardApi.getAlerts({ all: true }),
      ])

      const statsData = statsRes.data
      const shipmentsList = Array.isArray(shipmentsRes.data)
        ? shipmentsRes.data
        : (shipmentsRes.data as any).results ?? []

      // Sort by risk score descending, take top 8
      const riskItems = [...shipmentsList]
        .sort((a, b) => (b.delay_risk_score ?? 0) - (a.delay_risk_score ?? 0))
        .slice(0, 8)
        .map((s) => ({ id: s.id, tracking_number: s.tracking_number, delay_risk_score: s.delay_risk_score ?? 0 }))

      const alertsList: AlertType[] = alertsRes.data.results ?? []

      setData({
        summary:  statsData.summary,
        carriers: (statsData.carrier_performance ?? []).sort((a, b) => b.avg_risk - a.avg_risk),
        events:   statsData.recent_events ?? [],
        riskItems,
        alerts:   alertsList,
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

  // Alert severity counts
  const severityCounts = data
    ? SEVERITY_ORDER.reduce<Record<AlertSeverity, number>>((acc, s) => {
        acc[s] = data.alerts.filter((a) => a.severity === s).length
        return acc
      }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 })
    : null

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#93c5fd', fontSize: 11, fontWeight: '600' }}>Northern Corridor</Text>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 }}>
                Hello, {firstName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => { await logout(); router.replace('/') }}
              style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="log-out-outline" size={22} color="#93b4d8" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#f5801e" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Loading skeleton ──────────────────────────────────────────── */}
          {loading && (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                {[0,1,2].map((i) => (
                  <View key={i} style={{ marginRight: 12 }}>
                    <Skeleton w={130} h={100} radius={16} />
                  </View>
                ))}
              </View>
              <Skeleton w="100%" h={180} radius={16} />
              <View style={{ height: 12 }} />
              <Skeleton w="100%" h={220} radius={16} />
            </>
          )}

          {/* ── Error state ───────────────────────────────────────────────── */}
          {!loading && error && (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
              <Text style={{ color: '#64748b', marginTop: 12, textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          {/* ── Data ─────────────────────────────────────────────────────── */}
          {!loading && data && (
            <>
              {/* 1. KPI cards — horizontal scroll */}
              <View style={{ marginBottom: 16 }}>
                <SectionHeader title="Overview" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                  <KpiCard label="Total Shipments"  value={data.summary.total_shipments}     accent="#0f2d5e" iconName="cube" />
                  <KpiCard label="In Transit"        value={data.summary.active_shipments}    accent="#3b82f6" iconName="navigate" />
                  <KpiCard label="Delivered"          value={data.summary.delivered_shipments} accent="#10b981" iconName="checkmark-circle" />
                  <KpiCard label="Delayed"            value={data.summary.delayed_shipments}   accent="#ef4444" iconName="warning" />
                  <KpiCard label="Open Alerts"        value={data.summary.open_alerts}         accent="#f59e0b" iconName="notifications" />
                </ScrollView>
              </View>

              {/* 2. On-time ring + Alert severity side by side */}
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <OnTimeRing rate={data.summary.on_time_rate} />
                  <View style={{ flex: 1, marginLeft: 20 }}>
                    <SectionHeader title="Alerts by Severity" />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {severityCounts && SEVERITY_ORDER.map((s) => (
                        <SeverityPill key={s} severity={s} count={severityCounts[s]} />
                      ))}
                    </View>
                  </View>
                </View>
              </Card>

              {/* 3. Delay risk heatmap */}
              {data.riskItems.length > 0 && (
                <Card>
                  <SectionHeader title="Delay Risk — Top Shipments" />
                  {/* Column headers */}
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <Text style={{ width: 110, fontSize: 10, color: '#9ca3af' }}>Tracking #</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: '#9ca3af', marginHorizontal: 8 }}>Risk</Text>
                    <Text style={{ width: 34, fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>Score</Text>
                  </View>
                  {data.riskItems.map((item) => (
                    <RiskRow
                      key={item.id}
                      id={item.id}
                      trackingNumber={item.tracking_number}
                      score={item.delay_risk_score}
                    />
                  ))}
                </Card>
              )}

              {/* 4. Carrier performance */}
              {data.carriers.length > 0 && (
                <Card>
                  <SectionHeader title="Carrier Performance" />
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', marginBottom: 6, paddingHorizontal: 10 }}>
                    <Text style={{ flex: 2, fontSize: 10, color: '#9ca3af' }}>Carrier</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>Ships</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>Avg Risk</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>On-Time</Text>
                  </View>
                  {data.carriers.map((c, i) => <CarrierRow key={i} c={c} />)}
                </Card>
              )}

              {/* 5. Recent events feed */}
              {data.events.length > 0 && (
                <Card>
                  <SectionHeader title="Recent Tracking Events" />
                  {data.events.slice(0, 10).map((ev, idx) => {
                    const dotColor = EVENT_DOT[ev.event_type as EventType] ?? '#9ca3af'
                    const emoji    = EVENT_EMOJI[ev.event_type as EventType] ?? '📍'
                    const isLast   = idx === Math.min(data.events.length, 10) - 1
                    return (
                      <View key={ev.id} style={{ flexDirection: 'row', marginBottom: isLast ? 0 : 12 }}>
                        {/* Spine */}
                        <View style={{ width: 28, alignItems: 'center' }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${dotColor}22`, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 11 }}>{emoji}</Text>
                          </View>
                          {!isLast && (
                            <View style={{ width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2 }} />
                          )}
                        </View>
                        {/* Content */}
                        <View style={{ flex: 1, marginLeft: 10, paddingBottom: isLast ? 0 : 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#111827' }}>
                            {ev.event_type_display}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#6b7280' }}>{ev.location}</Text>
                          <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                            {timeAgo(ev.timestamp)}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
