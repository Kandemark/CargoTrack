/**
 * mobile/lib/notifications.ts
 * Expo Push Notifications — register device token + local notification setup.
 *
 * Call `registerPushToken(apiClient)` once after successful login.
 * The token is sent to POST /api/v1/accounts/push-token/ so Django can
 * deliver notifications via the Expo Push API.
 */
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import type { AxiosInstance } from 'axios'

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})

/**
 * Request permission, get the Expo push token, and register it with the backend.
 * Safe to call multiple times — returns early if permission is denied or unavailable.
 */
export async function registerPushToken(client: AxiosInstance): Promise<void> {
  // Push tokens only work on physical devices
  if (!Device.isDevice) {
    console.log('[notifications] Skipping push registration on simulator/emulator')
    return
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Push permission denied')
    return
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cargotrack', {
      name:        'CargoTrack Alerts',
      importance:  Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:  '#f97316',
      sound:       'default',
    })
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    })

    await client.post('/api/v1/accounts/push-token/', { token, platform: Platform.OS })
    console.log('[notifications] Push token registered:', token)
  } catch (err) {
    console.warn('[notifications] Failed to register push token:', err)
  }
}
