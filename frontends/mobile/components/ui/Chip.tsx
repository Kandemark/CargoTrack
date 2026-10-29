import { Pressable } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/** A selectable filter. Selected: navy in light mode, orange in dark mode. */
export default function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { brand, colors, isDark } = useAppTheme()
  const on = isDark ? brand.accent : brand.primary
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexShrink: 0,
        height: 38,
        paddingHorizontal: 16,
        borderRadius: 19,
        justifyContent: 'center',
        backgroundColor: selected ? on : colors.muted,
        opacity: pressed ? 0.75 : 1,
      })}>
      <Txt variant="caption" numberOfLines={1} style={{ fontFamily: 'DMSans-SemiBold', color: selected ? '#FFFFFF' : colors.textSecondary }}>
        {label}
      </Txt>
    </Pressable>
  )
}
