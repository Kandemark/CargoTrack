import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ScreenHeader from './ScreenHeader'
import { T } from '@/lib/theme'

export default function PlaceholderScreen({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  const L = T.light
  return (
    <View style={{ flex: 1, backgroundColor: L.surface.background }}>
      <ScreenHeader title={title} subtitle={subtitle} backButton />
      <View style={styles.center}>
        <View style={[styles.iconBox, { backgroundColor: L.surface.muted }]}>
          <Ionicons name={icon ?? 'construct-outline'} size={36} color={L.text.faint} />
        </View>
        <Text style={[styles.heading, { color: L.text.muted }]}>Coming Soon</Text>
        <Text style={[styles.body, { color: L.text.faint }]}>
          This feature is under development and will be available in an upcoming update.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
})
