import { useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore, useAlertStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import SwipeableAlertCard from '@/components/SwipeableAlertCard'
import { EmptyState, SectionLabel, GlassCard, Skeleton } from '@/components/ui'

export default function AlertsScreen() {
  const user = useAuthStore((s) => s.user)
  const { alerts, isLoading, fetchAlerts, acknowledgeLocal } = useAlertStore()
  const { colors, font, spacing, radius } = useAppTheme()
  const canAcknowledge = user?.role === 'LOGISTICS_MGR' || user?.role === 'ADMIN'

  const load = useCallback((isRefresh = false) => {
    void fetchAlerts(apiClient)
  }, [fetchAlerts])

  useEffect(() => { load() }, [load])

  async function handleAcknowledge(id: number) {
    Alert.alert('Acknowledge Alert', 'Mark this alert as acknowledged?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acknowledge',
        onPress: async () => {
          try {
            await apiClient.post(`/api/v1/alerts/${id}/acknowledge/`)
            acknowledgeLocal(id)
          } catch {
            Alert.alert('Error', 'Could not acknowledge this alert.')
          }
        },
      },
    ])
  }

  const unacked = alerts.filter((a) => !a.acknowledged)
  const acked = alerts.filter((a) => a.acknowledged)
  const allSorted = [...unacked, ...acked]

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={s.flex1}>
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#ef4444" accentPosition="left" style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: 8 }}>
          <View style={{ padding: spacing.lg }}>
            <View style={[s.rowSpaceBetween, { marginBottom: 4 }]}>
              <Text style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: colors.text }}>Alerts</Text>
              {unacked.length > 0 && (
                <View style={{ backgroundColor: '#f5801e', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: '#ffffff' }}>{unacked.length} new</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: font.size.sm, color: colors.textMuted }}>
              {unacked.length === 0 && acked.length === 0
                ? 'No alerts'
                : `${unacked.length} unacknowledged · ${acked.length} resolved`}
              {canAcknowledge && unacked.length > 0 ? ' · swipe left to ack' : ''}
            </Text>
          </View>
        </GlassCard>

        {isLoading && alerts.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Skeleton variant="alert-list" />
          </View>
        ) : (
          <FlatList
            data={allSorted}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <SwipeableAlertCard item={item} canAcknowledge={canAcknowledge} onAcknowledge={handleAcknowledge} />
            )}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => load(true)} tintColor="#f5801e" />}
            ListHeaderComponent={
              unacked.length > 0 ? <SectionLabel label="Requires attention" style={{ paddingHorizontal: 20, marginBottom: 6 }} /> : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="checkmark-done"
                title="All clear"
                description="No active alerts right now"
                size="lg"
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  rowSpaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
