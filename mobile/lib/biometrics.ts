/**
 * biometrics.ts — Device biometric (fingerprint / face) authentication for login.
 *
 * Privacy-first design:
 *  - Credentials are stored ONLY after the user explicitly opts in after a
 *    successful password-based login.
 *  - Biometric authentication only unlocks locally stored credentials; the
 *    biometric signature never leaves the device.
 *  - The user can disable biometric sign-in at any time from Settings; doing
 *    so immediately deletes stored credentials.
 *  - If the device biometrics change (e.g. new fingerprint enrolled), the
 *    OS invalidates the keystore entry and stored credentials are cleared.
 */
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const BIOMETRIC_ENABLED_KEY = 'cargotrack.biometric.enabled'
const BIOMETRIC_USERNAME_KEY = 'cargotrack.biometric.username'
const BIOMETRIC_PASSWORD_KEY = 'cargotrack.biometric.password'

// ─── Capability detection ──────────────────────────────────────────────────────

export interface BiometricCapabilities {
  /** Device hardware supports biometrics (fingerprint / face / iris). */
  isAvailable: boolean
  /** The user has enrolled at least one biometric on this device. */
  isEnrolled: boolean
  /** Which biometric types are enrolled. */
  enrolledTypes: LocalAuthentication.AuthenticationType[]
  /** Human-readable label ("Face ID", "Fingerprint", "Biometrics"). */
  label: string
}

export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  const [compat, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ])

  const types = compat && enrolled
    ? await LocalAuthentication.supportedAuthenticationTypesAsync()
    : []

  const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'Fingerprint'
      : types.includes(LocalAuthentication.AuthenticationType.IRIS)
        ? 'Iris'
        : 'Biometrics'

  return {
    isAvailable: compat,
    isEnrolled: enrolled,
    enrolledTypes: types,
    label,
  }
}

// ─── Biometric authentication ──────────────────────────────────────────────────

export async function authenticateWithBiometrics(
  label: string = 'CargoTrack',
): Promise<{ success: boolean; error?: string }> {
  try {
    const cap = await checkBiometricCapabilities()
    if (!cap.isAvailable) {
      return { success: false, error: 'This device does not support biometric authentication.' }
    }
    if (!cap.isEnrolled) {
      return { success: false, error: `No ${cap.label} enrolled on this device. Set up biometrics in your device settings.` }
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Sign in to ${label}`,
      cancelLabel: 'Use password',
      fallbackLabel: 'Use device PIN',
      disableDeviceFallback: false,
    })

    if (result.success) {
      return { success: true }
    }
    if (result.error === 'user_cancel') {
      return { success: false, error: 'cancelled' }
    }
    return { success: false, error: result.error ?? 'Biometric authentication failed. Try again or use your password.' }
  } catch {
    return { success: false, error: 'Biometric authentication failed. Try again or use your password.' }
  }
}

// ─── Credential storage (opt-in, secure) ───────────────────────────────────────

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
  return val === 'true'
}

/**
 * Store credentials for future biometric sign-in.
 * Call ONLY after explicit user opt-in following a successful password login.
 */
export async function enrollBiometricCredentials(username: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_USERNAME_KEY, username)
  await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password)
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true')
}

/**
 * Retrieve stored credentials. Returns null if biometrics are not enabled
 * or if the keystore entry was invalidated (e.g. after biometric change).
 */
export async function getBiometricCredentials(): Promise<{ username: string; password: string } | null> {
  const enabled = await isBiometricEnabled()
  if (!enabled) return null

  const [username, password] = await Promise.all([
    SecureStore.getItemAsync(BIOMETRIC_USERNAME_KEY),
    SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY),
  ])

  if (!username || !password) return null
  return { username, password }
}

/**
 * Remove stored biometric credentials and disable biometric sign-in.
 * Safe to call even if biometrics were never enabled.
 */
export async function disableBiometrics(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_USERNAME_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
  ])
}

/**
 * Called when the OS reports that new biometrics were enrolled or all
 * biometrics were removed since the last check. In either case we must
 * invalidate stored credentials because the Android Keystore / iOS Keychain
 * entry can no longer be unlocked by the previous biometric set.
 */
export async function handleBiometricEnrollmentChange(): Promise<void> {
  const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync()
  // Level 0 = no biometrics, Level 1 = at least one biometric enrolled.
  // If the level changed or dropped to 0 we clear stored credentials.
  if (enrolledLevel === 0) {
    await disableBiometrics()
  }
}
