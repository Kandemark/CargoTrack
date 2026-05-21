import { View, Text } from 'react-native'
import { riskLevel } from '@shared/utils/statusColors'
import type { CarrierPerformance } from '@shared/api/types'
import { useAppTheme } from '@/lib/useAppTheme'

export default function CarrierRow({ c }: { c: CarrierPerformance }) {
  const { colors, font, isDark } = useAppTheme()
  const highRisk = c.avg_risk > 0.5

  return (
    <View style={{
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      marginBottom: 2,
      backgroundColor: highRisk ? (isDark ? 'rgba(239,68,68,0.2)' : '#FEF2F2') : 'transparent',
    }}>
      <Text style={{ flex: 2, fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text }} numberOfLines={1}>
        {c.carrier_name}
      </Text>
      <Text style={{ flex: 1, fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' }}>
        {c.shipment_count}
      </Text>
      <Text style={{ flex: 1, fontSize: font.size.sm, fontWeight: font.weight.bold, textAlign: 'center', color: riskLevel(c.avg_risk).color }}>
        {Math.round(c.avg_risk * 100)}%
      </Text>
      <Text style={{ flex: 1, fontSize: font.size.sm, color: colors.textMuted, textAlign: 'right' }}>
        {c.on_time}
      </Text>
    </View>
  )
}
