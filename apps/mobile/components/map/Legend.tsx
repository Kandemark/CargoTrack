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
    <View style={{
      position: 'absolute',
      bottom: 112,
      left: 12,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: 'rgba(26,34,53,0.85)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    }}>
      <Text style={{
        fontSize: 9,
        fontWeight: '800',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
      }}>
        Shipment Status
      </Text>
      {STATUS_ENTRIES.map(({ label, color }) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 6, backgroundColor: color }} />
          <Text style={{ fontSize: 10, color: '#cbd5e1', fontWeight: '600' }}>{label}</Text>
        </View>
      ))}

      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 }} />

      <Text style={{
        fontSize: 9,
        fontWeight: '800',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
      }}>
        Trade Corridors
      </Text>
      {corridors.map(({ id, label, color }) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 12, height: 2, borderRadius: 1, marginRight: 6, backgroundColor: color }} />
          <Text style={{ fontSize: 10, color: '#cbd5e1', fontWeight: '600' }}>{label}</Text>
        </View>
      ))}

      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="alert-circle" size={10} color="#EF4444" style={{ marginRight: 5 }} />
        <Text style={{ fontSize: 10, color: '#f87171', fontWeight: '600' }}>High Risk (≥70%)</Text>
      </View>
    </View>
  )
}
