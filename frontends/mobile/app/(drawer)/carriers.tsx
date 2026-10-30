import { useCallback, useEffect, useState } from 'react'
import { Linking, View } from 'react-native'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { day, listOf, money } from '@/lib/data'
import { Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section, Txt } from '@/components/ui'

interface RateCard {
  id: number
  name: string
  origin: string
  destination: string
  min_charge: string
  currency: string
  valid_until: string
}

interface Carrier {
  id: number
  code: string
  name: string
  status: string
  contact_name: string
  phone: string
  email: string
  country: string
  headquarters: string
  on_time_rate: number
  rating: number
  active_shipments: number
  total_shipments: number
  specialties: string[] | string
  rate_cards: RateCard[]
}

function specialties(c: Carrier): string {
  const list = Array.isArray(c.specialties) ? c.specialties : c.specialties ? [c.specialties] : []
  return list.length ? list.join(', ') : 'General freight'
}

/** The carriers this company hires, how reliable each is, and their agreed rates. */
export default function CarriersScreen() {
  const back = useBack()
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Carrier | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/carriers/')
      setCarriers(listOf<Carrier>(res.data))
    } catch {
      setCarriers([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (selected) return <CarrierDetail carrier={selected} onBack={() => setSelected(null)} />

  const active = carriers.filter((c) => c.status === 'ACTIVE').length
  const moving = carriers.reduce((s, c) => s + c.active_shipments, 0)
  const avgOnTime = carriers.length ? carriers.reduce((s, c) => s + c.on_time_rate, 0) / carriers.length : 0

  return (
    <ScreenFrame
      title="Carriers"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        carriers.length ? (
          <HeroStats
            items={[
              { label: 'Active', value: String(active) },
              { label: 'Moving now', value: String(moving) },
              { label: 'Average on time', value: `${Math.round(avgOnTime)}%` },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : carriers.length === 0 ? (
        <Empty icon="business-outline" title="No carriers yet" body="Carriers you hire appear here with their rates and record." />
      ) : (
        <Section label="All carriers">
          {carriers.map((c, i) => (
            <ListRow
              key={c.id}
              icon="business-outline"
              title={c.name}
              subtitle={`${c.headquarters || c.country} · ${specialties(c)}`}
              trailing={
                <Txt variant="bodyStrong" tone={c.on_time_rate >= 85 ? 'success' : 'warning'}>
                  {Math.round(c.on_time_rate)}%
                </Txt>
              }
              onPress={() => setSelected(c)}
              last={i === carriers.length - 1}
            />
          ))}
        </Section>
      )}
    </ScreenFrame>
  )
}

function CarrierDetail({ carrier: c, onBack }: { carrier: Carrier; onBack: () => void }) {
  return (
    <ScreenFrame
      eyebrow={c.code}
      title={c.name}
      subtitle={[c.headquarters, c.country].filter(Boolean).join(', ')}
      onBack={onBack}
      hero={
        <HeroStats
          items={[
            { label: 'On time', value: `${Math.round(c.on_time_rate)}%`, tone: c.on_time_rate < 85 ? 'warning' : undefined },
            { label: 'Rating', value: c.rating.toFixed(1) },
            { label: 'Shipments', value: String(c.total_shipments) },
          ]}
        />
      }>
      <Section label="Details">
        <KeyValue label="Status" value={<Pill label={c.status === 'ACTIVE' ? 'Active' : c.status.toLowerCase()} tone={c.status === 'ACTIVE' ? 'success' : 'neutral'} />} />
        <KeyValue label="Moving now" value={`${c.active_shipments} shipment${c.active_shipments === 1 ? '' : 's'}`} />
        <KeyValue label="Specialties" value={specialties(c)} last />
      </Section>

      <Section label="Contact">
        <KeyValue label="Person" value={c.contact_name || '—'} />
        {c.phone ? (
          <ListRow icon="call-outline" title={c.phone} subtitle="Call" onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`)} />
        ) : null}
        {c.email ? (
          <ListRow icon="mail-outline" title={c.email} subtitle="Email" onPress={() => Linking.openURL(`mailto:${c.email}`)} last />
        ) : null}
      </Section>

      {c.rate_cards?.length ? (
        <Section label="Agreed rates">
          {c.rate_cards.map((r, i) => (
            <ListRow
              key={r.id}
              title={`${r.origin} → ${r.destination}`}
              subtitle={`From ${money(r.min_charge, r.currency)} · until ${day(r.valid_until)}`}
              last={i === c.rate_cards.length - 1}
            />
          ))}
        </Section>
      ) : (
        <View />
      )}
    </ScreenFrame>
  )
}
