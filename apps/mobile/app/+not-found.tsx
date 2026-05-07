import { Link, Stack } from 'expo-router'
import { Text, View } from 'react-native'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View className="flex-1 items-center justify-center p-5 bg-ct-surface-bg dark:bg-ct-dark-bg">
        <Text className="text-ct-xl font-heading font-bold text-ct-text-primary dark:text-ct-dark-text">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-ct-md text-ct-info">Go to home screen</Text>
        </Link>
      </View>
    </>
  )
}
