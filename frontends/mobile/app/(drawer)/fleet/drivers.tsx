import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { listOf } from '@/lib/data'
import { Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section, type PillTone } from '@/components/ui'

interface Driver {
  id: number
  driver_id: string
  full_name: string
  phone: string
  email: string
  status: string
  rating: number
  on_time_rate: number
  total_jobs: number
  active_route: string
  current_location: string
  truck_info: { fleet_id: string; plate: string } | null
}

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  ON_ROUTE: { label: 'On a trip', tone: 'info' },
  OFF_DUTY: { label: 'Off duty', tone: 'neutral' },
  ON_LEAVE: { label: 'On leave', tone: 'neutral' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
}

/** Drivers: who is free, who is on a trip and in which truck, and their record. */
export default function DriversScreen() {
  const back = useBack()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Driver | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/fleet/drivers/')
      setDrivers(listOf<Driver>(res.data))
    } catch {
      setDrivers([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (selected) {
    const d = selected
    const st = STATUS[d.status] ?? { label: d.status, tone: 'neutral' as PillTone }
    return (
      <ScreenFrame
        eyebrow={d.driver_id}
        title={d.full_name}
        subtitle={st.label}
        onBack={() => setSelected(null)}
        hero={
          <HeroStats
            items={[
              { label: 'On time', value: `${Math.round(d.on_time_rate)}%` },
              { label: 'Rating', value: d.rating.toFixed(1) },
              { label: 'Trips', value: String(d.total_jobs) },
            ]}
          />
        }>
        <Section label="Now">
          <KeyValue label="Status" value={<Pill label={st.label} tone={st.tone} />} />
          <KeyValue label="Trip" value={d.active_route || 'None'} />
          <KeyValue label="Truck" value={d.truck_info ? d.truck_info.plate : 'None'} last />
        </Section>
        {d.phone || d.email ? (
          <Section label="Contact">
            {d.phone ? <ListRow icon="call-outline" title={d.phone} subtitle="Call" onPress={() => Linking.openURL(`tel:${d.phone.replace(/\s/g, '')}`)} last={!d.email} /> : null}
            {d.email ? <ListRow icon="mail-outline" title={d.email} subtitle="Email" onPress={() => Linking.openURL(`mailto:${d.email}`)} last /> : null}
          </Section>
        ) : null}
      </ScreenFrame>
    )
  }

  const onTrip = drivers.filter((d) => d.status === 'ON_ROUTE').length
  const available = drivers.filter((d) => d.status === 'AVAILABLE').length

  return (
    <ScreenFrame
      title="Drivers"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        drivers.length ? (
          <HeroStats
            items={[
              { label: 'On a trip', value: String(onTrip) },
              { label: 'Available', value: String(available) },
              { label: 'Off', value: String(drivers.length - onTrip - available) },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : drivers.length === 0 ? (
        <Empty icon="id-card-outline" title="No drivers yet" body="Drivers you add appear here with their trips and record." />
      ) : (
        <Section label="All drivers">
          {drivers.map((d, i) => {
            const st = STATUS[d.status] ?? { label: d.status, tone: 'neutral' as PillTone }
            return (
              <ListRow
                key={d.id}
                icon="person-outline"
                title={d.full_name}
                subtitle={d.status === 'ON_ROUTE' && d.active_route ? `${d.active_route}${d.truck_info ? ` · ${d.truck_info.plate}` : ''}` : `${Math.round(d.on_time_rate)}% on time · ${d.total_jobs} trips`}
                trailing={<Pill label={st.label} tone={st.tone} />}
                onPress={() => setSelected(d)}
                last={i === drivers.length - 1}
              />
            )
          })}
        </Section>
      )}
    </ScreenFrame>
  )
}
