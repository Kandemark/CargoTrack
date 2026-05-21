import type { TypingEvent } from '@/types'

export default function TypingIndicator({ users }: { users: TypingEvent[] }) {
  if (users.length === 0) return null

  const names = users.map((u) => u.user_name).join(', ')

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400">
      <div className="flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>
        {users.length === 1 ? `${names} is typing` : `${names} are typing`}...
      </span>
    </div>
  )
}
