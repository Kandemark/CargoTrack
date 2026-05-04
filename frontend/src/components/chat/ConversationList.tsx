import { MessageSquare, Plus } from 'lucide-react'
import type { Conversation } from '@/types'

interface Props {
  conversations: Conversation[]
  activeId: number | null
  onSelect: (id: number) => void
  onNewChat: () => void
}

export default function ConversationList({ conversations, activeId, onSelect, onNewChat }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-800">Messages</h2>
        <button
          onClick={onNewChat}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 px-4">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <span className="text-sm">No conversations yet</span>
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
              activeId === conv.id ? 'bg-blue-50 border-l-2 border-l-[#0f2d5e]' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-800 truncate block">
                  {conv.subject || conv.participants_display || 'Conversation'}
                </span>
                {conv.last_message && (
                  <span className="text-xs text-gray-500 truncate block mt-0.5">
                    {conv.last_message.content}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {conv.last_message && (
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(conv.last_message.created_at).toLocaleDateString()}
                  </span>
                )}
                {conv.unread_count > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#f5801e] text-white text-[10px] font-bold">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
