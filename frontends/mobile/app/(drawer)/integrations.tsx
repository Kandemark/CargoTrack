import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { listOf } from '@/lib/data'
import { timeAgo } from '@shared/utils/formatters'
import { Empty, HeroStats, ListRow, Loading, Pill, ScreenFrame, Section, type PillTone } from '@/components/ui'

interface Integration {
  id: number
  name: string
  category: string
  status: string
  api_usage_pct: number
  has_webhook: boolean
  last_sync: string | null
}

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  ACTIVE: { label: 'Connected', tone: 'success' },
  CONNECTED: { label: 'Connected', tone: 'success' },
  ERROR: { label: 'Error', tone: 'danger' },
  INACTIVE: { label: 'Off', tone: 'neutral' },
  PENDING: { label: 'Setting up', tone: 'warning' },
}

/** Outside systems CargoTrack talks to (M-Pesa, customs, ERPs) and whether each is healthy. */
export default function IntegrationsScreen() {
  const back = useBack()
  const [items, setItems] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/integrations/')
      setItems(listOf<Integration>(res.data))
      setDenied(false)
    } catch (e: unknown) {
      setDenied((e as { response?: { status?: number } })?.response?.status === 403)
      setItems([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const errors = items.filter((i) => i.status === 'ERROR').length
  const categories = [...new Set(items.map((i) => i.category))].sort()

  return (
    <ScreenFrame
      title="Integrations"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={items.length ? <HeroStats items={[{ label: 'Connected', value: String(items.length - errors) }, { label: 'Errors', value: String(errors), tone: errors ? 'danger' : undefined }]} /> : null}>
      {loading ? (
        <Loading />
      ) : denied ? (
        <Empty icon="lock-closed-outline" title="Administrators only" body="Integrations are managed by your administrator." />
      ) : items.length === 0 ? (
        <Empty icon="link-outline" title="Nothing connected yet" body="Connect payments, customs and accounting systems from the web app." />
      ) : (
        categories.map((c) => {
          const group = items.filter((i) => i.category === c)
          return (
            <Section key={c} label={c}>
              {group.map((i, n) => {
                const st = STATUS[i.status] ?? { label: i.status, tone: 'neutral' as PillTone }
                return (
                  <ListRow
                    key={i.id}
                    title={i.name}
                    subtitle={`${i.last_sync ? `synced ${timeAgo(i.last_sync)}` : 'not synced yet'} · ${Math.round(i.api_usage_pct)}% of quota${i.has_webhook ? ' · webhook on' : ''}`}
                    trailing={<Pill label={st.label} tone={st.tone} />}
                    last={n === group.length - 1}
                  />
                )
              })}
            </Section>
          )
        })
      )}
    </ScreenFrame>
  )
}
