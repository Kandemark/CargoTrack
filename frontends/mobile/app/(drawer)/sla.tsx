import { useCallback, useEffect, useState } from 'react'
import { router } from 'expo-router'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { day } from '@/lib/data'
import { Chip, Empty, HeroStats, ListRow, Loading, Pill, ScreenFrame, Section, type PillTone } from '@/components/ui'
import { ScrollView, View } from 'react-native'
import { useAuthStore } from '@/lib/store'
import { carrierLabel } from '@/lib/carrier'

type SlaStatus = 'ON_TIME' | 'AT_RISK' | 'BREACHED'

interface SlaItem {
  id: number
  tracking_number: string
  carrier: string
  route: string
  sla_status: SlaStatus
  breach_hours: number | null
  scheduled_arrival: string
  actual_arrival: string | null
}

interface SlaData {
  compliance_pct: number
  total: number
  on_time: number
  at_risk: number
  breached: number
  items: SlaItem[]
}

const STATUS: Record<SlaStatus, { label: string; tone: PillTone }> = {
  ON_TIME: { label: 'On time', tone: 'success' },
  AT_RISK: { label: 'At risk', tone: 'warning' },
  BREACHED: { label: 'Breached', tone: 'danger' },
}

/** Delivery promises: how many were kept, and which shipments broke or may break them. */
export default function SLAScreen() {
  const back = useBack()
  const ownOrg = useAuthStore((s) => s.user?.org_name)
  const [data, setData] = useState<SlaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'ALL' | SlaStatus>('ALL')

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<SlaData>('/api/v1/sla/')
      setData(res.data)
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const items = (data?.items ?? []).filter((i) => filter === 'ALL' || i.sla_status === filter)

  return (
    <ScreenFrame
      title="SLA monitor"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        data ? (
          <HeroStats
            items={[
              { label: 'Kept', value: `${Math.round(data.compliance_pct)}%` },
              { label: 'At risk', value: String(data.at_risk), tone: data.at_risk > 0 ? 'warning' : undefined },
              { label: 'Breached', value: String(data.breached), tone: data.breached > 0 ? 'danger' : undefined },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <Empty icon="speedometer-outline" title="Nothing to measure yet" body="Shipments with a promised arrival show here once they are under way." />
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {(['ALL', 'BREACHED', 'AT_RISK', 'ON_TIME'] as const).map((k) => (
              <Chip key={k} label={k === 'ALL' ? 'All' : STATUS[k].label} selected={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
          <Section label={`${items.length} shipment${items.length === 1 ? '' : 's'}`}>
            {items.length === 0 ? (
              <Empty icon="checkmark-circle-outline" title="None here" />
            ) : (
              items.map((item, i) => (
                <ListRow
                  key={item.id}
                  title={item.route}
                  subtitle={`${item.tracking_number} · ${carrierLabel(item.carrier, ownOrg)} · due ${day(item.scheduled_arrival)}${
                    item.sla_status === 'BREACHED' && item.breach_hours ? ` · ${Math.round(item.breach_hours)}h late` : ''
                  }`}
                  trailing={<Pill label={STATUS[item.sla_status].label} tone={STATUS[item.sla_status].tone} />}
                  onPress={() => router.push(`/(drawer)/shipment/${item.id}` as any)}
                  last={i === items.length - 1}
                />
              ))
            )}
          </Section>
        </View>
      )}
    </ScreenFrame>
  )
}
