import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import type { Alert as AlertType, AlertSeverity } from '@shared/api/types'

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; bg: string; text: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  CRITICAL: { label: 'Critical', bg: '#fef2f2', text: '#dc2626', icon: 'alert-circle' },
  HIGH:     { label: 'High',     bg: '#fff7ed', text: '#ea580c', icon: 'warning' },
  MEDIUM:   { label: 'Medium',   bg: '#fffbeb', text: '#d97706', icon: 'information-circle' },
  LOW:      { label: 'Low',      bg: '#f0fdf4', text: '#16a34a', icon: 'checkmark-circle' },
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.LOW
  return (
    <View className="flex-row items-center gap-1.5"
      style={{ backgroundColor: cfg.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Ionicons name={cfg.icon} size={11} color={cfg.text} />
      <Text style={{ color: cfg.text, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
    </View>
  )
}

function AlertCard({
  item,
  onAcknowledge,
}: {
  item: AlertType
  onAcknowledge: (id: number) => void
}) {
  const cfg = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.LOW
  const date = new Date(item.sent_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <View
      className="bg-white mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
        borderLeftWidth: 3,
        borderLeftColor: cfg.text,
      }}
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between mb-2">
          <SeverityBadge severity={item.severity} />
          <Text className="text-gray-400 text-xs">{date}</Text>
        </View>
        <Text className="text-gray-900 text-sm font-semibold mb-1">{item.shipment_tracking}</Text>
        <Text className="text-gray-600 text-sm leading-5">{item.message}</Text>

        {!item.acknowledged && (
          <TouchableOpacity
            onPress={() => onAcknowledge(item.id)}
            className="mt-3 self-start px-3 py-1.5 rounded-lg bg-ct-navy active:opacity-70"
          >
            <Text className="text-white text-xs font-semibold">Acknowledge</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default function AlertsScreen() {
  const [alerts, setAlerts]       = useState<AlertType[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await apiClient.get<AlertType[] | { results: AlertType[] }>('/api/v1/alerts/')
      const raw = res.data
      setAlerts(Array.isArray(raw) ? raw : (raw as any).results ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAcknowledge = (id: number) => {
    Alert.alert('Acknowledge Alert', 'Mark this alert as acknowledged?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acknowledge',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/api/v1/alerts/${id}/acknowledge/`)
            setAlerts(prev => prev.filter(a => a.id !== id))
          } catch {
            Alert.alert('Error', 'Failed to acknowledge alert.')
          }
        },
      },
    ])
  }

  const unacked = alerts.filter(a => !a.acknowledged)
  const acked   = alerts.filter(a => a.acknowledged)

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-14 pb-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold">Alerts</Text>
          {unacked.length > 0 && (
            <View className="bg-ct-orange rounded-full px-2.5 py-0.5">
              <Text className="text-white text-xs font-bold">{unacked.length}</Text>
            </View>
          )}
        </View>
        <Text className="text-blue-300 text-xs mt-1">
          {unacked.length} unacknowledged · {acked.length} resolved
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f5801e" />
        </View>
      ) : (
        <FlatList
          data={[...unacked, ...acked]}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <AlertCard item={item} onAcknowledge={handleAcknowledge} />
          )}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#f5801e" />
          }
          ListHeaderComponent={
            unacked.length > 0 ? (
              <Text className="px-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Requires attention
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="checkmark-circle-outline" size={44} color="#86efac" />
              <Text className="text-gray-500 font-semibold mt-3">All clear!</Text>
              <Text className="text-gray-400 text-sm mt-1">No active alerts</Text>
            </View>
          }
        />
      )}
    </View>
  )
}
