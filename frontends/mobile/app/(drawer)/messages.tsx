import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { listOf } from '@/lib/data'
import { timeAgo } from '@shared/utils/formatters'
import { Empty, Loading, ScreenFrame, Section, Txt } from '@/components/ui'

interface Conversation {
  id: number
  subject: string
  shipment: number | null
  is_group: boolean
  participants_display: string
  last_message: { id: number; content: string; sender_name: string; created_at: string; is_read: boolean } | null
  unread_count: number
  updated_at: string
}

interface ChatMessage {
  id: number
  sender_id: number | null
  sender_name: string
  content: string
  is_system: boolean
  created_at: string
}

/** Conversations with carriers and the team, each usually about one shipment. */
export default function MessagesScreen() {
  const back = useBack()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/chat/conversations/')
      setConversations(listOf<Conversation>(res.data))
    } catch {
      setConversations([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  if (active) return <Chat conversation={active} onBack={() => { setActive(null); load() }} />

  return (
    <ScreenFrame
      title="Messages"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      {loading ? (
        <Loading />
      ) : conversations.length === 0 ? (
        <Empty icon="chatbubbles-outline" title="No conversations yet" body="Messages with carriers and your team appear here." />
      ) : (
        <Section label="Conversations">
          {conversations.map((c, i) => (
            <ConversationRow key={c.id} c={c} last={i === conversations.length - 1} onPress={() => setActive(c)} />
          ))}
        </Section>
      )}
    </ScreenFrame>
  )
}

function ConversationRow({ c, last, onPress }: { c: Conversation; last: boolean; onPress: () => void }) {
  const { colors, brand } = useAppTheme()
  const initials = c.participants_display
    .split(/[ ,]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="bodyStrong" tone="inverse">{initials || '?'}</Txt>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant={c.unread_count ? 'bodyStrong' : 'body'} style={{ flex: 1 }} numberOfLines={1}>{c.participants_display}</Txt>
          {c.last_message ? <Txt variant="caption" tone="faint">{timeAgo(c.last_message.created_at)}</Txt> : null}
        </View>
        <Txt variant="caption" tone="muted" numberOfLines={1}>{c.subject}</Txt>
        {c.last_message ? (
          <Txt variant="caption" tone={c.unread_count ? 'primary' : 'faint'} numberOfLines={1} style={{ marginTop: 2 }}>
            {c.last_message.content}
          </Txt>
        ) : null}
      </View>
      {c.unread_count ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: brand.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="caption" tone="inverse" style={{ fontSize: 11, lineHeight: 14 }}>{c.unread_count}</Txt>
        </View>
      ) : null}
    </Pressable>
  )
}

function Chat({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const user = useAuthStore((s) => s.user)
  const { colors, brand } = useAppTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ messages: ChatMessage[] }>(`/api/v1/chat/conversations/${conversation.id}/`)
      setMessages(res.data.messages ?? [])
    } catch {
      setMessages([])
    }
  }, [conversation.id])

  useEffect(() => { load() }, [load])

  async function send() {
    const content = input.trim()
    if (!content) return
    setInput('')
    try {
      await apiClient.post(`/api/v1/chat/conversations/${conversation.id}/messages/`, { content })
      await load()
    } catch {
      setInput(content)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: brand.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" tone="inverse" numberOfLines={1}>{conversation.participants_display}</Txt>
            <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>{conversation.subject}</Txt>
          </View>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<Empty icon="chatbubble-outline" title="No messages yet" body="Say hello." />}
          renderItem={({ item }) => {
            if (item.is_system) {
              return <Txt variant="caption" tone="faint" style={{ textAlign: 'center' }}>{item.content}</Txt>
            }
            const mine = item.sender_id === user?.id
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '82%',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 18,
                    borderBottomRightRadius: mine ? 4 : 18,
                    borderBottomLeftRadius: mine ? 18 : 4,
                    backgroundColor: mine ? brand.primary : colors.muted,
                  }}>
                  <Txt variant="body" tone={mine ? 'inverse' : 'primary'}>{item.content}</Txt>
                </View>
                <Txt variant="caption" tone="faint" style={{ marginTop: 4, marginHorizontal: 4, fontSize: 11 }}>
                  {mine ? '' : `${item.sender_name} · `}{timeAgo(item.created_at)}
                </Txt>
              </View>
            )
          }}
        />
        <SafeAreaView edges={['bottom']} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMid }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Write a message"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                maxHeight: 120,
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: colors.muted,
                color: colors.text,
                fontFamily: 'DMSans-Regular',
                fontSize: 15,
              }}
            />
            <Pressable
              onPress={send}
              disabled={!input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: input.trim() ? brand.accent : colors.muted }}>
              <Ionicons name="send" size={18} color={input.trim() ? '#FFFFFF' : colors.textFaint} />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  )
}
