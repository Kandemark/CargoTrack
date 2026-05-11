import { Text, View, StyleSheet } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'

export default function ModalScreen() {
  const { colors, font } = useAppTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: font.size.lg, fontFamily: font.family.heading, fontWeight: font.weight.bold, color: colors.text }}>
        Modal
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
