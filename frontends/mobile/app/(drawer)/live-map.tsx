import { Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import CargoTrackMap from '@/components/CargoTrackMap'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'

/** The whole map, edge to edge, with only a back button over it. */
export default function LiveMapScreen() {
  const back = useBack()
  const { brand } = useAppTheme()
  return (
    <View style={{ flex: 1, backgroundColor: brand.primary }}>
      <CargoTrackMap />
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ margin: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center', elevation: 6 }}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </View>
  )
}
