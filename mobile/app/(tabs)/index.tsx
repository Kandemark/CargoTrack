import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { dashboardApi, shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import type { DashboardSummary, ShipmentListItem, ShipmentStatus } from '@shared/api/types'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; dot: string; bg: string; text: string }> = {
  IN_TRANSIT: { label: 'In Transit',  dot: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  DELAYED:    { label: 'Delayed',     dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  CUSTOMS:    { label: 'At Customs',  dot: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
  DELIVERED:  { label: 'Delivered',   dot: '#6366f1', bg: '#eef2ff', text: '#4f46e5' },
  PENDING:    { label: 'Pending',     dot: '#94a3b8', bg: '#f8fafc', text: '#64748b' },
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <View
      style={{ backgroundColor: cfg.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}
    >
      <Text style={{ color: cfg.text, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
    </View>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
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
    <View className="flex-1 bg-white rounded-2xl p-4 mx-1" style={{ minWidth: '44%' }}>
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mb-3"
        style={{ backgroundColor: `${accent}18` }}
      >
        <Ionicons name={iconName} size={18} color={accent} />
      </View>
      <Text className="text-gray-900 text-2xl font-bold">{value}</Text>
      <Text className="text-gray-500 text-xs mt-0.5">{label}</Text>
    </View>
  )
}

// ─── Shipment Row ─────────────────────────────────────────────────────────────

function ShipmentRow({ item }: { item: ShipmentListItem }) {
  const origin = item.route?.origin ?? '—'
  const dest   = item.route?.destination ?? '—'
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
      onPress={() => router.push(`/shipment/${item.id}`)}
    >
      <View className="flex-1 mr-3">
        <Text className="text-gray-900 text-sm font-semibold" numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {origin} → {dest}
        </Text>
      </View>
      <StatusBadge status={item.status} />
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, logout } = useAuthStore()
  const [summary, setSummary]     = useState<DashboardSummary | null>(null)
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [statsRes, shRes] = await Promise.all([
        dashboardApi.getStats(),
        shipmentsApi.list({ page: 1, page_size: 8 }),
      ])
      setSummary(statsRes.data.summary)
      setShipments(shRes.data.results ?? (shRes.data as any))
    } catch {
      // silent — user sees stale data rather than crash
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  const firstName = user?.first_name || user?.username || 'there'

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-14 pb-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-blue-300 text-xs font-medium">Northern Corridor</Text>
            <Text className="text-white text-xl font-bold mt-0.5">Hello, {firstName}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity className="w-9 h-9 items-center justify-center">
              <Ionicons name="notifications-outline" size={22} color="#93b4d8" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await logout()
                router.replace('/(auth)/login')
              }}
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
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#f5801e" />
          </View>
        ) : (
          <>
            {/* Stat cards */}
            <View className="px-4 pt-4 pb-2">
              <Text className="text-gray-700 text-xs font-semibold uppercase tracking-wide mb-3">
                Overview
              </Text>
              <View className="flex-row flex-wrap gap-y-2 -mx-1">
                <StatCard
                  value={summary?.active_shipments ?? '—'}
                  label="Active"
                  iconName="cube"
                  accent="#0f2d5e"
                />
                <StatCard
                  value={summary?.delayed_shipments ?? '—'}
                  label="Delayed"
                  iconName="warning"
                  accent="#ef4444"
                />
                <StatCard
                  value={summary ? `${summary.on_time_rate}%` : '—'}
                  label="On-time Rate"
                  iconName="checkmark-circle"
                  accent="#22c55e"
                />
                <StatCard
                  value={summary?.open_alerts ?? '—'}
                  label="Open Alerts"
                  iconName="notifications"
                  accent="#f5801e"
                />
              </View>
            </View>

            {/* Recent shipments */}
            <View className="mx-4 mt-4 mb-8 bg-white rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                <Text className="text-gray-900 text-sm font-bold">Recent Shipments</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/shipments')}>
                  <Text className="text-ct-orange text-xs font-semibold">See all</Text>
                </TouchableOpacity>
              </View>
              {shipments.length === 0 ? (
                <View className="py-10 items-center">
                  <Ionicons name="cube-outline" size={32} color="#cbd5e1" />
                  <Text className="text-gray-400 text-sm mt-2">No shipments</Text>
                </View>
              ) : (
                shipments.map((s) => <ShipmentRow key={s.id} item={s} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
