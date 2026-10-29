import { View } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/**
 * A status as a word on a soft tint of its colour. Five tones cover every
 * status in the app, so the same meaning always has the same colour.
 */
export default function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const color = usePillColor(tone)
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${color}22`, alignSelf: 'flex-start' }}>
      <Txt variant="caption" numberOfLines={1} style={{ color, fontFamily: 'DMSans-SemiBold' }}>
        {label}
      </Txt>
    </View>
  )
}

export function usePillColor(tone: PillTone): string {
  const { ui, status, colors, isDark, brand } = useAppTheme()
  return {
    success: status.delivered,
    warning: status.customs,
    danger: ui.danger,
    info: isDark ? colors.textBrand : brand.primary,
    neutral: colors.textMuted,
  }[tone]
}
