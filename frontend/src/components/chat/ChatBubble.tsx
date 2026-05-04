import type { ChatMessage } from '@/types'

interface Props {
  message: ChatMessage
  isOwn: boolean
}

export default function ChatBubble({ message, isOwn }: Props) {
  if (message.is_system) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-1' : ''}`}>
        {!isOwn && (
          <span className="text-xs text-gray-500 ml-1 mb-0.5 block">
            {message.sender_name}
            <span className="ml-1.5 text-[10px] text-gray-400 uppercase">{message.sender_role}</span>
          </span>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isOwn
              ? 'bg-[#0f2d5e] text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          {message.content}
        </div>
        <div className={`flex items-center gap-1.5 mt-0.5 ${isOwn ? 'justify-end mr-1' : 'ml-1'}`}>
          <span className="text-[10px] text-gray-400">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOwn && (
            <span className="text-[10px] text-gray-400">
              {message.is_read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
