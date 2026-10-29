import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Plain-HTTP traffic is allowed only in builds whose API address is not
 * HTTPS, i.e. development builds talking to a local server. Builds for
 * real users point at HTTPS and keep Android's default block on cleartext.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const allowCleartext = !apiUrl.startsWith('https://')

/**
 * APP_VARIANT=dev builds "CargoTrack Dev": a development client with its
 * own package name, installed next to the real app instead of replacing it,
 * for working on screens with instant reload. Never given to users.
 */
const isDevVariant = process.env.APP_VARIANT === 'dev'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ...(isDevVariant && {
    name: 'CargoTrack Dev',
    scheme: 'cargotrack-dev',
    android: { ...config.android, package: 'com.cargotrack.app.dev' },
    ios: { ...config.ios, bundleIdentifier: 'com.cargotrack.app.dev' },
  }),
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', { android: { usesCleartextTraffic: allowCleartext } }],
  ],
  extra: {
    ...config.extra,
    EXPO_PUBLIC_PROJECT_ID: process.env.EXPO_PUBLIC_PROJECT_ID ?? config.extra?.eas?.projectId,
  },
})
