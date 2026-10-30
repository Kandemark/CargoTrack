import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Release builds must point at hosted servers. A build with a missing,
 * plain-http or local address fails here, before it can reach a phone:
 * the previous app shipped pointing at localhost and never started.
 * Development (`expo start`) may use local addresses.
 */
function assertReleaseConfig() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (!profile || profile === 'development') return;

  const required = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_OIDC_ISSUER',
    'EXPO_PUBLIC_OIDC_CLIENT_ID',
    'EXPO_PUBLIC_OIDC_PROJECT_ID',
  ];
  const problems: string[] = [];
  for (const key of required) {
    if (!process.env[key]) problems.push(`${key} is not set`);
  }
  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_OIDC_ISSUER']) {
    const value = process.env[key] ?? '';
    if (value && !value.startsWith('https://')) problems.push(`${key} must use https (got ${value})`);
    if (/\/\/(localhost|127\.|10\.|192\.168\.)/.test(value)) problems.push(`${key} points at a local machine (${value})`);
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to build profile "${profile}":\n  - ${problems.join('\n  - ')}`);
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertReleaseConfig();
  return {
    ...config,
    name: 'CargoTrack',
    slug: 'cargotrack',
    scheme: 'cargotrack',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    android: {
      ...config.android,
      // Release builds block plain-http traffic by default (Android 9+),
      // and assertReleaseConfig refuses http:// addresses above.
      package: 'com.cargotrack.app',
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.cargotrack.app',
    },
  };
};
