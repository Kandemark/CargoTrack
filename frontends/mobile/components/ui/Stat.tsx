import { View } from 'react-native'
import Txt from './Txt'

/**
 * A number with its label and a short explanation, laid out in a grid of
 * two. No tinted tile behind it: colour appears only when the number
 * itself is a warning.
 */
export function Stat({
  label,
  value,
  caption,
  tone,
}: {
  label: string
  value: string
  caption?: string
  tone?: 'danger' | 'warning' | 'success'
}) {
  return (
    <View style={{ width: '50%', paddingVertical: 12, paddingRight: 12 }}>
      <Txt variant="label" tone="faint">
        {label}
      </Txt>
      <Txt variant="number" tone={tone ?? 'primary'} style={{ marginTop: 6 }}>
        {value}
      </Txt>
      {caption ? (
        <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {caption}
        </Txt>
      ) : null}
    </View>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>
}
