/**
 * @file mobile/app/(tabs)/index.tsx
 * @description Dashboard home tab — displays KPI summary cards and recent
 * shipment activity for the authenticated user.
 *
 * Data flow:
 *   - Calls `dashboardApi.getStats()` (GET /api/v1/dashboard/stats/) on mount
 *     and on pull-to-refresh.
 *   - `RefreshControl` on the `ScrollView` triggers a re-fetch on swipe-down.
 *
 * Platform notes:
 *   - `SafeAreaView` handles the iOS notch; no special Android handling needed.
 *   - `StatusBar` style is set to `dark` to match the light background.
 *
 * @route /(tabs)/
 * @auth IsAuthenticated
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { dashboardApi, shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS, riskLevel } from '@shared/utils/statusColors'
import { formatDate } from '@shared/utils/formatters'
import type { DashboardSummary, ShipmentListItem, ShipmentStatus } from '@shared/api/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const c = SHIPMENT_STATUS_COLORS[status] ?? SHIPMENT_STATUS_COLORS.PENDING
  return (
    <View style={{ backgroundColor: c.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>
        {SHIPMENT_STATUS_LABELS[status] ?? status}
      </Text>
    </View>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  value,
  label,
  iconName,
  accent,
}: {
  value: string | number
  label: string
  iconName: React.ComponentProps<typeof Ionicons>['name']
  accent: string
}) {
  return (
    <View
      className="bg-white rounded-2xl p-4"
      style={{ flex: 1, minWidth: '44%', margin: 4 }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mb-3"
        style={{ backgroundColor: `${accent}22` }}
      >
        <Ionicons name={iconName} size={18} color={accent} />
      </View>
      <Text className="text-gray-900 text-2xl font-bold">{value}</Text>
      <Text className="text-gray-500 text-xs mt-0.5">{label}</Text>
    </View>
  )
}

// ─── Shipment row ─────────────────────────────────────────────────────────────

function ShipmentRow({ item }: { item: ShipmentListItem }) {
  const origin = item.route?.origin ?? '—'
  const dest   = item.route?.destination ?? '—'
  const eta    = item.scheduled_arrival ? formatDate(item.scheduled_arrival) : '—'

  return (
    <TouchableOpacity
      className="flex-row items-center justify-between px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
      onPress={() => router.push(`/shipment/${item.id}`)}
    >
      <View className="flex-1 mr-3">
        <Text className="text-gray-900 text-sm font-bold font-mono" numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
          {origin} → {dest} · ETA {eta}
        </Text>
      </View>
      <StatusBadge status={item.status} />
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, logout } = useAuthStore()
  const [summary, setSummary]       = useState<DashboardSummary | null>(null)
  const [shipments, setShipments]   = useState<ShipmentListItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [statsRes, shRes] = await Promise.all([
        dashboardApi.getStats(),
        shipmentsApi.list({ page: 1, page_size: 5 }),
      ])
      setSummary(statsRes.data.summary)
      const raw = shRes.data
      setShipments(Array.isArray(raw) ? raw : (raw as any).results ?? [])
    } catch {
      // silent — user sees stale data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  const firstName = user?.first_name || user?.username || 'there'

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-blue-300 text-xs font-semibold">Northern Corridor</Text>
            <Text className="text-white text-xl font-bold mt-0.5">Hello, {firstName}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={async () => { await logout(); router.replace('/(auth)/login') }}
              className="w-9 h-9 items-center justify-center"
            >
              <Ionicons name="log-out-outline" size={22} color="#93b4d8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5801e" />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#f5801e" />
          </View>
        ) : (
          <>
            {/* KPI grid — 2×2 */}
            <View className="px-4 pt-4 pb-2">
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                Overview
              </Text>
              <View className="flex-row flex-wrap -mx-1">
                <KpiCard
                  value={summary?.total_shipments ?? '—'}
                  label="Total Shipments"
                  iconName="cube"
                  accent="#0f2d5e"
                />
                <KpiCard
                  value={summary?.active_shipments ?? '—'}
                  label="In Transit"
                  iconName="navigate"
                  accent="#3b82f6"
                />
                <KpiCard
                  value={summary?.delayed_shipments ?? '—'}
                  label="Delayed"
                  iconName="warning"
                  accent="#ef4444"
                />
                <KpiCard
                  value={summary ? `${summary.on_time_rate}%` : '—'}
                  label="On Time"
                  iconName="checkmark-circle"
                  accent="#22c55e"
                />
              </View>
            </View>

            {/* Recent shipments */}
            <View className="mx-4 mt-3 mb-8 bg-white rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                <Text className="text-gray-900 text-sm font-bold">Recent Shipments</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/shipments')}>
                  <Text className="text-ct-orange text-xs font-semibold">See all</Text>
                </TouchableOpacity>
              </View>
              {shipments.length === 0 ? (
                <View className="py-10 items-center">
                  <Ionicons name="cube-outline" size={32} color="#cbd5e1" />
                  <Text className="text-gray-400 text-sm mt-2">No shipments found</Text>
                </View>
              ) : (
                shipments.map((s) => <ShipmentRow key={s.id} item={s} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
    </SafeAreaView>
  )
}
