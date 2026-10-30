import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { listOf } from '@/lib/data'
import ShipmentRow from '@/components/ShipmentRow'
import { Empty, HeroStats, Loading, ScreenFrame, Section } from '@/components/ui'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'
import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'

/**
 * A role's working list: the shipments in the given states, soonest due
 * first. Dispatch, customs, warehouse and port screens are all this list
 * with a different filter, so a shipment always looks the same.
 */
export default function ShipmentQueue({
  title,
  statuses,
  emptyIcon,
  emptyTitle,
  emptyBody,
}: {
  title: string
  statuses?: ShipmentStatus[]
  emptyIcon: ComponentProps<typeof Ionicons>['name']
  emptyTitle: string
  emptyBody: string
}) {
  const back = useBack()
  const [items, setItems] = useState<ShipmentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/shipments/', { params: { page_size: 100 } })
      const all = listOf<ShipmentListItem>(res.data)
      setItems(statuses ? all.filter((s) => statuses.includes(s.status)) : all)
    } catch {
      setItems([])
    }
  }, [statuses?.join()])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const sorted = [...items].sort((a, b) => a.scheduled_arrival.localeCompare(b.scheduled_arrival))
  const overdue = items.filter((s) => s.status !== 'DELIVERED' && new Date(s.scheduled_arrival).getTime() < Date.now()).length
  const highRisk = items.filter((s) => s.status !== 'DELIVERED' && (s.delay_risk_score ?? 0) >= 0.7).length
  const weight = items.reduce((t, s) => t + s.weight_kg, 0)

  return (
    <ScreenFrame
      title={title}
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        items.length ? (
          <HeroStats
            items={[
              { label: 'Shipments', value: String(items.length) },
              { label: 'Overdue', value: String(overdue), tone: overdue ? 'danger' : undefined },
              highRisk ? { label: 'High risk', value: String(highRisk), tone: 'warning' } : { label: 'Tonnes', value: (weight / 1000).toFixed(1) },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Empty icon={emptyIcon} title={emptyTitle} body={emptyBody} />
      ) : (
        <Section label="Soonest due first">
          {sorted.map((s, i) => <ShipmentRow key={s.id} item={s} last={i === sorted.length - 1} />)}
        </Section>
      )}
    </ScreenFrame>
  )
}
