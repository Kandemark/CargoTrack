import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { day, listOf, money } from '@/lib/data'
import { Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section } from '@/components/ui'

interface RateCard {
  id: number
  carrier_name: string
  name: string
  status: string
  origin: string
  destination: string
  cargo_type: string
  per_kg: string
  per_km: string
  min_charge: string
  currency: string
  is_hazmat: boolean
  is_reefer: boolean
  valid_from: string
  valid_until: string
}

/** Prices agreed with carriers for each lane; tap one for the full terms. */
export default function RatesScreen() {
  const back = useBack()
  const [rates, setRates] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<RateCard | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/rate-cards/')
      setRates(listOf<RateCard>(res.data))
    } catch {
      setRates([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (selected) {
    const r = selected
    return (
      <ScreenFrame eyebrow={r.carrier_name} title={`${r.origin} → ${r.destination}`} subtitle={r.name} onBack={() => setSelected(null)}>
        <Section label="Price">
          <KeyValue label="Minimum charge" value={money(r.min_charge, r.currency)} />
          <KeyValue label="Per kilogram" value={money(r.per_kg, r.currency)} />
          <KeyValue label="Per kilometre" value={money(r.per_km, r.currency)} last />
        </Section>
        <Section label="Terms">
          <KeyValue label="Cargo" value={r.cargo_type} />
          <KeyValue label="Hazardous goods" value={r.is_hazmat ? 'Allowed' : 'No'} />
          <KeyValue label="Refrigerated" value={r.is_reefer ? 'Yes' : 'No'} />
          <KeyValue label="Valid" value={`${day(r.valid_from)} to ${day(r.valid_until)}`} last />
        </Section>
      </ScreenFrame>
    )
  }

  const active = rates.filter((r) => r.status === 'ACTIVE')
  const expiringSoon = active.filter((r) => new Date(r.valid_until).getTime() - Date.now() < 30 * 86_400_000).length
  const lanes = new Set(rates.map((r) => `${r.origin}-${r.destination}`)).size

  return (
    <ScreenFrame
      title="Rate cards"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        rates.length ? (
          <HeroStats
            items={[
              { label: 'Active', value: String(active.length) },
              { label: 'Lanes', value: String(lanes) },
              { label: 'Expire in 30 days', value: String(expiringSoon), tone: expiringSoon ? 'warning' : undefined },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : rates.length === 0 ? (
        <Empty icon="pricetags-outline" title="No rate cards yet" body="Rates agreed with your carriers appear here." />
      ) : (
        <Section label="All rates">
          {rates.map((r, i) => (
            <ListRow
              key={r.id}
              title={`${r.origin} → ${r.destination}`}
              subtitle={`${r.carrier_name} · from ${money(r.min_charge, r.currency)}`}
              trailing={r.status === 'ACTIVE' ? undefined : <Pill label={r.status.toLowerCase()} tone="neutral" />}
              onPress={() => setSelected(r)}
              last={i === rates.length - 1}
            />
          ))}
        </Section>
      )}
      <View />
    </ScreenFrame>
  )
}
