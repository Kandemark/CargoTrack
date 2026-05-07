import { useState } from 'react'
import { X, Search } from 'lucide-react'

interface Props {
  onClose: () => void
  onCreate: (participantIds: number[], subject?: string) => void
}

// Stubbed user search — in production this hits a user search endpoint
export default function NewChatModal({ onClose, onCreate }: Props) {
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')

  function handleStart() {
    // For now, create a conversation with a placeholder — actual user search
    // would be wired to GET /api/v1/accounts/users/?search=
    onCreate([], subject || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">New Conversation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Shipment SHP-001 update"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search users</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              User search will be available once a user directory endpoint is wired.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#0f2d5e] rounded-lg hover:bg-[#0a2047]"
          >
            Start conversation
          </button>
        </div>
      </div>
    </div>
  )
}
