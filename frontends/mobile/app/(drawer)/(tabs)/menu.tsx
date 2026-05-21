/**
 * Menu tab — immediately opens the drawer.
 * The GlassTabBar handles the drawer dispatch on press;
 * this screen exists so Expo Router registers the route.
 */
import { useEffect } from 'react'
import { View } from 'react-native'
import { DrawerActions, useNavigation } from '@react-navigation/native'

export default function MenuScreen() {
  const navigation = useNavigation()

  useEffect(() => {
    // Open drawer on mount — this handles deep-link and programmatic navigation
    const timer = setTimeout(() => {
      navigation.dispatch(DrawerActions.openDrawer())
    }, 0)
    return () => clearTimeout(timer)
  }, [navigation])

  return <View style={{ flex: 1, backgroundColor: '#0a1929' }} />
}
