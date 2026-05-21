/**
 * SocialCenter.tsx — Business social feed (like X/Bluesky for logistics).
 *
 * Features: feed posts, likes, comments, community posts, announcements.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Heart, Send, Megaphone, Pin,
  Loader2, Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { chatApi } from '@/api/chat'

interface SocialPost {
  id: number
  author: number
  author_name: string
  author_role: string
  author_org: string | null
  content: string
  is_pinned: boolean
  is_announcement: boolean
  like_count: number
  reply_count: number
  comment_count: number
  is_liked: boolean
  created_at: string
  comments?: SocialComment[]
}

interface SocialComment {
  id: number
  post: number
  author: number
  author_name: string
  content: string
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function SocialCenter() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [expandedPost, setExpandedPost] = useState<number | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({})

  const loadPosts = useCallback(() => {
    apiClient.get<SocialPost[]>('/api/v1/chat/social/feed/')
      .then(({ data }) => setPosts(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  async function handlePost() {
    const content = draft.trim()
    if (!content) return
    setPosting(true)
    try {
      const { data } = await apiClient.post<SocialPost>('/api/v1/chat/social/feed/', { content })
      setPosts(prev => [data, ...prev])
      setDraft('')
    } catch { /* ignore */ }
    finally { setPosting(false) }
  }

  async function handleLike(postId: number) {
    try {
      const { data } = await apiClient.post<{ liked: boolean; like_count: number }>(
        `/api/v1/chat/social/posts/${postId}/like/`)
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, is_liked: data.liked, like_count: data.like_count } : p))
    } catch { /* ignore */ }
  }

  async function handleLoadComments(postId: number) {
    if (expandedPost === postId) { setExpandedPost(null); return }
    try {
      const { data } = await apiClient.get<SocialPost>(`/api/v1/chat/social/posts/${postId}/`)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: data.comments } : p))
      setExpandedPost(postId)
    } catch { /* ignore */ }
  }

  async function handleComment(postId: number) {
    const content = (commentDrafts[postId] || '').trim()
    if (!content) return
    try {
      const { data } = await apiClient.post<SocialComment>(`/api/v1/chat/social/posts/${postId}/comments/`, { content })
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments: [...(p.comments || []), data], comment_count: (p.comment_count || 0) + 1, reply_count: p.reply_count + 1 }
        : p))
      setCommentDrafts(prev => ({ ...prev, [postId]: '' }))
    } catch { /* ignore */ }
  }

  async function handleMessage(authorId: number) {
    try {
      const conv = await chatApi.createConversation({ participant_ids: [authorId] })
      const cdata: any = conv.data
      navigate(`/messages?conversation=${cdata.id}`)
    } catch { navigate('/messages') }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Social Center</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">Business threads & announcements</p>
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 space-y-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-ct-navy flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials(user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username || '?')}
          </div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Share a logistics update, ask a question, or post an announcement..."
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none min-h-[60px]"
            rows={2}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-white/30">Visible to your organization</span>
          <button onClick={handlePost} disabled={!draft.trim() || posting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--ct-navy)' }}>
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Megaphone className="w-10 h-10 text-gray-200 dark:text-white/10" />
          <p className="text-sm text-gray-500 dark:text-white/30">No posts yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-ct-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-ct-navy dark:text-white/70 shrink-0">
                  {initials(post.author_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{post.author_name}</span>
                    {post.author_org && (
                      <span className="text-[11px] text-gray-400 dark:text-white/30 flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />{post.author_org}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 dark:text-white/30">· {timeAgo(post.created_at)}</span>
                    {post.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                    {post.is_announcement && <Megaphone className="w-3 h-3 text-blue-500" />}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-white/80 mt-1.5 whitespace-pre-wrap">{post.content}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pl-[52px]">
                <button onClick={() => handleLike(post.id)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-colors',
                    post.is_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500 dark:text-white/30',
                  )}>
                  <Heart className={cn('w-3.5 h-3.5', post.is_liked && 'fill-current')} />
                  {post.like_count > 0 && post.like_count}
                </button>
                <button onClick={() => handleLoadComments(post.id)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 dark:text-white/30 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {post.reply_count > 0 && post.reply_count}
                </button>
                {post.author !== user?.id && (
                  <button onClick={() => handleMessage(post.author)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-ct-navy dark:hover:text-blue-400 dark:text-white/30 transition-colors">
                    <Send className="w-3 h-3" /> Message
                  </button>
                )}
              </div>

              {/* Comments */}
              <AnimatePresence>
                {expandedPost === post.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="border-t border-gray-100 dark:border-white/8 pt-3 pl-[52px] space-y-2 overflow-hidden">
                    {post.comments?.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <span className="text-[11px] font-semibold text-ct-navy dark:text-blue-400 shrink-0">{c.author_name}</span>
                        <p className="text-xs text-gray-600 dark:text-white/60">{c.content}</p>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input
                        value={commentDrafts[post.id] || ''}
                        onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button onClick={() => handleComment(post.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: 'var(--ct-navy)' }}>
                        Reply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
