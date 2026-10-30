import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { day, listOf } from '@/lib/data'
import { Empty, HeroStats, ListRow, Loading, ScreenFrame, Section } from '@/components/ui'

interface Member {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  role_display: string
  date_joined: string
}

/** People in the organisation, grouped by what they do. Tap one to email them. */
export default function TeamScreen() {
  const back = useBack()
  const [people, setPeople] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/accounts/users/')
      setPeople(listOf<Member>(res.data))
      setDenied(false)
    } catch (e: unknown) {
      setDenied((e as { response?: { status?: number } })?.response?.status === 403)
      setPeople([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const roles = [...new Set(people.map((p) => p.role_display))].sort()

  return (
    <ScreenFrame
      title="Team"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={people.length ? <HeroStats items={[{ label: 'People', value: String(people.length) }, { label: 'Roles', value: String(roles.length) }]} /> : null}>
      {loading ? (
        <Loading />
      ) : denied ? (
        <Empty icon="lock-closed-outline" title="Administrators only" body="Ask an administrator to add or change team members." />
      ) : people.length === 0 ? (
        <Empty icon="people-outline" title="Just you so far" body="Invite colleagues from the web app." />
      ) : (
        roles.map((r) => {
          const group = people.filter((p) => p.role_display === r)
          return (
            <Section key={r} label={r}>
              {group.map((p, i) => (
                <ListRow
                  key={p.id}
                  icon="person-outline"
                  title={`${p.first_name} ${p.last_name}`.trim() || p.username}
                  subtitle={`${p.email} · joined ${day(p.date_joined)}`}
                  onPress={p.email ? () => Linking.openURL(`mailto:${p.email}`) : undefined}
                  last={i === group.length - 1}
                />
              ))}
            </Section>
          )
        })
      )}
    </ScreenFrame>
  )
}
