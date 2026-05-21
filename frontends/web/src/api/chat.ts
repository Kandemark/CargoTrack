/**
 * chat.ts — API client for conversations and messages.
 */
import apiClient from './client'

export interface ConversationItem {
  id: number
  subject: string
  shipment: number | null
  is_group: boolean
  participants: number[]
  participants_display: string
  last_message: {
    id: number
    content: string
    sender_name: string
    created_at: string
    is_read: boolean
  } | null
  unread_count: number
  created_at: string
  updated_at: string
}

export interface MessageItem {
  id: number
  conversation: number
  sender: number
  sender_id: number
  sender_name: string
  sender_role: string
  content: string
  attachment_url: string
  is_read: boolean
  is_system: boolean
  created_at: string
}

export const chatApi = {
  listConversations: () =>
    apiClient.get<ConversationItem[]>('/api/v1/chat/conversations/'),

  getConversation: (id: number) =>
    apiClient.get<ConversationItem & { messages: MessageItem[] }>(`/api/v1/chat/conversations/${id}/`),

  createConversation: (data: { participant_ids: number[]; subject?: string; shipment?: number }) =>
    apiClient.post<ConversationItem>('/api/v1/chat/conversations/', data),

  sendMessage: (conversationId: number, content: string) =>
    apiClient.post<MessageItem>(`/api/v1/chat/conversations/${conversationId}/messages/`, { content }),

  markRead: (conversationId: number) =>
    apiClient.post(`/api/v1/chat/conversations/${conversationId}/mark-read/`),
}

export function searchUsers(query: string) {
  return apiClient.get<{ results?: { id: number; first_name: string; last_name: string; role: string }[] }>(
    '/api/v1/accounts/users/',
    { params: { q: query, page_size: 15 } },
  )
}
