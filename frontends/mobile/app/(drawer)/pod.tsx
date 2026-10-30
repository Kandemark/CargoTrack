import { useCallback, useEffect, useState } from 'react'
import { router } from 'expo-router'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { listOf } from '@/lib/data'
import { formatDateTime } from '@shared/utils/formatters'
import { Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section, type PillTone } from '@/components/ui'

interface POD {
  id: number
  shipment: number
  tracking_number: string
  verification_code: string
  delivered_at: string | null
  received_by_name: string
  received_by_phone: string
  condition: string
  verification_status: string
  notes: string
  photos: unknown[]
}

const VERIFY: Record<string, { label: string; tone: PillTone }> = {
  VERIFIED: { label: 'Verified', tone: 'success' },
  UNVERIFIED: { label: 'Not verified', tone: 'warning' },
  DISPUTED: { label: 'Disputed', tone: 'danger' },
}
const CONDITION: Record<string, string> = {
  GOOD: 'Good',
  DAMAGED: 'Damaged',
  PARTIAL: 'Partly delivered',
  SHORT: 'Short',
  REFUSED: 'Refused',
}

/** Signed-for deliveries: who received each one, in what state, and whether it is verified. */
export default function PODScreen() {
  const back = useBack()
  const [pods, setPods] = useState<POD[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<POD | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/pod/pod/')
      setPods(listOf<POD>(res.data))
    } catch {
      setPods([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (selected) {
    const p = selected
    const v = VERIFY[p.verification_status] ?? VERIFY.UNVERIFIED
    return (
      <ScreenFrame eyebrow="Proof of delivery" title={p.tracking_number} subtitle={p.delivered_at ? `Delivered ${formatDateTime(p.delivered_at)}` : undefined} onBack={() => setSelected(null)}>
        <Section label="Delivery">
          <KeyValue label="Status" value={<Pill label={v.label} tone={v.tone} />} />
          <KeyValue label="Condition" value={CONDITION[p.condition] ?? p.condition} />
          <KeyValue label="Received by" value={p.received_by_name} />
          {p.received_by_phone ? <KeyValue label="Phone" value={p.received_by_phone} /> : null}
          <KeyValue label="Photos" value={String(p.photos?.length ?? 0)} />
          <KeyValue label="Verification code" value={p.verification_code} last={!p.notes} />
          {p.notes ? <KeyValue label="Notes" value={p.notes} last /> : null}
        </Section>
        <ListRow icon="cube-outline" title="Open the shipment" onPress={() => router.push(`/(drawer)/shipment/${p.shipment}` as any)} last />
      </ScreenFrame>
    )
  }

  const verified = pods.filter((p) => p.verification_status === 'VERIFIED').length
  const issues = pods.filter((p) => p.condition !== 'GOOD' || p.verification_status === 'DISPUTED').length

  return (
    <ScreenFrame
      title="Proof of delivery"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        pods.length ? (
          <HeroStats
            items={[
              { label: 'Delivered', value: String(pods.length) },
              { label: 'Verified', value: String(verified) },
              { label: 'With issues', value: String(issues), tone: issues ? 'danger' : undefined },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : pods.length === 0 ? (
        <Empty icon="checkmark-done-outline" title="No deliveries signed for yet" body="When a driver records a delivery, the receiver and condition show here." />
      ) : (
        <Section label="Deliveries">
          {pods.map((p, i) => {
            const v = VERIFY[p.verification_status] ?? VERIFY.UNVERIFIED
            return (
              <ListRow
                key={p.id}
                title={p.tracking_number}
                subtitle={`${p.received_by_name} · ${CONDITION[p.condition] ?? p.condition}${p.delivered_at ? ` · ${new Date(p.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`}
                trailing={<Pill label={v.label} tone={v.tone} />}
                onPress={() => setSelected(p)}
                last={i === pods.length - 1}
              />
            )
          })}
        </Section>
      )}
    </ScreenFrame>
  )
}
