import { View, type ViewProps } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'

interface SheetHandleProps {
  style?: ViewProps['style']
}

export default function SheetHandle({ style }: SheetHandleProps) {
  const { colors } = useAppTheme()

  return (
    <View style={[{ alignItems: 'center', paddingTop: 8, paddingBottom: 12 }, style]}>
      <View style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: colors.borderMid }} />
    </View>
  )
}
