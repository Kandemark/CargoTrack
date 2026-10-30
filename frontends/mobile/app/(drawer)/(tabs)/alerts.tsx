import { useEffect, useState, type ComponentProps } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore, useAlertStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { timeAgo } from '@shared/utils/formatters'
import { Chip, HeroStats, ScreenFrame, Skeleton, Txt } from '@/components/ui'
import type { Alert as AlertType, AlertSeverity } from '@shared/api/types'

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const SEVERITY_ICON: Record<AlertSeverity, ComponentProps<typeof Ionicons>['name']> = {
  CRITICAL: 'flame-outline',
  HIGH: 'warning-outline',
  MEDIUM: 'trending-up-outline',
  LOW: 'information-circle-outline',
}

type View_ = 'open' | 'handled'

/**
 * Alerts. Open ones first, most severe at the top; each says what
 * happened, to which shipment, and can be marked handled in one tap.
 * Handled ones stay in their own list as a record.
 */
export default function AlertsScreen() {
  const user = useAuthStore((s) => s.user)
  const { alerts, isLoading, fetchAlerts, acknowledgeLocal } = useAlertStore()
  const [view, setView] = useState<View_>('open')
  const [loaded, setLoaded] = useState(false)
  const canAcknowledge = user?.role === 'LOGISTICS_MGR' || user?.role === 'ADMIN'

  const load = () => fetchAlerts(apiClient).finally(() => setLoaded(true))
  useEffect(() => { load() }, [])

  async function acknowledge(id: number) {
    acknowledgeLocal(id)
    try {
      await apiClient.post(`/api/v1/alerts/${id}/acknowledge/`)
    } catch {
      Alert.alert('Could not update', 'The alert is still open. Check your connection and try again.')
      load()
    }
  }

  const open = alerts
    .filter((a) => !a.acknowledged)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.sent_at.localeCompare(a.sent_at))
  const handled = alerts.filter((a) => a.acknowledged).sort((a, b) => b.sent_at.localeCompare(a.sent_at))
  const urgent = open.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length
  const shown = view === 'open' ? open : handled

  return (
    <ScreenFrame
      title="Alerts"
      refreshing={isLoading && loaded}
      onRefresh={load}
      hero={
        loaded ? (
          <HeroStats
            items={[
              { label: 'Open', value: String(open.length) },
              { label: 'Urgent', value: String(urgent), tone: urgent > 0 ? 'danger' : undefined },
              { label: 'Handled', value: String(handled.length) },
            ]}
          />
        ) : null
      }>
      <View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Open" selected={view === 'open'} onPress={() => setView('open')} />
          <Chip label="Handled" selected={view === 'handled'} onPress={() => setView('handled')} />
        </View>

        <View style={{ marginTop: 8 }}>
          {!loaded ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              <Skeleton variant="card" style={{ height: 96 }} />
              <Skeleton variant="card" style={{ height: 96 }} />
            </View>
          ) : shown.length === 0 ? (
            <Empty view={view} />
          ) : (
            shown.map((a, i) => (
              <AlertRow
                key={a.id}
                alert={a}
                last={i === shown.length - 1}
                onAcknowledge={canAcknowledge && !a.acknowledged ? () => acknowledge(a.id) : undefined}
              />
            ))
          )}
        </View>
      </View>
    </ScreenFrame>
  )
}

function Empty({ view }: { view: View_ }) {
  const { colors } = useAppTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
      <Ionicons name={view === 'open' ? 'checkmark-circle-outline' : 'archive-outline'} size={36} color={colors.textFaint} />
      <Txt variant="heading">{view === 'open' ? 'All clear' : 'Nothing handled yet'}</Txt>
      <Txt variant="body" tone="muted" style={{ textAlign: 'center' }}>
        {view === 'open'
          ? 'No shipment needs your attention right now.'
          : 'Alerts you mark as handled are kept here.'}
      </Txt>
    </View>
  )
}

function AlertRow({ alert, last, onAcknowledge }: { alert: AlertType; last: boolean; onAcknowledge?: () => void }) {
  const { colors, ui, status, isDark, brand } = useAppTheme()
  const tint = {
    CRITICAL: ui.danger,
    HIGH: ui.danger,
    MEDIUM: status.customs,
    LOW: isDark ? colors.textBrand : brand.primary,
  }[alert.severity]
  const quiet = alert.acknowledged

  return (
    <Pressable
      onPress={() => router.push(`/(drawer)/shipment/${alert.shipment}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${alert.severity_display} alert for ${alert.shipment_tracking}: ${alert.message}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: quiet ? colors.muted : `${tint}1A`,
        }}>
        <Ionicons name={quiet ? 'checkmark-done-outline' : SEVERITY_ICON[alert.severity]} size={18} color={quiet ? colors.textFaint : tint} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="caption" style={{ flex: 1, fontFamily: 'DMSans-SemiBold', color: quiet ? colors.textMuted : tint }}>
            {alert.severity_display} · {alert.shipment_tracking}
          </Txt>
          <Txt variant="caption" tone="faint">{timeAgo(alert.sent_at)}</Txt>
        </View>
        <Txt variant="body" tone={quiet ? 'muted' : 'primary'} style={{ marginTop: 4 }}>
          {alert.message}
        </Txt>
        {onAcknowledge ? (
          <Pressable
            onPress={onAcknowledge}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Mark as handled"
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              opacity: pressed ? 0.6 : 1,
            })}>
            <Ionicons name="checkmark" size={16} color={colors.textSecondary} />
            <Txt variant="caption" tone="secondary" style={{ fontFamily: 'DMSans-SemiBold' }}>
              Mark as handled
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  )
}
