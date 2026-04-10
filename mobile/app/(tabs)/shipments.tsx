/**
 * @file mobile/app/(tabs)/shipments.tsx
 * @description Shipments list tab — paginated shipment list with search and
 * pull-to-refresh.
 *
 * Data flow:
 *   - Calls `shipmentsApi.getShipments({ page, page_size: 20 })` on mount
 *     and on pull-to-refresh.
 *   - `FlatList` with `onEndReached` triggers the next page load when the
 *     user scrolls within 10% of the bottom.
 *   - Tapping a row navigates to `shipment/[id]` (ShipmentDetail screen).
 *
 * Platform notes:
 *   - `FlatList` is used instead of `ScrollView` for virtualised rendering
 *     of large lists; Android may render more off-screen items than iOS.
 *
 * @route /(tabs)/shipments
 * @auth IsAuthenticated
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS, riskLevel } from '@shared/utils/statusColors'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

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

// ─── Shipment card ────────────────────────────────────────────────────────────

function ShipmentCard({ item }: { item: ShipmentListItem }) {
  const origin    = item.route?.origin ?? '—'
  const dest      = item.route?.destination ?? '—'
  // delay_risk_score is 0–1 from the API; convert to percentage for display
  const riskPct   = Math.round((item.delay_risk_score ?? 0) * 100)
  const risk      = riskLevel(item.delay_risk_score ?? 0)

  return (
    <TouchableOpacity
      className="bg-white mx-4 mb-3 rounded-2xl p-4 active:opacity-80"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
      }}
      onPress={() => router.push(`/shipment/${item.id}`)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-gray-900 text-sm font-bold font-mono flex-1 mr-2" numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      <View className="flex-row items-center gap-1.5 mb-3">
        <Ionicons name="location-outline" size={11} color="#94a3b8" />
        <Text className="text-gray-500 text-xs" numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={10} color="#94a3b8" />
        <Text className="text-gray-500 text-xs flex-1" numberOfLines={1}>{dest}</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-gray-400 text-xs" numberOfLines={1}>{item.carrier_name}</Text>
        <View className="flex-row items-center gap-1.5">
          <View
            style={{
              width: 48,
              height: 4,
              backgroundColor: '#e5e7eb',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${riskPct}%` as any,
                height: 4,
                backgroundColor: risk.color,
                borderRadius: 2,
              }}
            />
          </View>
          <Text className="text-xs font-semibold" style={{ color: risk.color }}>
            {riskPct}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export default function ShipmentsScreen() {
  const [shipments, setShipments]     = useState<ShipmentListItem[]>([])
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [totalCount, setTotalCount]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)

  const fetchPage = useCallback(async (pageNum: number, isReset = false) => {
    if (pageNum === 1) {
      isReset ? setLoading(true) : setRefreshing(true)
    } else {
      setLoadingMore(true)
    }
    try {
      const res = await shipmentsApi.list({ page: pageNum, page_size: PAGE_SIZE })
      const data = res.data
      const results: ShipmentListItem[] = Array.isArray(data) ? data : (data as any).results ?? []
      setTotalCount((data as any).count ?? results.length)
      setShipments((prev) => (pageNum === 1 ? results : [...prev, ...results]))
      setPage(pageNum)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchPage(1, true) }, [fetchPage])

  const filtered = search.trim()
    ? shipments.filter((s) =>
        s.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
        s.carrier_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.route?.origin?.toLowerCase().includes(search.toLowerCase()) ||
        s.route?.destination?.toLowerCase().includes(search.toLowerCase()),
      )
    : shipments

  const canLoadMore = !search && shipments.length < totalCount

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-4 pb-4">
        <Text className="text-white text-xl font-bold mb-4">Shipments</Text>
        <View className="flex-row items-center bg-white/10 rounded-xl px-3 py-2.5">
          <Ionicons name="search" size={16} color="#93b4d8" />
          <TextInput
            className="flex-1 text-white text-sm ml-2"
            placeholder="Search tracking, carrier, route…"
            placeholderTextColor="#5d87b5"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#93b4d8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f5801e" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ShipmentCard item={item} />}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPage(1)}
              tintColor="#f5801e"
            />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
              <Text className="text-gray-400 mt-3 text-sm">No shipments found</Text>
            </View>
          }
          onEndReached={() => { if (canLoadMore && !loadingMore) fetchPage(page + 1) }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#f5801e" style={{ paddingVertical: 16 }} />
            ) : null
          }
        />
      )}
    </View>
    </SafeAreaView>
  )
}
