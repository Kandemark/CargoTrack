import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import Svg, { Line, Polyline, Rect } from 'react-native-svg'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { listOf } from '@/lib/data'
import { timeAgo } from '@shared/utils/formatters'
import { Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section, Txt } from '@/components/ui'

interface Reading {
  id: number
  timestamp: string
  temperature_c: number
  humidity_pct: number | null
}

interface ColdShipment {
  id: number
  shipment: number
  product_type: string
  temp_min_c: number
  temp_max_c: number
  monitoring_device_id: string
  recent_readings: Reading[]
  active_excursion: unknown | null
  certificate: { certificate_id?: string } | null
}

interface ShipmentRef {
  id: number
  tracking_number: string
  route: { origin: string; destination: string }
}

const PRODUCT: Record<string, string> = {
  PHARMA: 'Medicines',
  VACCINES: 'Vaccines',
  FLOWERS: 'Fresh flowers',
  VEGETABLES: 'Fresh vegetables',
  FRUITS: 'Fresh fruit',
  MEAT: 'Chilled or frozen meat',
  FISH: 'Chilled or frozen fish',
  DAIRY: 'Dairy',
}

function latest(c: ColdShipment): Reading | undefined {
  return [...(c.recent_readings ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
}

function outOfRange(c: ColdShipment, t: number) {
  return t < c.temp_min_c || t > c.temp_max_c
}

/** Temperature-controlled cargo: the current reading against its allowed range. */
export default function ColdChainScreen() {
  const back = useBack()
  const [items, setItems] = useState<ColdShipment[]>([])
  const [refs, setRefs] = useState<Record<number, ShipmentRef>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<ColdShipment | null>(null)

  const load = useCallback(async () => {
    try {
      const [cc, sh] = await Promise.all([
        apiClient.get('/api/v1/coldchain/coldchain/'),
        apiClient.get('/api/v1/shipments/', { params: { page_size: 100 } }),
      ])
      setItems(listOf<ColdShipment>(cc.data))
      setRefs(Object.fromEntries(listOf<ShipmentRef>(sh.data).map((s) => [s.id, s])))
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const name = (c: ColdShipment) => {
    const s = refs[c.shipment]
    return s ? `${s.route.origin} → ${s.route.destination}` : `Shipment ${c.shipment}`
  }

  if (selected) {
    const c = selected
    const now = latest(c)
    const bad = now ? outOfRange(c, now.temperature_c) : false
    return (
      <ScreenFrame
        eyebrow={refs[c.shipment]?.tracking_number}
        title={name(c)}
        subtitle={PRODUCT[c.product_type] ?? c.product_type}
        onBack={() => setSelected(null)}
        hero={
          <HeroStats
            items={[
              { label: 'Now', value: now ? `${now.temperature_c.toFixed(1)}°C` : '—', tone: bad ? 'danger' : undefined },
              { label: 'Allowed', value: `${c.temp_min_c}–${c.temp_max_c}°C` },
              { label: 'Humidity', value: now?.humidity_pct != null ? `${Math.round(now.humidity_pct)}%` : '—' },
            ]}
          />
        }>
        <Section label="Last 12 hours">
          <TempChart c={c} />
        </Section>
        <Section label="Monitoring">
          <KeyValue label="Status" value={<Pill label={c.active_excursion || bad ? 'Out of range' : 'In range'} tone={c.active_excursion || bad ? 'danger' : 'success'} />} />
          <KeyValue label="Last reading" value={now ? timeAgo(now.timestamp) : 'None yet'} />
          <KeyValue label="Logger" value={c.monitoring_device_id || '—'} />
          <KeyValue label="Certificate" value={c.certificate?.certificate_id ?? 'Not issued yet'} last />
        </Section>
        <ListRow icon="cube-outline" title="Open the shipment" onPress={() => router.push(`/(drawer)/shipment/${c.shipment}` as any)} last />
      </ScreenFrame>
    )
  }

  const out = items.filter((c) => c.active_excursion || (latest(c) && outOfRange(c, latest(c)!.temperature_c))).length

  return (
    <ScreenFrame
      title="Cold chain"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        items.length ? (
          <HeroStats
            items={[
              { label: 'Monitored', value: String(items.length) },
              { label: 'In range', value: String(items.length - out) },
              { label: 'Out of range', value: String(out), tone: out ? 'danger' : undefined },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty icon="thermometer-outline" title="No temperature-controlled cargo" body="Shipments with a temperature logger show their readings here." />
      ) : (
        <Section label="Shipments">
          {items.map((c, i) => {
            const now = latest(c)
            const bad = now ? outOfRange(c, now.temperature_c) : false
            return (
              <ListRow
                key={c.id}
                icon="thermometer-outline"
                title={name(c)}
                subtitle={`${PRODUCT[c.product_type] ?? c.product_type} · allowed ${c.temp_min_c}–${c.temp_max_c}°C`}
                trailing={
                  <Txt variant="bodyStrong" tone={bad ? 'danger' : 'success'}>
                    {now ? `${now.temperature_c.toFixed(1)}°C` : '—'}
                  </Txt>
                }
                onPress={() => setSelected(c)}
                last={i === items.length - 1}
              />
            )
          })}
        </Section>
      )}
    </ScreenFrame>
  )
}

/** Readings as a line, with the allowed band shaded behind it. */
function TempChart({ c }: { c: ColdShipment }) {
  const { colors, brand, isDark, ui } = useAppTheme()
  const pts = [...(c.recent_readings ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  if (pts.length < 2) return <Txt variant="body" tone="muted">Not enough readings yet.</Txt>
  const W = 320, H = 140, pad = 8
  const temps = pts.map((p) => p.temperature_c)
  const lo = Math.min(c.temp_min_c, ...temps) - 1
  const hi = Math.max(c.temp_max_c, ...temps) + 1
  const y = (t: number) => pad + (H - 2 * pad) * (1 - (t - lo) / (hi - lo))
  const x = (i: number) => pad + ((W - 2 * pad) * i) / (pts.length - 1)
  const line = isDark ? colors.textBrand : brand.primary
  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={y(c.temp_max_c)} width={W} height={y(c.temp_min_c) - y(c.temp_max_c)} fill={`${line}14`} />
        <Line x1={0} x2={W} y1={y(c.temp_max_c)} y2={y(c.temp_max_c)} stroke={colors.borderMid} strokeDasharray="4 4" />
        <Line x1={0} x2={W} y1={y(c.temp_min_c)} y2={y(c.temp_min_c)} stroke={colors.borderMid} strokeDasharray="4 4" />
        <Polyline points={pts.map((p, i) => `${x(i)},${y(p.temperature_c)}`).join(' ')} fill="none" stroke={line} strokeWidth={2.5} strokeLinejoin="round" />
        {pts.map((p, i) =>
          outOfRange(c, p.temperature_c) ? <Rect key={p.id} x={x(i) - 3} y={y(p.temperature_c) - 3} width={6} height={6} rx={3} fill={ui.danger} /> : null,
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Txt variant="caption" tone="faint">{new Date(pts[0].timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Txt>
        <Txt variant="caption" tone="faint">Shaded: allowed {c.temp_min_c}–{c.temp_max_c}°C</Txt>
        <Txt variant="caption" tone="faint">{new Date(pts[pts.length - 1].timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Txt>
      </View>
    </View>
  )
}
