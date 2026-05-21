/**
 * security.ts — App-level security hardening.
 *
 * Layers:
 *  1. Screen capture / recording prevention (expo-screen-capture)
 *  2. Auto-lock after background inactivity
 *  3. Session idle timeout (force logout after extended inactivity)
 *  4. App state monitoring (background/foreground transitions)
 */
import { AppState, type AppStateStatus } from 'react-native'
import * as ScreenCapture from 'expo-screen-capture'
import { authenticateWithBiometrics } from './biometrics'

// ─── Configurable constants ──────────────────────────────────────────────────

/** Seconds in background before the app locks and requires biometric re-auth. */
const AUTO_LOCK_DELAY_SECONDS = 60

/** Seconds of total inactivity (foreground or background) before forced logout. */
const SESSION_TIMEOUT_SECONDS = 30 * 60 // 30 minutes

// ─── State ───────────────────────────────────────────────────────────────────

let screenCapturePrevented = false
let backgroundSince: number | null = null
let lastActivityAt: number = Date.now()
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null

// Callbacks set by the UI layer
let onLockRequested: (() => void) | null = null
let onLockCleared: (() => void) | null = null
let onSessionExpired: (() => void) | null = null

// ─── Public API ───────────────────────────────────────────────────────────────

export function registerSecurityCallbacks(callbacks: {
  onLock: () => void
  onUnlock: () => void
  onSessionExpired: () => void
}) {
  onLockRequested = callbacks.onLock
  onLockCleared = callbacks.onUnlock
  onSessionExpired = callbacks.onSessionExpired
}

export function unregisterSecurityCallbacks() {
  onLockRequested = null
  onLockCleared = null
  onSessionExpired = null
}

/** Record user activity — resets both the auto-lock and session timeout timers. */
export function recordActivity() {
  lastActivityAt = Date.now()
}

/** Returns ms since the last recorded user activity. */
export function idleDurationMs(): number {
  return Date.now() - lastActivityAt
}

// ─── Screen capture prevention ───────────────────────────────────────────────

export async function enableScreenCapturePrevention() {
  if (screenCapturePrevented) return
  try {
    await ScreenCapture.preventScreenCaptureAsync()
    screenCapturePrevented = true
  } catch {
    // expo-screen-capture may not be supported on all platforms
  }
}

export async function disableScreenCapturePrevention() {
  if (!screenCapturePrevented) return
  try {
    await ScreenCapture.allowScreenCaptureAsync()
    screenCapturePrevented = false
  } catch {}
}

// ─── Auto-lock on background ─────────────────────────────────────────────────

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'background' || nextState === 'inactive') {
    backgroundSince = Date.now()
    // Prevent screen contents from appearing in the app switcher / task view
    enableScreenCapturePrevention()
    startSessionTimeoutChecker()
  } else if (nextState === 'active') {
    // Re-enable screen capture prevention when active — sensitive data is
    // now visible on screen and could be captured by screen recording.
    enableScreenCapturePrevention()
    stopSessionTimeoutChecker()

    // Check if auto-lock should trigger
    if (backgroundSince !== null) {
      const elapsed = (Date.now() - backgroundSince) / 1000
      backgroundSince = null

      if (elapsed >= AUTO_LOCK_DELAY_SECONDS) {
        onLockRequested?.()
        return
      }
    }

    // Check session timeout
    if (idleDurationMs() >= SESSION_TIMEOUT_SECONDS * 1000) {
      onSessionExpired?.()
      return
    }

    recordActivity()
  }
}

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null

export function startSecurityMonitoring() {
  if (appStateSubscription) return
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
  recordActivity()
}

export function stopSecurityMonitoring() {
  appStateSubscription?.remove()
  appStateSubscription = null
  stopSessionTimeoutChecker()
}

// ─── Session timeout checker ─────────────────────────────────────────────────

function startSessionTimeoutChecker() {
  if (sessionCheckInterval) return
  sessionCheckInterval = setInterval(() => {
    if (idleDurationMs() >= SESSION_TIMEOUT_SECONDS * 1000) {
      stopSessionTimeoutChecker()
      onSessionExpired?.()
    }
  }, 15_000) // check every 15s
}

function stopSessionTimeoutChecker() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval)
    sessionCheckInterval = null
  }
}

// ─── Lock / unlock flow ──────────────────────────────────────────────────────

export async function attemptBiometricUnlock(): Promise<boolean> {
  const result = await authenticateWithBiometrics('CargoTrack')
  if (result.success) {
    recordActivity()
    onLockCleared?.()
    return true
  }
  return false
}

export function forceLock() {
  onLockRequested?.()
}

export function clearLock() {
  recordActivity()
  onLockCleared?.()
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function destroySecurity() {
  stopSecurityMonitoring()
  disableScreenCapturePrevention()
  unregisterSecurityCallbacks()
  backgroundSince = null
}
