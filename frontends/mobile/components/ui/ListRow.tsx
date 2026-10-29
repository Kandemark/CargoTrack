import type { ComponentProps, ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/**
 * One line of a list: optional icon, title, a quieter second line, and a
 * value or status on the right. Rows are separated by a hairline, never
 * boxed, so a list reads as one calm block.
 */
export default function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  trailing,
  onPress,
  last = false,
  subtitleLines = 2,
}: {
  icon?: ComponentProps<typeof Ionicons>['name']
  iconColor?: string
  title: string
  subtitle?: string
  trailing?: ReactNode
  onPress?: () => void
  last?: boolean
  subtitleLines?: number
}) {
  const { colors, brand, isDark } = useAppTheme()
  // Navy disappears on the dark sheet; the light brand blue reads on both.
  const tint = iconColor ?? (isDark ? colors.textBrand : brand.primary)
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
      }}>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${tint}1A`,
          }}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={subtitleLines} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {typeof trailing === 'string' ? <Txt variant="bodyStrong">{trailing}</Txt> : trailing}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  )
}
