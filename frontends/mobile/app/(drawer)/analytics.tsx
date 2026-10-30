import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { money } from '@/lib/data'
import { Chip, Empty, HeroStats, ListRow, Loading, ScreenFrame, Section, Txt } from '@/components/ui'

interface Profit {
  margin_pct: number
  revenue_total: number
  cost_total: number
  profit_total: number
  monthly: { month: string; revenue: number; cost: number; profit: number }[]
  by_carrier: { carrier_name: string; revenue: number; profit: number; shipments: number; margin_pct: number }[]
}
interface RouteRow { route: string; shipment_count: number; on_time_rate: number; avg_risk: number; total_revenue: number }
interface Corridor { corridor_name: string; shipment_count: number; active: number; delayed: number; on_time_rate: number; congestion_index: number }

const ROLES = new Set(['ADMIN', 'LOGISTICS_MGR', 'FINANCE_OFFICER', 'PLATFORM_OWNER', 'WAREHOUSE_MGR'])
type Tab = 'money' | 'routes' | 'corridors'

/** Reports: what the business earned, and how each route and corridor performs. */
export default function AnalyticsScreen() {
  const back = useBack()
  const role = useAuthStore((s) => s.user?.role)
  const [profit, setProfit] = useState<Profit | null>(null)
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [corridors, setCorridors] = useState<Corridor[]>([])
  const [tab, setTab] = useState<Tab>('money')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [p, r, c] = await Promise.all([
      apiClient.get<Profit>('/api/v1/analytics/profit/').catch(() => null),
      apiClient.get<{ routes: RouteRow[] }>('/api/v1/analytics/routes/').catch(() => null),
      apiClient.get<{ corridors: Corridor[] }>('/api/v1/analytics/corridors/').catch(() => null),
    ])
    setProfit(p?.data ?? null)
    setRoutes(r?.data.routes ?? [])
    setCorridors(c?.data.corridors ?? [])
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (role && !ROLES.has(role)) {
    return (
      <ScreenFrame title="Analytics" onBack={back}>
        <Empty icon="lock-closed-outline" title="Not available for your role" body="Ask your administrator if you need reports." />
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame
      title="Analytics"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        profit ? (
          <HeroStats
            items={[
              { label: 'Revenue, KES', value: compact(profit.revenue_total) },
              { label: 'Profit, KES', value: compact(profit.profit_total), tone: profit.profit_total < 0 ? 'danger' : undefined },
              { label: 'Margin', value: `${Math.round(profit.margin_pct)}%` },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 16 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            <Chip label="Money" selected={tab === 'money'} onPress={() => setTab('money')} />
            <Chip label="Routes" selected={tab === 'routes'} onPress={() => setTab('routes')} />
            <Chip label="Corridors" selected={tab === 'corridors'} onPress={() => setTab('corridors')} />
          </ScrollView>

          {tab === 'money' ? (
            !profit || profit.revenue_total === 0 ? (
              <Empty icon="cash-outline" title="No revenue yet" body="Paid invoices count towards revenue." />
            ) : (
              <View style={{ gap: 32 }}>
                <Section label="By month">
                  <ProfitBars months={profit.monthly.slice(-6)} />
                </Section>
                <Section label="By carrier">
                  {profit.by_carrier.map((c, i) => (
                    <ListRow
                      key={c.carrier_name}
                      title={c.carrier_name}
                      subtitle={`${c.shipments} shipment${c.shipments === 1 ? '' : 's'} · ${Math.round(c.margin_pct)}% margin`}
                      trailing={money(c.profit)}
                      last={i === profit.by_carrier.length - 1}
                    />
                  ))}
                </Section>
              </View>
            )
          ) : tab === 'routes' ? (
            <Section label="On time by route">
              {routes.length === 0 ? <Empty icon="git-branch-outline" title="No routes yet" /> : routes.map((r, i) => (
                <ListRow
                  key={r.route}
                  title={r.route}
                  subtitle={`${r.shipment_count} shipment${r.shipment_count === 1 ? '' : 's'} · average delay risk ${Math.round(r.avg_risk)}%`}
                  trailing={<Txt variant="bodyStrong" tone={r.on_time_rate >= 80 ? 'success' : 'warning'}>{Math.round(r.on_time_rate)}%</Txt>}
                  last={i === routes.length - 1}
                />
              ))}
            </Section>
          ) : (
            <Section label="Trade corridors">
              {corridors.length === 0 ? <Empty icon="map-outline" title="No corridor data yet" /> : corridors.map((c, i) => (
                <ListRow
                  key={c.corridor_name}
                  title={c.corridor_name}
                  subtitle={`${c.shipment_count} shipments · ${c.active} moving · ${c.delayed} delayed · congestion ${c.congestion_index.toFixed(1)}`}
                  trailing={<Txt variant="bodyStrong" tone={c.on_time_rate >= 80 ? 'success' : 'warning'}>{Math.round(c.on_time_rate)}%</Txt>}
                  last={i === corridors.length - 1}
                />
              ))}
            </Section>
          )}
        </View>
      )}
    </ScreenFrame>
  )
}

/** 86,000 → "86k", 1,200,000 → "1.2m". */
function compact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (a >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}

function ProfitBars({ months }: { months: Profit['monthly'] }) {
  const { colors, brand, isDark, status } = useAppTheme()
  const max = Math.max(1, ...months.map((m) => m.revenue))
  const bar = isDark ? colors.textBrand : brand.primary
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 12 }}>
        {months.map((m) => (
          <View key={m.month} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{ width: '60%', height: `${Math.max((m.revenue / max) * 100, 2)}%`, backgroundColor: `${bar}55`, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <View style={{ height: `${Math.max((m.profit / Math.max(m.revenue, 1)) * 100, 0)}%`, backgroundColor: status.delivered }} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        {months.map((m) => (
          <Txt key={m.month} variant="caption" tone="faint" style={{ flex: 1, textAlign: 'center' }}>{m.month.split(' ')[0]}</Txt>
        ))}
      </View>
      <Txt variant="caption" tone="muted" style={{ marginTop: 10 }}>Full bar: revenue. Green part: profit.</Txt>
    </View>
  )
}
