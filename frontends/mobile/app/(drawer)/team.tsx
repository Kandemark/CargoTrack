import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { formatDate } from '@shared/utils/formatters'

interface TeamMember {
  id: number; username: string; email: string; first_name: string; last_name: string
  role: string; role_display: string; org_name: string; date_joined: string
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#dc2626',
  LOGISTICS_MGR: '#0f2d5e',
  CARRIER: '#2563eb',
  CLIENT: '#7c3aed',
  DISPATCHER: '#0891b2',
  CUSTOMS_BROKER: '#b45309',
  WAREHOUSE_MGR: '#16a34a',
  PORT_AGENT: '#0f766e',
  FINANCE_OFFICER: '#9333ea',
}

export default function TeamScreen() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<TeamMember[]>('/api/v1/accounts/users/'); setMembers(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    members.forEach(m => { counts[m.role_display] = (counts[m.role_display] || 0) + 1 })
    return counts
  }, [members])

  const totalUsers = members.length

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Team" backButton />
      <FlatList
        data={members}
        keyExtractor={(m) => String(m.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          totalUsers > 0 ? (
            <View style={{ marginBottom: 12 }}>
              {/* Total users */}
              <View style={[s.statMain, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={22} color={brand.primary} />
                <Text style={[s.statMainVal, { color: colors.text }]}>{totalUsers}</Text>
                <Text style={{ fontSize: font.size.sm, color: colors.textMuted, fontWeight: '600' }}>Total Users</Text>
              </View>
              {/* Role breakdown */}
              <View style={s.roleGrid}>
                {Object.entries(roleCounts).map(([role, count]) => (
                  <View key={role} style={[s.roleChip, { backgroundColor: colors.muted }]}>
                    <View style={[s.roleDot, { backgroundColor: ROLE_COLORS[Object.keys(ROLE_COLORS).find(k => role.toUpperCase().includes(k)) ?? ''] ?? brand.primary }]} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{role}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.text }}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : !loading ? null : (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={brand.primary} />
              <Text style={{ color: colors.textFaint, fontSize: font.size.sm, marginTop: 12 }}>Loading team...</Text>
            </View>
          )
        }
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No team members</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const fullName = `${item.first_name} ${item.last_name}`.trim() || item.username
          const initials = `${item.first_name.charAt(0)}${item.last_name.charAt(0)}`.toUpperCase()
          const roleColor = ROLE_COLORS[item.role] ?? brand.primary
          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.avatar, { backgroundColor: roleColor }]}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{fullName}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.email}</Text>
                </View>
                <View style={[s.roleBadge, { backgroundColor: roleColor + '18' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: roleColor }}>{item.role_display}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>{item.org_name || 'No org'}</Text>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>Joined {formatDate(item.date_joined)}</Text>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  statMain: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: 'center', marginBottom: 10 },
  statMainVal: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
})
