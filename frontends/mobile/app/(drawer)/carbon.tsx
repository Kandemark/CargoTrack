import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { useAuthStore } from '@/lib/store'
import { carrierLabel } from '@/lib/carrier'
import { useAppTheme } from '@/lib/useAppTheme'
import { Empty, HeroStats, ListRow, Loading, Pill, ScreenFrame, Section, Txt, type PillTone } from '@/components/ui'

interface CarbonData {
  total_kg: number
  offset_kg: number
  net_kg: number
  monthly: { month: string; emissions: number; offset: number }[]
  by_carrier: { name: string; total_kg: number; shipments: number; grade: string }[]
}

const GRADE: Record<string, PillTone> = { 'A+': 'success', A: 'success', B: 'info', C: 'warning', D: 'warning', E: 'danger', F: 'danger' }

/** Tonnes, or kilograms below one tonne. */
function weight(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`
}

/** Emissions from road freight, what was offset, and which carriers emit most. */
export default function CarbonScreen() {
  const back = useBack()
  const ownOrg = useAuthStore((s) => s.user?.org_name)
  const [data, setData] = useState<CarbonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<CarbonData>('/api/v1/carbon/')
      setData(res.data)
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  return (
    <ScreenFrame
      title="Carbon"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        data ? (
          <HeroStats
            items={[
              { label: 'Emitted', value: weight(data.total_kg) },
              { label: 'Offset', value: weight(data.offset_kg) },
              { label: 'Net', value: weight(data.net_kg) },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : !data || data.total_kg === 0 ? (
        <Empty icon="leaf-outline" title="No emissions recorded yet" body="Emissions are worked out from distance and weight once shipments move." />
      ) : (
        <>
          <Section label="Last six months">
            <MonthBars months={data.monthly.slice(-6)} />
          </Section>
          <Section label="By carrier">
            {data.by_carrier.map((c, i) => (
              <ListRow
                key={c.name}
                title={carrierLabel(c.name, ownOrg)}
                subtitle={`${weight(c.total_kg)} · ${c.shipments} shipment${c.shipments === 1 ? '' : 's'}`}
                trailing={<Pill label={`Grade ${c.grade}`} tone={GRADE[c.grade] ?? 'neutral'} />}
                last={i === data.by_carrier.length - 1}
              />
            ))}
          </Section>
        </>
      )}
    </ScreenFrame>
  )
}

function MonthBars({ months }: { months: CarbonData['monthly'] }) {
  const { colors, brand, isDark, status } = useAppTheme()
  const max = Math.max(1, ...months.map((m) => m.emissions))
  const bar = isDark ? colors.textBrand : brand.primary
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 10 }}>
        {months.map((m, i) => (
          <View key={`${m.month}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <View style={{ width: '70%', maxWidth: 36, height: `${Math.max((m.emissions / max) * 100, 2)}%`, borderRadius: 6, backgroundColor: m.emissions ? bar : colors.border, overflow: 'hidden', justifyContent: 'flex-end' }}>
              {m.offset ? <View style={{ height: `${(m.offset / Math.max(m.emissions, 1)) * 100}%`, backgroundColor: status.delivered }} /> : null}
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        {months.map((m, i) => (
          <Txt key={`${m.month}-l${i}`} variant="caption" tone="faint" style={{ flex: 1, textAlign: 'center' }}>{m.month}</Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        <Legend color={bar} label="Emitted" />
        <Legend color={status.delivered} label="Offset" />
      </View>
    </View>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="caption" tone="muted">{label}</Txt>
    </View>
  )
}
