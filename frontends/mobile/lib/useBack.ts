import { useNavigation } from '@react-navigation/native'
import { router } from 'expo-router'

/** Back to the previous screen, or Home when the screen was opened directly. */
export function useBack(): () => void {
  const navigation = useNavigation()
  return () => (navigation.canGoBack() ? navigation.goBack() : router.replace('/'))
}
