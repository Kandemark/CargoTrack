import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { SHIPMENT_STATUS_COLORS } from '@shared/utils/statusColors'
import ShipmentCard from '@/components/ShipmentCard'
import { FilterPills, Input, EmptyState, Skeleton, GlassCard } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

type FilterKey = 'ALL' | ShipmentStatus

const STATUS_PILLS = [
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
        // silent
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [statusFilter],
  )

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
      if (sort === 'risk') return (b.delay_risk_score ?? 0) - (a.delay_risk_score ?? 0)
      const aTime = a.scheduled_arrival ? new Date(a.scheduled_arrival).getTime() : Infinity
      const bTime = b.scheduled_arrival ? new Date(b.scheduled_arrival).getTime() : Infinity
      return aTime - bTime
    })

  const canLoadMore = !search && hasNext && !loadingMore

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <View className="flex-1">
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#3b82f6" accentPosition="left" className="mx-4 mt-ct-lg mb-2">
          <View className="p-ct-lg">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-ct-xl font-extrabold text-ct-text-primary dark:text-white">Shipments</Text>
              <Text className="text-ct-sm text-ct-text-muted dark:text-slate-300">{totalCount} total</Text>
            </View>

            {/* Search */}
            <View className="mb-2.5">
              <Input
                icon="search"
                placeholder="Search tracking, carrier, route…"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
                rightSlot={
                  search.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>

            {/* Sort */}
            <View className="flex-row">
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.key
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setSort(opt.key)}
                    activeOpacity={0.75}
                    className={cn(
                      'flex-row items-center mr-2.5 px-2.5 py-1.5 rounded-full',
                      active ? 'bg-ct-orange' : 'bg-white/10',
                    )}
                  >
                    <Ionicons name={opt.icon} size={11} color={active ? '#fff' : '#94a3b8'} />
                    <Text className={cn('text-ct-xs font-bold ml-1', active ? 'text-white' : 'text-slate-300')}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </GlassCard>

        {/* Status filter pills */}
        <View className="mx-4 bg-black/20 rounded-ct-lg px-3 py-2 mb-2">
          <FilterPills
            options={STATUS_PILLS.map((p) => {
              const c = p.key !== 'ALL' ? SHIPMENT_STATUS_COLORS[p.key as ShipmentStatus] : null
              return {
                key: p.key,
                label: p.label,
                dotColor: c?.dot,
                activeBg: c?.background,
                activeText: c?.text,
                activeBorder: c?.border,
              }
            })}
            selected={statusFilter}
            onSelect={(key) => setStatus((key as FilterKey) ?? 'ALL')}
            allowDeselect={false}
          />
        </View>

        {/* List */}
        {loading ? (
          <View className="flex-1 px-4 pt-4">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </View>
        ) : (
          <FlatList
            data={processed}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <ShipmentCard item={item} />}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchPage(1)}
                tintColor="#f5801e"
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="cube-outline"
                title="No shipments found"
                description={search ? 'Try a different search term' : 'Shipments will appear here once created'}
                size="lg"
              />
            }
            onEndReached={() => { if (canLoadMore) fetchPage(page + 1) }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-4 items-center">
                  <Skeleton variant="rect" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  )
}
