import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getCorridorLegend } from './TradeCorridors'

const STATUS_ENTRIES = [
  { label: 'In Transit', color: '#2563EB' },
  { label: 'Customs',    color: '#F59E0B' },
  { label: 'Delayed',    color: '#EF4444' },
]

interface Props {
  visible?: boolean
}

export default function Legend({ visible = true }: Props) {
  if (!visible) return null

  const corridors = getCorridorLegend()

  return (
    <View className="absolute bottom-28 left-3 rounded-ct-lg px-3 py-2.5 bg-ct-dark-card/85 border border-white/[0.08]">
      {/* Status dots */}
      <Text className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[0.5px] mb-1.5">
        Shipment Status
      </Text>
      {STATUS_ENTRIES.map(({ label, color }) => (
        <View key={label} className="flex-row items-center mb-1">
          <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
          <Text className="text-ct-xs text-slate-300 font-semibold">{label}</Text>
        </View>
      ))}

      {/* Divider */}
      <View className="h-px bg-white/10 my-1.5" />

      {/* Corridors */}
      <Text className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[0.5px] mb-1.5">
        Trade Corridors
      </Text>
      {corridors.map(({ id, label, color }) => (
        <View key={id} className="flex-row items-center mb-1">
          <View className="w-3 h-0.5 rounded mr-1.5" style={{ backgroundColor: color }} />
          <Text className="text-ct-xs text-slate-300 font-semibold">{label}</Text>
        </View>
      ))}

      {/* High risk */}
      <View className="h-px bg-white/10 my-1.5" />
      <View className="flex-row items-center">
        <Ionicons name="alert-circle" size={10} color="#EF4444" style={{ marginRight: 5 }} />
        <Text className="text-ct-xs text-red-400 font-semibold">High Risk (≥70%)</Text>
      </View>
    </View>
  )
}
