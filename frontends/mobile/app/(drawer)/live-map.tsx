import { View } from 'react-native'
import CargoTrackMap from '@/components/CargoTrackMap'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

export default function LiveMapScreen() {
  const { colors } = useAppTheme()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Live Map" backButton />
      <View style={{ flex: 1 }}>
        <CargoTrackMap />
      </View>
    </View>
  )
}
