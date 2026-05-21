import { View, Text, type ViewProps } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'

interface LoadBarProps {
  current: number
  max: number
  unit?: string
  label?: string
  style?: ViewProps['style']
}

function barColor(pct: number): string {
  if (pct >= 90) return T.color.ui.danger
  if (pct >= 70) return T.color.risk.medium
  return T.color.ui.success
}

export default function LoadBar({ current, max, unit = '%', label, style }: LoadBarProps) {
  const { colors, font } = useAppTheme()
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  const clamped = Math.min(pct, 100)
  const barClr = barColor(clamped)

  return (
    <View style={[{ width: '100%' }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        {label && (
          <Text style={{
            fontSize: font.size.xs,
            color: colors.textMuted,
            fontWeight: font.weight.bold,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            {label}
          </Text>
        )}
        <Text style={{
          fontSize: font.size.xs,
          fontFamily: 'SpaceGrotesk',
          fontWeight: font.weight.bold,
          color: barClr,
        }}>
          {current}/{max}{unit !== '%' ? ` ${unit}` : unit}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 9999, backgroundColor: colors.muted, overflow: 'hidden' }}>
        <View style={{ height: '100%', borderRadius: 9999, backgroundColor: barClr, width: `${clamped}%` as any }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 1 }}>
        {[25, 50, 75].map((tick) => (
          <View
            key={tick}
            style={{
              width: 1,
              height: 6,
              borderRadius: 9999,
              backgroundColor: clamped >= tick ? colors.borderMid : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  )
}
