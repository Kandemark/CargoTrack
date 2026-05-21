import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { AppState, PanResponder, View } from 'react-native'
import {
  startSecurityMonitoring,
  stopSecurityMonitoring,
  registerSecurityCallbacks,
  unregisterSecurityCallbacks,
  recordActivity,
  destroySecurity,
  clearLock,
} from '@/lib/security'
import { handleBiometricEnrollmentChange } from '@/lib/biometrics'
import { useAuthStore } from '@/lib/store'
import LockScreen from './LockScreen'

interface SecurityContextValue {
  isLocked: boolean
  lock: () => void
  unlock: () => void
}

const SecurityContext = createContext<SecurityContextValue>({
  isLocked: false,
  lock: () => {},
  unlock: () => {},
})

export function useSecurity() {
  return useContext(SecurityContext)
}

export default function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => !!s.user)
  const lockedRef = useRef(false)

  const handleLock = useCallback(() => {
    if (lockedRef.current) return
    lockedRef.current = true
    setIsLocked(true)
  }, [])

  const handleUnlock = useCallback(() => {
    lockedRef.current = false
    setIsLocked(false)
  }, [])

  const handleSessionExpired = useCallback(() => {
    lockedRef.current = false
    setIsLocked(false)
    logout()
  }, [logout])

  const handleLogout = useCallback(() => {
    lockedRef.current = false
    setIsLocked(false)
    logout()
  }, [logout])

  // Register security callbacks
  useEffect(() => {
    if (!isAuthenticated) return

    registerSecurityCallbacks({
      onLock: handleLock,
      onUnlock: handleUnlock,
      onSessionExpired: handleSessionExpired,
    })

    startSecurityMonitoring()

    return () => {
      stopSecurityMonitoring()
      unregisterSecurityCallbacks()
    }
  }, [isAuthenticated, handleLock, handleUnlock, handleSessionExpired])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroySecurity()
    }
  }, [])

  // Check for biometric enrollment changes when app returns to foreground
  useEffect(() => {
    if (!isAuthenticated) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { void handleBiometricEnrollmentChange() }
    })
    return () => sub.remove()
  }, [isAuthenticated])

  // Touch activity tracking — any touch on the root view resets the idle timer
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        if (!lockedRef.current) {
          recordActivity()
        }
        return false
      },
      onMoveShouldSetPanResponderCapture: () => {
        if (!lockedRef.current) {
          recordActivity()
        }
        return false
      },
    })
  ).current

  if (!isAuthenticated) {
    return <>{children}</>
  }

  return (
    <SecurityContext.Provider value={{ isLocked, lock: handleLock, unlock: handleUnlock }}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {children}
        {isLocked ? <LockScreen onLogout={handleLogout} /> : null}
      </View>
    </SecurityContext.Provider>
  )
}
