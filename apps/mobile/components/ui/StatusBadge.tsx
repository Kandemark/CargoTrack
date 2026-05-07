import { View, Text } from 'react-native'
import { SHIPMENT_STATUS_COLORS, ALERT_SEVERITY_COLORS, SHIPMENT_STATUS_LABELS } from '@shared/utils/statusColors'
import type { ShipmentStatus, AlertSeverity } from '@shared/api/types'
import { cn } from '@/lib/utils'

type BadgeSize = 'sm' | 'md'

interface StatusBadgeProps {
  status: ShipmentStatus | AlertSeverity | string
  label?: string
  size?: BadgeSize
  className?: string
}

function isShipment(s: string): s is ShipmentStatus {
  return s in SHIPMENT_STATUS_COLORS
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

export default function StatusBadge({ status, label, size = 'md', className }: StatusBadgeProps) {
  const colors = getColor(status)
  const displayLabel = label ?? getLabel(status, status)

  if (!colors) {
    return (
      <View className={cn('flex-row items-center', className)}>
        <Text className="text-ct-base text-ct-text-muted">{displayLabel}</Text>
      </View>
    )
  }

  const dotSize = size === 'sm' ? 6 : 8
  const textSize = size === 'sm' ? 'text-ct-xs' : 'text-ct-sm'
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  return (
    <View
      className={cn('flex-row items-center rounded-full self-start', padding, className)}
      style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
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
      <Text style={{ color: colors.text, fontSize: size === 'sm' ? 10 : 11, fontWeight: '700' }}>
        {displayLabel}
      </Text>
    </View>
  )
}
