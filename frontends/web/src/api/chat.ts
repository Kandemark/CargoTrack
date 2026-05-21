/**
 * chat.ts — API client for conversations and messages.
 */
import apiClient from './client'
import type { Conversation, ConversationDetail, ChatMessage } from '@/types'

export type ConversationItem = Conversation
export type MessageItem = ChatMessage

export const chatApi = {
  listConversations: () =>
    apiClient.get<ConversationItem[]>('/api/v1/chat/conversations/'),

  getConversation: (id: number) =>
    apiClient.get<ConversationDetail>(`/api/v1/chat/conversations/${id}/`),

  createConversation: (data: {
    participant_ids: number[]
    subject?: string
    description?: string
    shipment?: number
    is_group?: boolean
    is_community?: boolean
    is_encrypted?: boolean
  }) =>
    apiClient.post<ConversationItem>('/api/v1/chat/conversations/', data),

  sendMessage: (conversationId: number, content: string) =>
    apiClient.post<MessageItem>(`/api/v1/chat/conversations/${conversationId}/messages/`, { content }),

  editMessage: (conversationId: number, messageId: number, content: string) =>
    apiClient.patch<MessageItem>(`/api/v1/chat/conversations/${conversationId}/messages/${messageId}/`, { content }),

  deleteMessage: (conversationId: number, messageId: number) =>
    apiClient.delete(`/api/v1/chat/conversations/${conversationId}/messages/${messageId}/`),

  markRead: (conversationId: number) =>
    apiClient.post(`/api/v1/chat/conversations/${conversationId}/mark-read/`),

  updateAnnouncement: (conversationId: number, content: string) =>
    apiClient.post(`/api/v1/chat/conversations/${conversationId}/announcement/`, { content }),

  uploadAttachment: (conversationId: number, file: File, content?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (content) form.append('content', content)
    return apiClient.post<MessageItem>(`/api/v1/chat/conversations/${conversationId}/attachments/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export function searchUsers(query: string) {
  return apiClient.get<{ results?: { id: number; first_name: string; last_name: string; role: string }[] }>(
    '/api/v1/accounts/users/',
    { params: { q: query, page_size: 15 } },
  )
}
