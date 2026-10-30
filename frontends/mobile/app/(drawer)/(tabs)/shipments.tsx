import { useEffect, useState, useCallback } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ShipmentRow from '@/components/ShipmentRow'
import { Chip, HeroSearch, ScreenFrame, Skeleton, Txt } from '@/components/ui'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

type FilterKey = 'ALL' | ShipmentStatus

const STATUS_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All'        },
  { key: 'IN_TRANSIT', label: 'In transit' },
  { key: 'DELAYED',    label: 'Delayed'    },
  { key: 'CUSTOMS',    label: 'Customs'    },
  { key: 'PENDING',    label: 'Pending'    },
  { key: 'DELIVERED',  label: 'Delivered'  },
]

type SortKey = 'arrival' | 'risk'
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'arrival', label: 'Soonest arrival' },
  { key: 'risk',    label: 'Highest risk' },
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
      // Delivered shipments have arrived; they go after everything still moving.
      const done = Number(a.status === 'DELIVERED') - Number(b.status === 'DELIVERED')
      if (done !== 0) return done
      if (sort === 'risk') return (b.delay_risk_score ?? 0) - (a.delay_risk_score ?? 0)
      const aTime = a.scheduled_arrival ? new Date(a.scheduled_arrival).getTime() : Infinity
      const bTime = b.scheduled_arrival ? new Date(b.scheduled_arrival).getTime() : Infinity
      return aTime - bTime
    })

  const canLoadMore = !search && hasNext && !loadingMore

  const { colors, brand } = useAppTheme()

  return (
    <ScreenFrame
      title="Shipments"
      subtitle={totalCount === 1 ? '1 shipment' : `${totalCount} shipments`}
      refreshing={refreshing}
      onRefresh={() => fetchPage(1)}
      onEndReached={() => { if (canLoadMore) fetchPage(page + 1) }}
      hero={
        <View style={{ gap: 14 }}>
          <HeroSearch value={search} onChangeText={setSearch} placeholder="Search tracking number, carrier, route" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key
              return (
                <View key={opt.key} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Txt
                    onPress={() => setSort(opt.key)}
                    variant="caption"
                    accessibilityRole="button"
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      fontFamily: active ? 'DMSans-Bold' : 'DMSans-Medium',
                      color: active ? brand.primary : '#FFFFFF',
                      backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
                    }}>
                    {opt.label}
                  </Txt>
                </View>
              )
            })}
          </View>
        </View>
      }>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {STATUS_PILLS.map((p) => (
            <Chip key={p.key} label={p.label} selected={statusFilter === p.key} onPress={() => setStatus(p.key)} />
          ))}
        </ScrollView>

        <View style={{ marginTop: 8 }}>
          {loading ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              <Skeleton variant="card" style={{ height: 84 }} />
              <Skeleton variant="card" style={{ height: 84 }} />
              <Skeleton variant="card" style={{ height: 84 }} />
            </View>
          ) : processed.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
              <Ionicons name="cube-outline" size={36} color={colors.textFaint} />
              <Txt variant="heading">{search ? 'No matches' : 'No shipments here'}</Txt>
              <Txt variant="body" tone="muted" style={{ textAlign: 'center' }}>
                {search ? 'Try a different tracking number, carrier or place.' : 'Shipments with this status will show up here.'}
              </Txt>
            </View>
          ) : (
            processed.map((item, i) => (
              <ShipmentRow key={item.id} item={item} last={i === processed.length - 1} />
            ))
          )}
          {loadingMore ? <ActivityIndicator color={brand.accent} style={{ marginTop: 16 }} /> : null}
        </View>
      </View>
    </ScreenFrame>
  )
}
