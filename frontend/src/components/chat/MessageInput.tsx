import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Paperclip } from 'lucide-react'

interface Props {
  onSend: (content: string) => void
  onTyping: () => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onTyping, disabled }: Props) {
  const [text, setText] = useState('')

  function submit() {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3 border-t border-gray-100 bg-white">
      <button
        type="button"
        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        title="Attach file"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onTyping()
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
        style={{ maxHeight: '120px' }}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="p-2 rounded-xl bg-[#0f2d5e] text-white hover:bg-[#0a2047] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
