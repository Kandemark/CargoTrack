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
  deselectConversation: () => void
  sendMessage: (content: string, encrypted?: boolean) => void
  editMessage: (messageId: number, content: string) => void
  deleteMessage: (messageId: number) => void
  unsendMessage: (messageId: number) => void
  setAnnouncement: (content: string) => void
  sendTyping: () => void
  createConversation: (participantIds: number[], subject?: string, opts?: { isCommunity?: boolean; description?: string }) => Promise<Conversation>
  refreshConversations: () => void
  uploadAttachment: (file: File, content?: string) => void
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
    return useAuthStore.getState().accessToken
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

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = token
      ? `${protocol}://${host}/ws/chat/${conversationId}/?token=${token}`
      : `${protocol}://${host}/ws/chat/${conversationId}/`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      // If we didn't have a query-string token, try challenge-response auth
      if (!token) {
        const freshToken = getToken()
        if (freshToken) {
          ws.send(JSON.stringify({ type: 'auth', token: freshToken }))
          return
        }
      }
      setConnected(true)
    }
    ws.onclose = () => setConnected(false)

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      switch (data.type) {
        case 'connected':
        case 'auth_success':
          setConnected(true)
          break
        case 'auth_error':
        case 'error':
          if (data.code === 'AUTH_REQUIRED') {
            const freshToken = getToken()
            if (freshToken) {
              ws.send(JSON.stringify({ type: 'auth', token: freshToken }))
              return
            }
          }
          console.warn('Chat WS:', data.detail ?? data.type)
          break
        case 'message': {
          const user = useAuthStore.getState().user
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.payload.id)) return prev
            const optimisticIdx = prev.findIndex((m) =>
              m.id < 0 && m.sender_id === user?.id && m.content === data.payload.content,
            )
            if (optimisticIdx !== -1) {
              const updated = [...prev]
              updated[optimisticIdx] = data.payload
              return updated
            }
            return [...prev, data.payload]
          })
          break
        }
        case 'message_edited':
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.payload.message_id
                ? { ...m, content: data.payload.content, is_edited: true, edited_at: data.payload.edited_at }
                : m,
            ),
          )
          break
        case 'message_deleted':
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.payload.message_id
                ? { ...m, is_deleted: true, deleted_at: data.payload.deleted_at, content: 'This message was deleted.' }
                : m,
            ),
          )
          break
        case 'message_unsent':
          setMessages((prev) => prev.filter((m) => m.id !== data.payload.message_id))
          break
        case 'announcement':
          setActiveConversation((prev) =>
            prev ? { ...prev, announcement: data.payload.content } : null,
          )
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

  const deselectConversation = useCallback(() => {
    disconnectWs()
    setActiveConversation(null)
    setMessages([])
    setTypingUsers([])
    setLoading(false)
    activeIdRef.current = null
  }, [disconnectWs])

  // ── Send message (via WS, fallback REST) ─────────────────────────────────
  const sendMessage = useCallback((content: string, encrypted = false) => {
    if (!content.trim()) return
    const user = useAuthStore.getState().user
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload: Record<string, unknown> = { type: 'message', content }
      if (encrypted) {
        payload.is_encrypted = true
        payload.encryption_metadata = { algorithm: 'AES-256-GCM', key_id: `key-${user?.id}-${activeIdRef.current}` }
      }
      ws.send(JSON.stringify(payload))
      const optimistic: ChatMessage = {
        id: -Date.now(),
        conversation: activeIdRef.current!,
        sender: user?.id ?? 0,
        sender_id: user?.id ?? 0,
        sender_name: user?.display_name || user?.username || 'You',
        sender_role: user?.role ?? '',
        content,
        attachment_url: '',
        attachment_type: '',
        file_size: 0,
        is_read: false,
        is_system: false,
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        deleted_at: null,
        is_encrypted: encrypted,
        encryption_metadata: payload.encryption_metadata as Record<string, unknown> || {},
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
    } else if (activeIdRef.current) {
      chatApi.sendMessage(activeIdRef.current, content).then(({ data }) => {
        setMessages((prev) => [...prev, data])
      })
    }
  }, [])

  // ── Edit / Delete / Unsend ────────────────────────────────────────────────
  const editMessage = useCallback((messageId: number, content: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message_edit', message_id: messageId, content }))
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, content, is_edited: true, edited_at: new Date().toISOString() } : m),
      )
    }
  }, [])

  const deleteMessage = useCallback((messageId: number) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message_delete', message_id: messageId }))
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, is_deleted: true, deleted_at: new Date().toISOString() } : m),
      )
    }
  }, [])

  const unsendMessage = useCallback((messageId: number) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message_unsend', message_id: messageId }))
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    }
  }, [])

  const setAnnouncement = useCallback((content: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'announcement', content }))
    }
  }, [])

  // ── Typing indicator ─────────────────────────────────────────────────────
  const sendTyping = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing' }))
    }
  }, [])

  // ── Upload attachment ─────────────────────────────────────────────────────
  const uploadAttachment = useCallback((file: File, content = '') => {
    const user = useAuthStore.getState().user
    const convId = activeIdRef.current
    if (!convId) return

    const blobUrl = URL.createObjectURL(file)
    const attachmentType: ChatMessage['attachment_type'] =
      file.type.startsWith('image/') ? 'IMAGE' :
      file.type.startsWith('audio/') ? 'AUDIO' :
      file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT'

    const optimistic: ChatMessage = {
      id: -Date.now(),
      conversation: convId,
      sender: user?.id ?? 0,
      sender_id: user?.id ?? 0,
      sender_name: user?.display_name || user?.username || 'You',
      sender_role: user?.role ?? '',
      content,
      attachment_url: blobUrl,
      attachment_type: attachmentType,
      file_size: file.size,
      is_read: false,
      is_system: false,
      is_edited: false,
      edited_at: null,
      is_deleted: false,
      deleted_at: null,
      is_encrypted: false,
      encryption_metadata: {},
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    chatApi.uploadAttachment(convId, file, content).then(({ data }) => {
      URL.revokeObjectURL(blobUrl)
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? data : m))
    }).catch(() => {
      setMessages((prev) => prev.map((m) =>
        m.id === optimistic.id ? { ...m, content: '[Upload failed]', attachment_url: '' } : m,
      ))
    })
  }, [])

  // ── Create conversation ──────────────────────────────────────────────────
  const createConversation = useCallback(async (participantIds: number[], subject?: string, opts?: { isCommunity?: boolean; description?: string }) => {
    const { data } = await chatApi.createConversation({
      participant_ids: participantIds,
      subject,
      is_group: participantIds.length > 1,
      is_community: opts?.isCommunity ?? false,
      description: opts?.description ?? '',
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
    deselectConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    unsendMessage,
    setAnnouncement,
    sendTyping,
    createConversation,
    refreshConversations,
    uploadAttachment,
  }
}
