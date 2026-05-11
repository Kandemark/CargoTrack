import { View, Text, type ViewProps } from 'react-native'
import { SHIPMENT_STATUS_COLORS, ALERT_SEVERITY_COLORS, SHIPMENT_STATUS_LABELS } from '@shared/utils/statusColors'
import type { ShipmentStatus, AlertSeverity } from '@shared/api/types'

type BadgeSize = 'sm' | 'md'

interface StatusBadgeProps {
  status: ShipmentStatus | AlertSeverity | string
  label?: string
  size?: BadgeSize
  style?: ViewProps['style']
}

function getColor(status: string) {
  if (status in SHIPMENT_STATUS_COLORS) return SHIPMENT_STATUS_COLORS[status as ShipmentStatus]
  if (status in ALERT_SEVERITY_COLORS) return ALERT_SEVERITY_COLORS[status as AlertSeverity]
  return undefined
}

function getLabel(status: string, fallback: string) {
  if (status in SHIPMENT_STATUS_LABELS) return SHIPMENT_STATUS_LABELS[status as ShipmentStatus]
  return fallback
}

export default function StatusBadge({ status, label, size = 'md', style }: StatusBadgeProps) {
  const colors = getColor(status)
  const displayLabel = label ?? getLabel(status, status)

  if (!colors) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
        <Text style={{ fontSize: 13, color: '#6B7280' }}>{displayLabel}</Text>
      </View>
    )
  }

  const dotSize = size === 'sm' ? 6 : 8
  const textSize = size === 'sm' ? 10 : 11
  const paddingH = size === 'sm' ? 8 : 10
  const paddingV = size === 'sm' ? 2 : 4

  return (
    <View
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 9999,
        alignSelf: 'flex-start',
        paddingHorizontal: paddingH,
        paddingVertical: paddingV,
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: 1,
      }, style]}
    >
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: colors.dot,
          marginRight: 4,
        }}
      />
      <Text style={{ color: colors.text, fontSize: textSize, fontWeight: '700' }}>
        {displayLabel}
      </Text>
    </View>
  )
}
