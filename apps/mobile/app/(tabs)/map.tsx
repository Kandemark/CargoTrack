/**
 * Legacy map route — functionality moved to the Track tab.
 * This file must remain so Expo Router does not error on the
 * hidden <Tabs.Screen name="map" options={{ href: null }} /> declaration.
 */
import { Redirect } from 'expo-router'

export default function MapRedirect() {
  return <Redirect href="/(tabs)/track" />
}
