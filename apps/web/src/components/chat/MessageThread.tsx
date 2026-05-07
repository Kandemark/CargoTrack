import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import ChatBubble from './ChatBubble'
import TypingIndicator from './TypingIndicator'
import MessageInput from './MessageInput'
import type { ChatMessage, TypingEvent } from '@/types'

interface Props {
  messages: ChatMessage[]
  typingUsers: TypingEvent[]
  loading: boolean
  onSend: (content: string) => void
  onTyping: () => void
}

export default function MessageThread({ messages, typingUsers, loading, onSend, onTyping }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#0f2d5e] rounded-full" />
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} isOwn={msg.sender_id === userId} />
        ))}
        <TypingIndicator users={typingUsers} />
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={onSend} onTyping={onTyping} />
    </>
  )
}
