import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

type ReadyState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'

interface UseWebSocketOptions {
  path: string
  onMessage?: (data: unknown) => void
  reconnect?: boolean
  maxRetries?: number
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

export function useWebSocket({ path, onMessage, reconnect = true, maxRetries = 10 }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const [readyState, setReadyState] = useState<ReadyState>('CLOSED')

  const connect = useCallback(() => {
    const token = useAuthStore.getState().accessToken
    if (!token) return

    const url = `${WS_BASE}${path}?token=${token}`
    const ws = new WebSocket(url)
    wsRef.current = ws
    setReadyState('CONNECTING')

    ws.onopen = () => {
      setReadyState('OPEN')
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {
        // non-JSON message — ignore
      }
    }

    ws.onclose = (event) => {
      setReadyState('CLOSED')
      wsRef.current = null

      if (!reconnect) return
      if (event.code === 4001) return // auth failure — don't retry

      if (retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000)
        retriesRef.current++
        timerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }, [path, reconnect, maxRetries])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { readyState, send }
}
