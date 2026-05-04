import { type ReactNode, useCallback } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAlertStore } from '@/store/alertStore'
import { useAuthStore } from '@/store/authStore'
import type { Alert } from '@/types'

/**
 * Invisible provider that connects the notification WebSocket and dispatches
 * real-time alerts into the Zustand alert store. Mount once near the app root.
 */
export default function RealTimeProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const addRealtimeAlert = useAlertStore((s) => s.addRealtimeAlert)
  const setWsConnected = useAlertStore((s) => s.setWsConnected)

  const handleMessage = useCallback((data: unknown) => {
    const msg = data as Record<string, unknown>
    if (msg.type === 'alert' && msg.payload) {
      addRealtimeAlert(msg.payload as unknown as Alert)
    }
  }, [addRealtimeAlert])

  const { readyState } = useWebSocket({
    path: '/ws/notifications/',
    onMessage: handleMessage,
  })

  // Sync WS state to store whenever it changes
  if (accessToken) {
    const connected = readyState === 'OPEN'
    if (useAlertStore.getState().wsConnected !== connected) {
      setWsConnected(connected)
    }
  }

  return <>{children}</>
}

// Re-export ready state constants for use in other components
export { useWebSocket }
