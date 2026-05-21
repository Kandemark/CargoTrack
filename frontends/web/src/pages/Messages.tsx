/**
 * Messages.tsx — Real-time messaging page using WebSocket-backed useChat hook.
 *
 * Features: optimistic sends, typing indicators, read receipts, connection
 * status, date separators, grouped message bubbles, conversation search.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Search, Plus, X, Send, Check, CheckCheck,
  Users, ChevronLeft, Loader2, Wifi, WifiOff, Clock,
  Pencil, Trash2, ShieldCheck, Pin,
  Lock, Paperclip, FileText, Music,
  Copy, Reply, Forward,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useChat } from '@/hooks/useChat'
import { chatApi, searchUsers } from '@/api/chat'
import type { Conversation, ChatMessage, TypingEvent } from '@/types'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu'

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

// ── Forward Modal ──────────────────────────────────────────────────────────────

function ForwardModal({
  conversations, activeId, onSelect, onClose,
}: {
  conversations: Conversation[]
  activeId: number | null
  onSelect: (convId: number) => void
  onClose: () => void
}) {
  const filtered = conversations.filter(c => c.id !== activeId)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Forward to...</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No other conversations</p>
          ) : (
            filtered.map(c => (
              <button key={c.id} onClick={() => onSelect(c.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="w-9 h-9 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-ct-navy dark:text-white/70">
                  {initials(c.subject || c.participants_display || 'Chat')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 dark:text-white/80 truncate">{c.subject || c.participants_display || 'Chat'}</p>
                  <p className="text-[10px] text-gray-400">{c.participants.length} participant{c.participants.length !== 1 ? 's' : ''}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── New Chat Modal ───────────────────────────────────────────────────────────

function NewChatModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: number; first_name: string; last_name: string; role: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [subject, setSubject] = useState('')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await searchUsers(q)
        const data: any = r.data
        setResults(data?.results ?? [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size === 0) { setErr('Select at least one participant.'); return }
    setCreating(true); setErr('')
    try {
      await chatApi.createConversation({
        participant_ids: Array.from(selected),
        subject: subject.trim() || undefined,
      })
      onCreated()
    } catch {
      setErr('Failed to create conversation.')
    } finally {
      setCreating(false)
    }
  }

  const selectedUsers = results.filter(u => selected.has(u.id))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New Conversation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1.5">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Shipment #1042 delivery delay"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1.5">Participants</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {/* Selected chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedUsers.map(u => (
                  <span key={u.id} onClick={() => toggle(u.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-ct-navy text-white cursor-pointer hover:bg-ct-navy/80 transition-colors">
                    {u.first_name} {u.last_name} <X className="w-3 h-3" />
                  </span>
                ))}
              </div>
            )}

            {/* Results */}
            <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
              {results.filter(u => !selected.has(u.id)).slice(0, 8).map(u => (
                <button key={u.id} onClick={() => toggle(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-ct-navy dark:text-white/70">
                    {initials(`${u.first_name} ${u.last_name}`)}
                  </div>
                  <div>
                    <span className="text-sm text-gray-700 dark:text-white/80 block">{u.first_name} {u.last_name}</span>
                    <span className="text-[10px] text-gray-400 uppercase">{u.role}</span>
                  </div>
                </button>
              ))}
              {!loading && q.length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No users found</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={creating || selected.size === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--ct-navy)' }}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Conversation List Panel ──────────────────────────────────────────────────

function ConversationListPanel({
  conversations, activeId, onSelect, onNewChat, connected,
}: {
  conversations: Conversation[]
  activeId: number | null
  onSelect: (id: number) => void
  onNewChat: () => void
  connected: boolean
}) {
  const [convSearch, setConvSearch] = useState('')

  const filtered = useMemo(() => {
    if (!convSearch.trim()) return conversations
    const q = convSearch.toLowerCase()
    return conversations.filter(c =>
      (c.subject || '').toLowerCase().includes(q) ||
      (c.participants_display || '').toLowerCase().includes(q) ||
      (c.last_message?.content || '').toLowerCase().includes(q),
    )
  }, [conversations, convSearch])

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1a2235] border-r border-gray-200 dark:border-white/8">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-white/8 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Messages</h1>
            {connected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400" />
            )}
          </div>
          <button onClick={onNewChat}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={convSearch}
            onChange={e => setConvSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-gray-300 dark:text-white/15" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-white/30">No conversations yet</p>
              <p className="text-xs text-gray-400 dark:text-white/20 mt-1">Search for users to start messaging</p>
            </div>
            <button onClick={onNewChat}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--ct-navy)' }}>
              <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              New Conversation
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
            <p className="text-sm text-gray-400 dark:text-white/25">No conversations match "{convSearch}"</p>
          </div>
        ) : (
          filtered.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5 group',
                activeId === c.id && 'bg-blue-50/60 dark:bg-blue-900/20 border-l-[3px] border-blue-500',
                activeId !== c.id && 'border-l-[3px] border-transparent',
              )}>
              {/* Avatar */}
              <div className="relative shrink-0 mt-0.5">
                <div className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  activeId === c.id
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-ct-navy/10 dark:bg-white/10 text-ct-navy dark:text-white/70 group-hover:bg-ct-navy/15 dark:group-hover:bg-white/15',
                )}>
                  {initials(c.participants_display || 'Chat')}
                </div>
                {/* Unread badge */}
                {c.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md">
                    {c.unread_count > 99 ? '99+' : c.unread_count}
                  </span>
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-sm truncate',
                    c.unread_count > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-white/70',
                  )}>
                    {c.subject || c.participants_display || 'Chat'}
                  </span>
                  {c.last_message && (
                    <span className="text-[10px] text-gray-400 dark:text-white/30 shrink-0">{timeAgo(c.last_message.created_at)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className={cn(
                    'text-xs truncate flex-1',
                    c.unread_count > 0 ? 'text-gray-700 dark:text-white/60 font-medium' : 'text-gray-400 dark:text-white/25',
                  )}>
                    {c.last_message
                      ? `${c.last_message.sender_name}: ${c.last_message.content}`
                      : 'No messages yet'}
                  </p>
                  {/* Read receipt for last message (if sent by current user) */}
                  {c.last_message?.is_read && (
                    <CheckCheck className="w-3 h-3 text-blue-400 shrink-0" />
                  )}
                </div>
                {/* Participant list for group chats */}
                {c.is_group && (
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-400">{c.participants.length} members</span>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Message Thread Panel ─────────────────────────────────────────────────────

function MessageThreadPanel({
  conversation, messages, typingUsers, loading, connected, currentUserId, onSend, onEdit, onDelete, onTyping, onBack,
  onUploadAttachment, conversations, onSelectConversation,
}: {
  conversation: Conversation | null
  messages: ChatMessage[]
  typingUsers: TypingEvent[]
  loading: boolean
  connected: boolean
  currentUserId: number | null
  onSend: (text: string) => void
  onEdit: (messageId: number, content: string) => void
  onDelete: (messageId: number) => void
  onTyping: () => void
  onBack: () => void
  onUploadAttachment: (file: File, content?: string) => void
  conversations: Conversation[]
  onSelectConversation: (id: number) => void
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [editMsgId, setEditMsgId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [_menuOpen, _setMenuOpen] = useState<number | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ messageId: number; x: number; y: number } | null>(null)
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typingUsers])
  useEffect(() => { textareaRef.current?.focus() }, [conversation?.id])

  function submitDraft() {
    const text = draft.trim()
    const files = pendingFiles
    if (!text && files.length === 0) return

    if (files.length > 0) {
      for (const f of files) onUploadAttachment(f.file, text)
      setPendingFiles([])
    } else {
      onSend(text)
    }
    setDraft('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitDraft()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitDraft()
    }
  }

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  function handleTyping() {
    onTyping()
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => { /* throttle */ }, 2000)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) {
          setPendingFiles((prev) => [...prev, { file, preview: URL.createObjectURL(file) }])
        }
        return
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setPendingFiles((prev) => [...prev, { file, preview: URL.createObjectURL(file) }])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  function handleReply(msg: ChatMessage) {
    const quote = `> @${msg.sender_name}: ${msg.content}`
    setDraft((prev) => (prev ? `${quote}\n${prev}` : `${quote}\n`))
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleForward(msg: ChatMessage) {
    setForwardMsg(msg)
  }

  function doForward(convId: number) {
    if (!forwardMsg) return
    navigator.clipboard.writeText(forwardMsg.content).catch(() => {})
    setForwardMsg(null)
    onSelectConversation(convId)
  }

  // Group messages by date
  const groups = useMemo(() => {
    const map = new Map<string, ChatMessage[]>()
    for (const m of messages) {
      const day = fmtDay(m.created_at)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(m)
    }
    return Array.from(map.entries())
  }, [messages])

  // For 1-on-1 chats, find the other participant to link to their profile
  const otherParticipantId = (!conversation?.is_group && conversation?.participants?.length === 2)
    ? conversation.participants.find((p: number) => p !== currentUserId)
    : null

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-[#0d1b2e]/50 gap-4 p-8">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
          <MessageCircle className="w-10 h-10 text-gray-300 dark:text-white/15" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-white/30">Select a conversation</p>
          <p className="text-xs text-gray-400 dark:text-white/20 mt-1">Pick a chat from the left to start messaging</p>
        </div>
      </div>
    )
  }

  const headerName = conversation.subject || conversation.participants_display || 'Chat'

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/8 bg-white dark:bg-[#1a2235]">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        {otherParticipantId ? (
          <button onClick={() => navigate(`/profile/${otherParticipantId}`)}
            className="relative shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-ct-navy dark:text-white/70">
              {initials(conversation.participants_display || 'Chat')}
            </div>
          </button>
        ) : (
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-ct-navy dark:text-white/70">
              {initials(headerName)}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {otherParticipantId ? (
            <button onClick={() => navigate(`/profile/${otherParticipantId}`)}
              className="text-sm font-semibold text-gray-900 dark:text-white truncate hover:text-ct-navy dark:hover:text-blue-400 transition-colors text-left">
              {headerName}
            </button>
          ) : (
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {headerName}
            </p>
          )}
          <p className="text-[10px] text-gray-400 dark:text-white/30 flex items-center gap-1.5">
            {connected ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online</>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Reconnecting...</>
            )}
            <span className="text-gray-300 dark:text-white/15">·</span>
            {conversation.participants.length} participant{conversation.participants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Announcement banner */}
      {conversation.announcement && (
        <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-800 dark:text-amber-200 flex-1 truncate">{conversation.announcement}</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 bg-gray-50/50 dark:bg-[#0d1b2e]/50">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <Clock className="w-7 h-7 text-gray-300 dark:text-white/15" />
            </div>
            <p className="text-sm text-gray-500 dark:text-white/25">No messages yet</p>
            <p className="text-xs text-gray-400 dark:text-white/20">Send the first message to start the conversation</p>
          </div>
        ) : (
          groups.map(([day, msgs]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-white/8" />
                <span className="text-[10px] font-semibold text-gray-400 dark:text-white/20 uppercase tracking-wider shrink-0">{day}</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-white/8" />
              </div>
              <div className="space-y-1">
                {msgs.map((m, i) => {
                  const isMe = m.sender_id === currentUserId
                  if (m.is_system) {
                    return (
                      <p key={m.id} className="text-center text-[10px] text-gray-400 dark:text-white/20 italic py-1.5">{m.content}</p>
                    )
                  }
                  const prevMsg = i > 0 ? msgs[i - 1] : null
                  const showAvatar = !isMe && (!prevMsg || prevMsg.sender_id !== m.sender_id)
                  const isConsecutive = prevMsg && prevMsg.sender_id === m.sender_id &&
                    (new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 300_000

                  if (m.is_deleted) {
                    return (
                      <div key={m.id} className="text-center py-1">
                        <span className="text-[11px] text-gray-400 dark:text-white/20 italic">Message deleted</span>
                      </div>
                    )
                  }

                  const isEditing = editMsgId === m.id

                  void (['Copy Text', ...(isMe ? ['Edit', 'Delete'] : []), 'Reply', 'Forward'] as const)

                  return (
                    <div key={m.id}
                      className={cn(
                        'flex gap-2 max-w-[82%] group relative',
                        isMe ? 'ml-auto flex-row-reverse' : '',
                        isConsecutive && !isMe ? 'ml-8' : '',
                      )}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setCtxMenu({ messageId: m.id, x: e.clientX, y: e.clientY })
                      }}>
                      {!isMe && showAvatar ? (
                        <div className="w-7 h-7 rounded-full bg-ct-navy/15 dark:bg-white/15 flex items-center justify-center text-[9px] font-bold text-ct-navy dark:text-white/60 shrink-0 mt-1">
                          {initials(m.sender_name)}
                        </div>
                      ) : !isMe ? (
                        <div className="w-7 h-7 shrink-0" />
                      ) : null}
                      <div className="relative">
                        {!isMe && showAvatar && (
                          <span className="text-[10px] text-gray-400 dark:text-white/25 ml-1 mb-0.5 block">
                            {m.sender_name}
                            <span className="ml-1 text-[9px] uppercase opacity-60">{m.sender_role}</span>
                          </span>
                        )}

                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="px-3 py-1.5 rounded-xl border border-blue-400 bg-white dark:bg-[#1a2235] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px]"
                              autoFocus
                            />
                            <button onClick={() => { onEdit(m.id, editContent); setEditMsgId(null) }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600">Save</button>
                            <button onClick={() => setEditMsgId(null)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
                          </div>
                        ) : (
                          <div className={cn(
                            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed relative overflow-hidden',
                            isMe
                              ? cn('bg-[#0f2d5e] text-white', isConsecutive ? 'rounded-br-md' : 'rounded-br-md')
                              : cn('bg-white dark:bg-[#1a2235] text-gray-800 dark:text-white/85 border border-gray-100 dark:border-white/5 shadow-sm', isConsecutive ? 'rounded-bl-md' : 'rounded-bl-md'),
                          )}>
                            {m.is_encrypted && (
                              <Lock className="w-3 h-3 inline mr-1 -mt-0.5 text-amber-400" />
                            )}
                            {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}
                            {/* Attachment rendering */}
                            {m.attachment_url && m.attachment_type === 'IMAGE' && (
                              <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-2 -mx-3.5 -mb-2.5">
                                <img src={m.attachment_url} alt="attachment" className="max-w-full max-h-64 rounded-b-2xl object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                              </a>
                            )}
                            {m.attachment_url && m.attachment_type === 'VIDEO' && (
                              <div className="mt-2 -mx-3.5 -mb-2.5">
                                <video src={m.attachment_url} controls className="max-w-full max-h-64 rounded-b-2xl" />
                              </div>
                            )}
                            {m.attachment_url && m.attachment_type === 'AUDIO' && (
                              <div className="mt-2">
                                <audio src={m.attachment_url} controls className="max-w-full h-8" />
                              </div>
                            )}
                            {m.attachment_url && (m.attachment_type === 'DOCUMENT' || !m.attachment_type) && (
                              <a href={m.attachment_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors">
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="text-xs truncate">Download attachment</span>
                                {m.file_size > 0 && <span className="text-[10px] opacity-60 shrink-0">{formatBytes(m.file_size)}</span>}
                              </a>
                            )}
                          </div>
                        )}

                        {m.is_edited && !m.is_deleted && (
                          <span className={cn('text-[9px] text-gray-400 dark:text-white/20 italic', isMe ? 'text-right block mr-1' : 'ml-1')}>(edited)</span>
                        )}

                        <div className={cn('flex items-center gap-1.5 mt-0.5', isMe && 'justify-end mr-1')}>
                          <span className="text-[10px] text-gray-400 dark:text-white/25">{fmtTime(m.created_at)}</span>
                          {isMe && (
                            m.is_read
                              ? <CheckCheck className="w-3 h-3 text-blue-400" />
                              : <Check className="w-3 h-3 text-gray-400 dark:text-white/20" />
                          )}
                          {m.is_encrypted && (
                            <ShieldCheck className="w-3 h-3 text-green-400" />
                          )}
                        </div>

                        {isMe && !m.is_deleted && (
                          <div className={cn(
                            'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-white dark:bg-[#1a2235] rounded-lg shadow-lg border border-gray-200 dark:border-white/10 px-0.5 py-0.5 z-10',
                            isMe ? '-left-16' : '-right-16',
                          )}>
                            <button onClick={() => { setEditMsgId(m.id); setEditContent(m.content) }}
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDelete(m.id)}
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-3 pl-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-400 dark:text-white/25 italic">
              {typingUsers.map(u => u.user_name).join(', ')} typing...
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context Menu */}
      {ctxMenu && (() => {
        const msg = messages.find(m => m.id === ctxMenu.messageId)
        if (!msg) { setCtxMenu(null); return null }
        const isMe = msg.sender_id === currentUserId
        const items: ContextMenuItem[] = [
          { label: 'Copy Text', icon: Copy, onClick: () => handleCopy(msg.content) },
          ...(isMe ? [
            { label: 'Edit', icon: Pencil, onClick: () => { setEditMsgId(msg.id); setEditContent(msg.content) } },
            { label: 'Delete', icon: Trash2, onClick: () => onDelete(msg.id), danger: true },
          ] : []),
          { label: 'Reply', icon: Reply, onClick: () => handleReply(msg) },
          { label: 'Forward', icon: Forward, onClick: () => handleForward(msg) },
        ]
        return <ContextMenu position={{ x: ctxMenu.x, y: ctxMenu.y }} items={items} onClose={() => setCtxMenu(null)} />
      })()}

      {/* Forward Modal */}
      <AnimatePresence>
        {forwardMsg && (
          <ForwardModal
            conversations={conversations}
            activeId={conversation?.id ?? null}
            onSelect={doForward}
            onClose={() => setForwardMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSubmit}
        className="border-t border-gray-200 dark:border-white/8 bg-white dark:bg-[#1a2235]">
        {/* Attachment preview chips */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {pendingFiles.map((f, i) => (
              <div key={i} className="relative group">
                {f.file.type.startsWith('image/') ? (
                  <img src={f.preview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-white/10" />
                ) : f.file.type.startsWith('audio/') ? (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-400" />
                  </div>
                ) : f.file.type.startsWith('video/') ? (
                  <video src={f.preview} className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-white/10" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <button onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
                <span className="block text-[9px] text-gray-400 truncate w-16 text-center mt-0.5">{f.file.name.slice(0, 12)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3">
          {/* File picker */}
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={handleFileSelect} />

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); handleTyping(); autoResize() }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-shadow resize-none"
            style={{ maxHeight: '128px' }}
          />
          <button type="submit" disabled={!draft.trim() && pendingFiles.length === 0}
            className="p-2.5 rounded-xl text-white disabled:opacity-40 hover:opacity-90 transition-all active:scale-95"
            style={{ background: 'var(--ct-navy)' }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
}


// ── Main Messages Page ───────────────────────────────────────────────────────

export default function Messages() {
  const user = useAuthStore(s => s.user)
  const chat = useChat()
  const [showNewChat, setShowNewChat] = useState(false)

  const activeConversation = useMemo(
    () => chat.conversations.find(c => c.id === chat.activeConversation?.id) ?? null,
    [chat.conversations, chat.activeConversation],
  )

  return (
    <div className="h-full -mx-4 sm:-mx-6 -my-4 sm:-my-6 flex">
      {/* Conversation List — hidden on mobile when thread is open */}
      <div className={cn(
        'flex-shrink-0 w-80',
        chat.activeConversation ? 'hidden md:block' : 'block w-full md:w-80',
      )}>
        <ConversationListPanel
          conversations={chat.conversations}
          activeId={chat.activeConversation?.id ?? null}
          onSelect={chat.selectConversation}
          onNewChat={() => setShowNewChat(true)}
          connected={chat.connected}
        />
      </div>

      {/* Thread — hidden on mobile when no conversation selected */}
      <div className={cn(
        'flex-1 flex flex-col',
        !chat.activeConversation && 'hidden md:flex',
      )}>
        <MessageThreadPanel
          conversation={activeConversation}
          messages={chat.messages}
          typingUsers={chat.typingUsers as any}
          loading={chat.loading}
          connected={chat.connected}
          currentUserId={user?.id ?? null}
          onSend={chat.sendMessage}
          onEdit={chat.editMessage}
          onDelete={chat.deleteMessage}
          onTyping={chat.sendTyping}
          onBack={() => chat.deselectConversation()}
          onUploadAttachment={chat.uploadAttachment}
          conversations={chat.conversations}
          onSelectConversation={chat.selectConversation}
        />
      </div>

      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            onClose={() => setShowNewChat(false)}
            onCreated={() => { setShowNewChat(false); chat.refreshConversations() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
