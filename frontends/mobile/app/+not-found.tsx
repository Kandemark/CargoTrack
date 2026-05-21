import { Link, Stack } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'

export default function NotFoundScreen() {
  const { colors, font } = useAppTheme()

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text, fontSize: font.size.xl, fontFamily: font.family.heading, fontWeight: font.weight.bold }]}>
          This screen doesn't exist.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={{ fontSize: font.size.md, color: '#3b82f6' }}>Go to home screen</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {},
  link: {
    marginTop: 16,
    paddingVertical: 16,
  },
})
