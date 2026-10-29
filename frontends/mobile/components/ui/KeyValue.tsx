import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/** A label on the left and its value on the right, as one line of a details list. */
export default function KeyValue({ label, value, last = false }: { label: string; value: ReactNode; last?: boolean }) {
  const { colors } = useAppTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
      }}>
      <Txt variant="body" tone="muted" style={{ flex: 1 }}>{label}</Txt>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Txt variant="bodyStrong" numberOfLines={2} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt>
      ) : (
        value
      )}
    </View>
  )
}
