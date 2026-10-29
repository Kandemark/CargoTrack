import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Plain-HTTP traffic is allowed only in builds whose API address is not
 * HTTPS, i.e. development builds talking to a local server. Builds for
 * real users point at HTTPS and keep Android's default block on cleartext.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const allowCleartext = !apiUrl.startsWith('https://')

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', { android: { usesCleartextTraffic: allowCleartext } }],
  ],
  extra: {
    ...config.extra,
    EXPO_PUBLIC_PROJECT_ID: process.env.EXPO_PUBLIC_PROJECT_ID ?? config.extra?.eas?.projectId,
  },
})
