import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface Conversation {
  id: number; subject: string; shipment: number | null; is_group: boolean; participants_display: string
  last_message: { id: number; content: string; sender_name: string; created_at: string; is_read: boolean } | null
  unread_count: number; updated_at: string
}

interface ChatMessage {
  id: number; conversation: number; sender: number | null; sender_id: number | null; sender_name: string
  sender_role: string; content: string; attachment_url: string; is_read: boolean; is_system: boolean; created_at: string
}

export default function MessagesScreen() {
  const user = useAuthStore((s) => s.user)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeChat, setActiveChat] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchConversations = useCallback(async () => {
    try { const res = await apiClient.get<Conversation[]>('/api/v1/chat/conversations/'); setConversations(res.data) } catch {}
  }, [])

  useEffect(() => { fetchConversations().finally(() => setLoading(false)) }, [fetchConversations])

  // Poll conversations for new messages when not in a chat
  useEffect(() => {
    if (activeChat) return
    const i = setInterval(fetchConversations, 15000)
    return () => clearInterval(i)
  }, [activeChat, fetchConversations])

  async function openChat(conv: Conversation) {
    setActiveChat(conv)
    try {
      const res = await apiClient.get<{ messages: ChatMessage[] }>(`/api/v1/chat/conversations/${conv.id}/`)
      setMessages(res.data.messages ?? [])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 200)
    } catch { setMessages([]) }
  }

  async function sendMessage() {
    if (!input.trim() || !activeChat) return
    const content = input.trim()
    setInput('')
    try {
      await apiClient.post('/api/v1/chat/messages/', { conversation: activeChat.id, content })
      const res = await apiClient.get<{ messages: ChatMessage[] }>(`/api/v1/chat/conversations/${activeChat.id}/`)
      setMessages(res.data.messages ?? [])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {}
  }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  // Chat view
  if (activeChat) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={activeChat.subject} subtitle={activeChat.participants_display} backButton />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: 8 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ color: colors.textFaint, fontSize: 13 }}>No messages yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id
              return (
                <View style={{ marginBottom: 12, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {item.is_system ? (
                    <View style={{ alignSelf: 'center', backgroundColor: colors.muted, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint }}>{item.content}</Text>
                    </View>
                  ) : (
                    <>
                      {!isMine && <Text style={{ fontSize: 10, color: colors.textFaint, marginBottom: 2, marginLeft: 4 }}>{item.sender_name}</Text>}
                      <View style={[s.bubble, { backgroundColor: isMine ? brand.primary : colors.card, borderColor: isMine ? 'transparent' : colors.border }]}>
                        <Text style={{ fontSize: 14, color: isMine ? '#fff' : colors.text, lineHeight: 20 }}>{item.content}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 2, marginHorizontal: 4 }}>{timeAgo(item.created_at)}</Text>
                    </>
                  )}
                </View>
              )
            }}
          />
          <View style={[s.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
              style={[s.input, { color: colors.text, backgroundColor: colors.muted }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textFaint}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity onPress={sendMessage} disabled={!input.trim()} style={[s.sendBtn, { backgroundColor: input.trim() ? brand.primary : colors.muted }]}>
              <Ionicons name="send" size={16} color={input.trim() ? '#fff' : colors.textFaint} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Messages" backButton />
      <FlatList
        data={conversations}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={!loading ? (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No conversations</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openChat(item)} activeOpacity={0.7} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.avatar, { backgroundColor: item.unread_count > 0 ? brand.primary : colors.muted }]}>
                <Ionicons name={item.is_group ? 'people' : 'person'} size={16} color={item.unread_count > 0 ? '#fff' : colors.textFaint} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, fontWeight: item.unread_count > 0 ? '800' : '600', color: colors.text }}>{item.subject}</Text>
                  <Text style={{ fontSize: 11, color: colors.textFaint }}>{item.last_message ? timeAgo(item.last_message.created_at) : ''}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                  {item.last_message ? `${item.last_message.sender_name}: ${item.last_message.content}` : item.participants_display}
                </Text>
              </View>
              {item.unread_count > 0 && (
                <View style={[s.unreadBadge, { backgroundColor: brand.primary }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, borderWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
})
