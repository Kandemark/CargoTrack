import { View, Text, type ViewProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import Skeleton from './Skeleton'

interface KpiCardProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; value: string }
  accent?: string
  loading?: boolean
  style?: ViewProps['style']
}

export default function KpiCard({
  icon,
  iconColor = '#0f2d5e',
  label,
  value,
  trend,
  accent,
  loading = false,
  style,
}: KpiCardProps) {
  if (loading) {
    return <Skeleton variant="card" style={{ width: 150, height: 112 }} />
  }

  const { colors, font, radius } = useAppTheme()
  const valueStr = typeof value === 'number' ? value.toLocaleString() : value

  return (
    <View style={[{
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 16,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    }, style]}>
      {accent && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          backgroundColor: accent,
        }} />
      )}
      <View style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        backgroundColor: `${iconColor}18`,
      }}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text
        style={{
          fontSize: font.size['2xl'],
          fontFamily: 'SpaceGrotesk',
          fontWeight: font.weight.bold,
          color: colors.text,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
      >
        {valueStr}
      </Text>
      <Text style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 4 }} numberOfLines={1}>
        {label}
      </Text>
      {trend && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Ionicons
            name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
            size={12}
            color={trend.direction === 'up' ? '#16A34A' : '#EF4444'}
          />
          <Text style={{
            fontSize: font.size.xs,
            fontWeight: font.weight.bold,
            marginLeft: 4,
            color: trend.direction === 'up' ? '#16A34A' : '#EF4444',
          }}>
            {trend.value}
          </Text>
        </View>
      )}
    </View>
  )
}
