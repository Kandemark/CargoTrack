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
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string }> = {
  IN_TRANSIT: { label: 'In Transit',  bg: '#f0fdf4', text: '#15803d' },
  DELAYED:    { label: 'Delayed',     bg: '#fef2f2', text: '#dc2626' },
  CUSTOMS:    { label: 'At Customs',  bg: '#fffbeb', text: '#d97706' },
  DELIVERED:  { label: 'Delivered',   bg: '#eef2ff', text: '#4f46e5' },
  PENDING:    { label: 'Pending',     bg: '#f8fafc', text: '#64748b' },
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: cfg.text, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
    </View>
  )
}

function ShipmentCard({ item }: { item: ShipmentListItem }) {
  const origin = item.route?.origin ?? '—'
  const dest   = item.route?.destination ?? '—'
  const risk   = item.delay_risk_score ?? 0
  const riskColor = risk >= 70 ? '#ef4444' : risk >= 40 ? '#f59e0b' : '#22c55e'

  return (
    <TouchableOpacity
      className="bg-white mx-4 mb-3 rounded-2xl p-4 active:opacity-80"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2 }}
      onPress={() => router.push(`/shipment/${item.id}`)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-gray-900 text-sm font-bold flex-1 mr-2" numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      <View className="flex-row items-center gap-1.5 mb-3">
        <Text className="text-gray-500 text-xs" numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={10} color="#94a3b8" />
        <Text className="text-gray-500 text-xs flex-1" numberOfLines={1}>{dest}</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-gray-400 text-xs">{item.carrier_name}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-xs" style={{ color: riskColor }}>Risk</Text>
          <Text className="text-xs font-bold" style={{ color: riskColor }}>{risk}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const PAGE_SIZE = 15

export default function ShipmentsScreen() {
  const [shipments, setShipments]   = useState<ShipmentListItem[]>([])
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(async (pageNum: number, reset = false) => {
    if (pageNum === 1) reset ? setLoading(true) : setRefreshing(true)
    else setLoadingMore(true)

    try {
      const res = await shipmentsApi.list({ page: pageNum, page_size: PAGE_SIZE })
      const data = res.data
      const results: ShipmentListItem[] = data.results ?? data
      setTotalCount(data.count ?? results.length)
      setShipments(prev => (pageNum === 1 ? results : [...prev, ...results]))
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

  const onRefresh = () => fetchPage(1)

  const filtered = search.trim()
    ? shipments.filter(s =>
        s.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
        s.carrier_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.route?.origin?.toLowerCase().includes(search.toLowerCase()) ||
        s.route?.destination?.toLowerCase().includes(search.toLowerCase()),
      )
    : shipments

  const canLoadMore = !search && shipments.length < totalCount

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-14 pb-4">
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
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <ShipmentCard item={item} />}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5801e" />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
              <Text className="text-gray-400 mt-3">No shipments found</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#f5801e" style={{ paddingVertical: 16 }} />
            ) : canLoadMore ? (
              <TouchableOpacity
                className="mx-4 mb-4 py-3 items-center rounded-xl bg-white border border-gray-200"
                onPress={() => fetchPage(page + 1)}
              >
                <Text className="text-ct-navy text-sm font-semibold">Load more</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  )
}
