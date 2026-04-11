import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS, riskLevel } from '@shared/utils/statusColors'
import { formatDate } from '@shared/utils/formatters'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

// ─── Status filter config ─────────────────────────────────────────────────────

type FilterKey = 'ALL' | ShipmentStatus
const STATUS_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All'        },
  { key: 'PENDING',    label: 'Pending'    },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'CUSTOMS',    label: 'Customs'    },
  { key: 'DELIVERED',  label: 'Delivered'  },
  { key: 'DELAYED',    label: 'Delayed'    },
]

type SortKey = 'arrival' | 'risk'
const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'arrival', label: 'Soonest ETA', icon: 'calendar-outline' },
  { key: 'risk',    label: 'Highest Risk', icon: 'warning-outline'  },
]

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
  const origin  = item.route?.origin ?? '—'
  const dest    = item.route?.destination ?? '—'
  const risk    = riskLevel(item.delay_risk_score ?? 0)
  const riskPct = Math.round((item.delay_risk_score ?? 0) * 100)
  const eta     = item.scheduled_arrival ? formatDate(item.scheduled_arrival) : '—'

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shipment/${item.id}`)}
      style={{
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 2,
      }}
      activeOpacity={0.8}
    >
      {/* Row 1: tracking + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', flex: 1, marginRight: 8 }} numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      {/* Row 2: route */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="location-outline" size={11} color="#94a3b8" />
        <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 3 }} numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={10} color="#94a3b8" style={{ marginHorizontal: 4 }} />
        <Text style={{ fontSize: 11, color: '#6b7280', flex: 1 }} numberOfLines={1}>{dest}</Text>
      </View>

      {/* Row 3: carrier + ETA */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: '#9ca3af' }} numberOfLines={1}>{item.carrier_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={11} color="#9ca3af" />
          <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 3 }}>ETA {eta}</Text>
        </View>
      </View>

      {/* Row 4: risk bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, height: 5, backgroundColor: '#f1f5f9', borderRadius: 3, marginRight: 8 }}>
          <View style={{ width: `${riskPct}%`, height: 5, backgroundColor: risk.color, borderRadius: 3 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: risk.color, width: 40, textAlign: 'right' }}>
          {riskPct}% {risk.label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export default function ShipmentsScreen() {
  const [shipments, setShipments]     = useState<ShipmentListItem[]>([])
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState<FilterKey>('ALL')
  const [sort, setSort]               = useState<SortKey>('arrival')
  const [page, setPage]               = useState(1)
  const [totalCount, setTotalCount]   = useState(0)
  const [hasNext, setHasNext]         = useState(false)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)

  const fetchPage = useCallback(
    async (pageNum: number, isReset = false) => {
      if (pageNum === 1) {
        isReset ? setLoading(true) : setRefreshing(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const params: Parameters<typeof shipmentsApi.list>[0] = {
          page: pageNum,
          page_size: PAGE_SIZE,
        }
        if (statusFilter !== 'ALL') params.status = statusFilter

        const res = await shipmentsApi.list(params)
        const data = res.data
        const results: ShipmentListItem[] = Array.isArray(data)
          ? data
          : (data as any).results ?? []
        setTotalCount((data as any).count ?? results.length)
        setHasNext(Boolean((data as any).next))
        setShipments((prev) => (pageNum === 1 ? results : [...prev, ...results]))
        setPage(pageNum)
      } catch {
        // silent — user sees stale data
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [statusFilter],
  )

  // Refetch when status filter changes
  useEffect(() => { fetchPage(1, true) }, [fetchPage, statusFilter])

  // Client-side search and sort
  const processed = shipments
    .filter((s) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        s.tracking_number.toLowerCase().includes(q) ||
        s.carrier_name?.toLowerCase().includes(q) ||
        s.route?.origin?.toLowerCase().includes(q) ||
        s.route?.destination?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sort === 'risk') {
        return (b.delay_risk_score ?? 0) - (a.delay_risk_score ?? 0)
      }
      // arrival — soonest first (nulls last)
      const aTime = a.scheduled_arrival ? new Date(a.scheduled_arrival).getTime() : Infinity
      const bTime = b.scheduled_arrival ? new Date(b.scheduled_arrival).getTime() : Infinity
      return aTime - bTime
    })

  const canLoadMore = !search && hasNext && !loadingMore

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Shipments</Text>
            <Text style={{ color: '#93b4d8', fontSize: 12 }}>{totalCount} total</Text>
          </View>

          {/* Search */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 }}>
            <Ionicons name="search" size={15} color="#93b4d8" />
            <TextInput
              style={{ flex: 1, color: '#fff', fontSize: 13, marginLeft: 8 }}
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

          {/* Sort buttons */}
          <View style={{ flexDirection: 'row' }}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSort(opt.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: sort === opt.key ? '#f5801e' : 'rgba(255,255,255,0.12)',
                }}
                activeOpacity={0.75}
              >
                <Ionicons name={opt.icon} size={11} color={sort === opt.key ? '#fff' : '#93b4d8'} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: sort === opt.key ? '#fff' : '#93b4d8', marginLeft: 4 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Status filter pills ──────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
          >
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key
              const colors = f.key !== 'ALL'
                ? SHIPMENT_STATUS_COLORS[f.key as ShipmentStatus]
                : null
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setStatus(f.key)}
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: active
                      ? (colors?.background ?? '#0f2d5e')
                      : '#f1f5f9',
                    borderWidth: 1.5,
                    borderColor: active ? (colors?.border ?? '#0f2d5e') : 'transparent',
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? (colors?.text ?? '#fff') : '#6b7280',
                  }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        {/* ── List ──────────────────────────────────────────────────────────── */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#f5801e" />
          </View>
        ) : (
          <FlatList
            data={processed}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <ShipmentCard item={item} />}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchPage(1)}
                tintColor="#f5801e"
              />
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
                <Text style={{ color: '#9ca3af', marginTop: 10, fontSize: 14 }}>No shipments found</Text>
              </View>
            }
            onEndReached={() => { if (canLoadMore) fetchPage(page + 1) }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color="#f5801e" style={{ paddingVertical: 16 }} /> : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  )
}
