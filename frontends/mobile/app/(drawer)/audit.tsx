import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { listOf } from '@/lib/data'
import { formatDateTime } from '@shared/utils/formatters'
import { Empty, ListRow, Loading, ScreenFrame, Section } from '@/components/ui'

interface Entry {
  id: number
  username: string
  full_name: string
  action: string
  model_name: string
  object_id: number
  changes: string
  created_at: string
}

/** Who changed what and when, newest first, for audits and disputes. */
export default function AuditScreen() {
  const back = useBack()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/audit/', { params: { page_size: 100 } })
      setEntries(listOf<Entry>(res.data))
      setDenied(false)
    } catch (e: unknown) {
      setDenied((e as { response?: { status?: number } })?.response?.status === 403)
      setEntries([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  return (
    <ScreenFrame
      title="Audit log"
      subtitle="Every change, newest first"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      {loading ? (
        <Loading />
      ) : denied ? (
        <Empty icon="lock-closed-outline" title="Administrators only" body="Ask an administrator for the audit log." />
      ) : entries.length === 0 ? (
        <Empty icon="reader-outline" title="No changes recorded yet" />
      ) : (
        <Section label="Changes">
          {entries.map((e, i) => (
            <ListRow
              key={e.id}
              icon="create-outline"
              title={`${e.full_name || e.username} ${e.action.toLowerCase()} ${e.model_name} ${e.object_id}`}
              subtitle={`${formatDateTime(e.created_at)}${e.changes ? ` · ${e.changes}` : ''}`}
              subtitleLines={3}
              last={i === entries.length - 1}
            />
          ))}
        </Section>
      )}
    </ScreenFrame>
  )
}
