/**
 * Messages.tsx — Messaging page with conversation list and message thread.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Search, Plus, X, Send, Check, CheckCheck,
  Users, ChevronLeft, Phone, Loader2, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { chatApi, searchUsers, type ConversationItem, type MessageItem } from '@/api/chat'

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function msgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white font-heading">New Conversation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Subject (optional)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Shipment #1042 delay"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Participants</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search users by name…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {/* Selected chips */}
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {results.filter(u => selected.has(u.id)).map(u => (
                  <span key={u.id} onClick={() => toggle(u.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-ct-navy text-white cursor-pointer hover:bg-ct-navy/80">
                    {u.first_name} {u.last_name} <X className="w-3 h-3" />
                  </span>
                ))}
              </div>
            )}

            {/* Results */}
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {loading && <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />}
              {results.filter(u => !selected.has(u.id)).slice(0, 8).map(u => (
                <button key={u.id} onClick={() => toggle(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-ct-navy dark:text-white/70">
                    {initials(`${u.first_name} ${u.last_name}`)}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-white/80">{u.first_name} {u.last_name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--ct-navy)' }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Conversation list ────────────────────────────────────────────────────────

function ConversationListPanel({
  conversations, activeId, loading, onSelect, onNewChat,
}: {
  conversations: ConversationItem[]
  activeId: number | null
  loading: boolean
  onSelect: (id: number) => void
  onNewChat: () => void
}) {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1a2235] border-r border-gray-200 dark:border-white/8">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-white/8 flex items-center justify-between">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white font-heading">Messages</h1>
        <button onClick={onNewChat}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/8 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-gray-100 dark:bg-white/8 animate-pulse" />
                <div className="h-2.5 w-40 rounded bg-gray-50 dark:bg-white/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <MessageCircle className="w-10 h-10 text-gray-200 dark:text-white/15" />
          <p className="text-sm text-gray-400 dark:text-white/30 text-center">No conversations yet</p>
          <button onClick={onNewChat}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'var(--ct-navy)' }}>
            Start a conversation
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {conversations.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                activeId === c.id && 'bg-blue-50/60 dark:bg-blue-900/15 border-l-[3px] border-blue-500',
                !activeId && 'border-l-[3px] border-transparent',
              )}>
              <div className="relative shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-ct-navy dark:text-white/70">
                  {initials(c.participants_display || 'Chat')}
                </div>
                {c.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {c.unread_count > 9 ? '9+' : c.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm font-semibold truncate', c.unread_count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/60')}>
                    {c.subject || c.participants_display || 'Chat'}
                  </span>
                  {c.last_message && (
                    <span className="text-[10px] text-gray-400 dark:text-white/30 shrink-0">{timeAgo(c.last_message.created_at)}</span>
                  )}
                </div>
                {c.last_message ? (
                  <p className={cn('text-xs mt-0.5 truncate', c.unread_count > 0 ? 'text-gray-700 dark:text-white/50 font-medium' : 'text-gray-400 dark:text-white/25')}>
                    {c.last_message.sender_name}: {c.last_message.content}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5 italic">No messages yet</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Message thread ───────────────────────────────────────────────────────────

function MessageThreadPanel({
  conversation, messages, loading, currentUserId, onSend, onBack,
}: {
  conversation: ConversationItem | null
  messages: MessageItem[]
  loading: boolean
  currentUserId: number | null
  onSend: (text: string) => void
  onBack: () => void
}) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [conversation?.id])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  // Group messages by date
  const groups = useMemo(() => {
    const map = new Map<string, MessageItem[]>()
    for (const m of messages) {
      const day = new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(m)
    }
    return Array.from(map.entries())
  }, [messages])

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 p-8">
        <MessageCircle className="w-12 h-12 opacity-20" />
        <span className="text-sm">Select a conversation to start messaging</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/8 bg-white dark:bg-[#1a2235]">
        <button onClick={onBack} className="md:hidden p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-ct-navy dark:text-white/70 shrink-0">
          {initials(conversation.participants_display || conversation.subject || 'Chat')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {conversation.subject || conversation.participants_display || 'Chat'}
          </p>
          <p className="text-xs text-gray-400 dark:text-white/30">
            {conversation.participants.length} participant{conversation.participants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 bg-gray-50/50 dark:bg-[#0d1b2e]/50">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <MessageCircle className="w-8 h-8 text-gray-200 dark:text-white/10" />
            <p className="text-sm text-gray-400 dark:text-white/25">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          groups.map(([day, msgs]) => (
            <div key={day}>
              <p className="text-center text-[10px] font-semibold text-gray-400 dark:text-white/20 uppercase tracking-wider mb-3">{day}</p>
              <div className="space-y-1.5">
                {msgs.map(m => {
                  const isMe = m.sender_id === currentUserId
                  return m.is_system ? (
                    <p key={m.id} className="text-center text-[10px] text-gray-400 dark:text-white/20 italic py-1">{m.content}</p>
                  ) : (
                    <div key={m.id} className={cn('flex gap-2 max-w-[85%]', isMe ? 'ml-auto flex-row-reverse' : '')}>
                      {!isMe && (
                        <div className="w-6 h-6 rounded-full bg-ct-navy/15 dark:bg-white/15 flex items-center justify-center text-[9px] font-bold text-ct-navy dark:text-white/60 shrink-0 mt-1">
                          {initials(m.sender_name)}
                        </div>
                      )}
                      <div>
                        <div className={cn(
                          'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                          isMe
                            ? 'bg-[#0f2d5e] text-white rounded-br-md'
                            : 'bg-white dark:bg-[#1a2235] text-gray-800 dark:text-white/85 rounded-bl-md border border-gray-100 dark:border-white/5 shadow-sm',
                        )}>
                          {m.content}
                        </div>
                        <div className={cn('flex items-center gap-1 mt-0.5', isMe && 'justify-end')}>
                          <span className="text-[10px] text-gray-400 dark:text-white/25">{msgTime(m.created_at)}</span>
                          {isMe && (m.is_read ? <CheckCheck className="w-3 h-3 text-blue-400" /> : <Check className="w-3 h-3 text-gray-400" />)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend}
        className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-white/8 bg-white dark:bg-[#1a2235]">
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button type="submit" disabled={!draft.trim()}
          className="p-2.5 rounded-xl text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-navy)' }}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

// ── Main Messages page ───────────────────────────────────────────────────────

export default function Messages() {
  const user = useAuthStore(s => s.user)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const activeConversation = useMemo(() => conversations.find(c => c.id === activeId) ?? null, [conversations, activeId])

  async function loadConversations() {
    setConvsLoading(true)
    try {
      const r = await chatApi.listConversations()
      const data: any = r.data
      setConversations(Array.isArray(data) ? data : (data?.results ?? []))
    } catch { /* silent */ }
    finally { setConvsLoading(false) }
  }

  async function loadMessages(id: number) {
    setMsgsLoading(true)
    try {
      const r = await chatApi.getConversation(id)
      const data: any = r.data
      setMessages(data?.messages ?? [])
      await chatApi.markRead(id)
      setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
    } catch { setMessages([]) }
    finally { setMsgsLoading(false) }
  }

  function handleSelect(id: number) {
    setActiveId(id)
    loadMessages(id)
  }

  async function handleSend(text: string) {
    if (!activeId) return
    try {
      const r = await chatApi.sendMessage(activeId, text)
      setMessages(prev => [...prev, r.data])
      setConversations(prev => prev.map(c => c.id === activeId
        ? { ...c, last_message: { id: r.data.id, content: r.data.content, sender_name: r.data.sender_name, created_at: r.data.created_at, is_read: false } }
        : c,
      ))
    } catch { /* silently ignore send failures */ }
  }

  function handleCreated() {
    setShowNewChat(false)
    loadConversations()
  }

  useEffect(() => { loadConversations() }, [])
  useEffect(() => {
    const interval = setInterval(loadConversations, 15_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div className={cn('flex-shrink-0 w-80', activeId ? 'hidden md:block' : 'block w-full md:w-80')}>
        <ConversationListPanel
          conversations={conversations}
          activeId={activeId}
          loading={convsLoading}
          onSelect={handleSelect}
          onNewChat={() => setShowNewChat(true)}
        />
      </div>

      <div className={cn('flex-1 flex flex-col', !activeId && 'hidden md:flex')}>
        <MessageThreadPanel
          conversation={activeConversation}
          messages={messages}
          loading={msgsLoading}
          currentUserId={user?.id ?? null}
          onSend={handleSend}
          onBack={() => setActiveId(null)}
        />
      </div>

      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            onClose={() => setShowNewChat(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
