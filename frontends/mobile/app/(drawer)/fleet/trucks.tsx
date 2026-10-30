import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { day, listOf } from '@/lib/data'
import { Chip, Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section, type PillTone } from '@/components/ui'

interface Truck {
  id: number
  fleet_id: string
  make: string
  model: string
  year: number
  plate: string
  status: string
  odometer_km: number
  load_pct: number
  current_location: string
  next_service_date: string | null
  assigned_driver_name: string | null
}

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  ACTIVE: { label: 'On the road', tone: 'success' },
  IDLE: { label: 'Idle', tone: 'neutral' },
  MAINTENANCE: { label: 'In service', tone: 'warning' },
  OFF_DUTY: { label: 'Off duty', tone: 'neutral' },
  DECOMMISSIONED: { label: 'Retired', tone: 'danger' },
}

/** The company's trucks: where each is, who drives it, and when it is next due for service. */
export default function TrucksScreen() {
  const back = useBack()
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<Truck | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/fleet/trucks/')
      setTrucks(listOf<Truck>(res.data))
    } catch {
      setTrucks([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (selected) {
    const t = selected
    const st = STATUS[t.status] ?? { label: t.status, tone: 'neutral' as PillTone }
    return (
      <ScreenFrame eyebrow={t.fleet_id} title={t.plate} subtitle={`${t.make} ${t.model}, ${t.year}`} onBack={() => setSelected(null)}>
        <Section label="Now">
          <KeyValue label="Status" value={<Pill label={st.label} tone={st.tone} />} />
          <KeyValue label="Location" value={t.current_location || 'Unknown'} />
          <KeyValue label="Driver" value={t.assigned_driver_name ?? 'Not assigned'} />
          <KeyValue label="Load" value={`${Math.round(t.load_pct)}%`} last />
        </Section>
        <Section label="Upkeep">
          <KeyValue label="Odometer" value={`${Math.round(t.odometer_km).toLocaleString()} km`} />
          <KeyValue label="Next service" value={day(t.next_service_date)} last />
        </Section>
      </ScreenFrame>
    )
  }

  const count = (s: string) => trucks.filter((t) => t.status === s).length
  const dueSoon = trucks.filter((t) => t.next_service_date && new Date(t.next_service_date).getTime() - Date.now() < 14 * 86_400_000).length
  const shown = trucks.filter((t) => filter === 'ALL' || t.status === filter)

  return (
    <ScreenFrame
      title="Trucks"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        trucks.length ? (
          <HeroStats
            items={[
              { label: 'In use', value: `${Math.round((count('ACTIVE') / trucks.length) * 100)}%` },
              { label: 'In service', value: String(count('MAINTENANCE')), tone: count('MAINTENANCE') ? 'warning' : undefined },
              { label: 'Service in 14 days', value: String(dueSoon) },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : trucks.length === 0 ? (
        <Empty icon="bus-outline" title="No trucks yet" body="Trucks you add to your fleet appear here." />
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {['ALL', 'ACTIVE', 'IDLE', 'MAINTENANCE'].map((k) => (
              <Chip key={k} label={k === 'ALL' ? 'All' : STATUS[k].label} selected={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
          <Section label={`${shown.length} truck${shown.length === 1 ? '' : 's'}`}>
            {shown.map((t, i) => {
              const st = STATUS[t.status] ?? { label: t.status, tone: 'neutral' as PillTone }
              return (
                <ListRow
                  key={t.id}
                  icon="bus-outline"
                  title={t.plate}
                  subtitle={[`${t.make} ${t.model}`, t.current_location, t.assigned_driver_name].filter(Boolean).join(' · ')}
                  trailing={<Pill label={st.label} tone={st.tone} />}
                  onPress={() => setSelected(t)}
                  last={i === shown.length - 1}
                />
              )
            })}
          </Section>
        </View>
      )}
    </ScreenFrame>
  )
}
