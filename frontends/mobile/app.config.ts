import type { ExpoConfig } from '@expo/config-types'
import appJson from './app.json'

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const isProductionBuild = apiUrl.startsWith('https://')

const base = appJson.expo as any

const config: ExpoConfig = {
  ...base,
  android: {
    ...base.android,
    usesCleartextTraffic: !isProductionBuild,
  },
  extra: {
    ...base.extra,
    EXPO_PUBLIC_PROJECT_ID: process.env.EXPO_PUBLIC_PROJECT_ID ?? base.extra?.eas?.projectId,
  },
}

export default config
