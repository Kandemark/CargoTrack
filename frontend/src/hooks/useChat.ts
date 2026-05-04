import { useCallback, useEffect, useRef, useState } from 'react'
import { chatApi } from '@/api/chat'
import { useAuthStore } from '@/store/authStore'
import type { ChatMessage, Conversation, ConversationDetail, TypingEvent } from '@/types'

interface UseChatReturn {
  conversations: Conversation[]
  activeConversation: ConversationDetail | null
  messages: ChatMessage[]
  typingUsers: { user_id: number; user_name: string }[]
  connected: boolean
  loading: boolean
  selectConversation: (id: number) => void
  sendMessage: (content: string) => void
  sendTyping: () => void
  createConversation: (participantIds: number[], subject?: string) => Promise<ConversationDetail>
  refreshConversations: () => void
}

export function useChat(): UseChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeIdRef = useRef<number | null>(null)

  const getToken = useCallback(() => {
    return useAuthStore.getState().isAuthenticated
      ? localStorage.getItem('ct_access')
      : null
  }, [])

  // ── Load conversation list ──────────────────────────────────────────────
  const refreshConversations = useCallback(() => {
    chatApi.listConversations()
      .then(({ data }) => setConversations(data))
      .catch(() => {})
  }, [])

  useEffect(() => { refreshConversations() }, [refreshConversations])

  // ── Select & load a conversation ─────────────────────────────────────────
  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const connectWs = useCallback((conversationId: number) => {
    disconnectWs()
    const token = getToken()
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = `${protocol}://${host}/ws/chat/${conversationId}/?token=${token}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      switch (data.type) {
        case 'message':
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.payload.id)) return prev
            return [...prev, data.payload]
          })
          break
        case 'typing': {
          const uid = data.payload.user_id
          setTypingUsers((prev) => {
            if (prev.some((t) => t.user_id === uid)) return prev
            return [...prev, data.payload]
          })
          clearTimeout(typingTimerRef.current!)
          typingTimerRef.current = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((t) => t.user_id !== uid))
          }, 2500)
          break
        }
        case 'read':
          setMessages((prev) =>
            prev.map((m) => {
              if (m.sender_id !== data.payload.reader_id) {
                return { ...m, is_read: true }
              }
              return m
            }),
          )
          break
      }
    }
  }, [disconnectWs, getToken])

  const selectConversation = useCallback((id: number) => {
    activeIdRef.current = id
    setLoading(true)
    chatApi.getConversation(id).then(({ data }) => {
      setActiveConversation(data)
      setMessages(data.messages || [])
      setTypingUsers([])
      setLoading(false)
      connectWs(id)
    }).catch(() => setLoading(false))
  }, [connectWs])

  // ── Send message (via WS, fallback REST) ─────────────────────────────────
  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content }))
    } else if (activeIdRef.current) {
      chatApi.sendMessage(activeIdRef.current, content).then(({ data }) => {
        setMessages((prev) => [...prev, data])
      })
    }
  }, [])

  // ── Typing indicator ─────────────────────────────────────────────────────
  const sendTyping = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing' }))
    }
  }, [])

  // ── Create conversation ──────────────────────────────────────────────────
  const createConversation = useCallback(async (participantIds: number[], subject?: string) => {
    const { data } = await chatApi.createConversation({
      participant_ids: participantIds,
      subject,
      is_group: participantIds.length > 1,
    })
    setConversations((prev) => [data, ...prev])
    return data
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      disconnectWs()
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }
  }, [disconnectWs])

  return {
    conversations,
    activeConversation,
    messages,
    typingUsers,
    connected,
    loading,
    selectConversation,
    sendMessage,
    sendTyping,
    createConversation,
    refreshConversations,
  }
}
