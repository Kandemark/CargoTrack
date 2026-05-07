import { useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore, useAlertStore } from '@/lib/store'
import SwipeableAlertCard from '@/components/SwipeableAlertCard'
import { EmptyState, SectionLabel, GlassCard, Skeleton } from '@/components/ui'

export default function AlertsScreen() {
  const user = useAuthStore((s) => s.user)
  const { alerts, isLoading, fetchAlerts, acknowledgeLocal } = useAlertStore()
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
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <View className="flex-1">
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#ef4444" accentPosition="left" className="mx-4 mt-ct-lg mb-2">
          <View className="p-ct-lg">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-ct-xl font-extrabold text-ct-text-primary dark:text-white">Alerts</Text>
              {unacked.length > 0 && (
                <View className="bg-ct-orange rounded-full px-2.5 py-1">
                  <Text className="text-ct-sm font-extrabold text-white">{unacked.length} new</Text>
                </View>
              )}
            </View>
            <Text className="text-ct-sm text-ct-text-muted dark:text-slate-300">
              {unacked.length === 0 && acked.length === 0
                ? 'No alerts'
                : `${unacked.length} unacknowledged · ${acked.length} resolved`}
              {canAcknowledge && unacked.length > 0 ? ' · swipe left to ack' : ''}
            </Text>
          </View>
        </GlassCard>

        {isLoading && alerts.length === 0 ? (
          <View className="px-4">
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
              unacked.length > 0 ? <SectionLabel label="Requires attention" className="px-5 mb-1.5" /> : null
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
