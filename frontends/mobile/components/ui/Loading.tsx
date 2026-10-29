import { View } from 'react-native'
import Skeleton from './Skeleton'

/** Placeholder rows while a screen's first load is in flight. */
export default function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="card" style={{ height: 72 }} />
      ))}
    </View>
  )
}
