import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

interface SignalingCallbacks {
  onIncomingCall?: (payload: { call_id: number; caller_id: number; caller_name: string; conversation_id: number }) => void
  onCallAccepted?: (payload: { call_id: number; conversation_id: number; accepted_by: number }) => void
  onSignal?: (payload: { from_id: number; from_name: string; sdp?: any; candidate?: any }) => void
  onCallEnded?: (payload: { call_id: number; by_id?: number; conversation_id: number }) => void
  onCallMissed?: (payload: { call_id: number; conversation_id: number }) => void
}

export function useVideoSignaling(conversationId: number | null, callbacks: SignalingCallbacks) {
  const wsRef = useRef<WebSocket | null>(null)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const connect = useCallback(() => {
    if (!conversationId) return

    const token = useAuthStore.getState().accessToken
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = `${protocol}://${host}/ws/video/${conversationId}/?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        const cb = callbacksRef.current
        switch (data.type) {
          case 'incoming_call': cb.onIncomingCall?.(data.payload); break
          case 'call_accepted': cb.onCallAccepted?.(data.payload); break
          case 'signal':        cb.onSignal?.(data.payload); break
          case 'call_ended':    cb.onCallEnded?.(data.payload); break
          case 'call_missed':   cb.onCallMissed?.(data.payload); break
        }
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => { wsRef.current = null }
  }, [conversationId])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send, connect, disconnect }
}
