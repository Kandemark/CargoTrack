import { View } from 'react-native'
import { SHIPMENT_STATUS_COLORS } from '@shared/utils/statusColors'
import type { ShipmentStatus } from '@shared/api/types'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/**
 * A shipment status as a word on a soft tint of its colour, the same
 * everywhere in the app. Uses the shared status palette.
 */
export default function StatusPill({ status, label }: { status: ShipmentStatus; label: string }) {
  const { isDark } = useAppTheme()
  const c = SHIPMENT_STATUS_COLORS[status] ?? SHIPMENT_STATUS_COLORS.PENDING
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: isDark ? `${c.dot}26` : c.background,
      }}>
      <Txt variant="caption" style={{ color: isDark ? c.dot : c.text, fontFamily: 'DMSans-SemiBold' }}>
        {label}
      </Txt>
    </View>
  )
}
