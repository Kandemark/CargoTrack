/**
 * Profile.tsx — Public user profile page at /profile/:id
 *
 * Displays a user's name, role, organization, and activity summary.
 * Accessible to members of the same organization.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Calendar, Clock,
  Shield, MessageCircle, Loader2, Hash, UserCircle,
} from 'lucide-react'
import { accountApi, type PublicUserProfile } from '@/api/account'
import { useAuthStore } from '@/store/authStore'
import { useChat } from '@/hooks/useChat'
import { getRoleDashboard } from '@/lib/roleUtils'

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  LOGISTICS_MGR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CLIENT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  CARRIER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  DISPATCHER: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  CUSTOMS_BROKER: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  WAREHOUSE_MGR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  PORT_AGENT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  FINANCE_OFFICER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const chat = useChat()
  const userId = Number(id)

  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError('')
    accountApi.getPublicProfile(userId)
      .then(({ data }) => setProfile(data))
      .catch(() => setError('User not found or you do not have permission to view this profile.'))
      .finally(() => setLoading(false))
  }, [userId])

  const isSelf = currentUser?.id === userId

  async function handleSendMessage() {
    if (!profile) return
    try {
      const conv = await chat.createConversation([profile.id], undefined)
      navigate(`/messages?conversation=${conv.id}`)
    } catch {
      navigate('/messages')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
          <UserCircle className="w-8 h-8 text-gray-300 dark:text-white/15" />
        </div>
        <p className="text-sm text-gray-500 dark:text-white/30">{error || 'Profile not found.'}</p>
        <button onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          Go back
        </button>
      </div>
    )
  }

  const roleColor = ROLE_COLORS[profile.role] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header card */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-sm overflow-hidden">
        {/* Cover area */}
        <div className="h-24 bg-gradient-to-r from-[#0f2d5e] via-[#1a4a8a] to-[#0f2d5e]" />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end gap-5 -mt-10">
            <div className="w-24 h-24 rounded-2xl bg-white dark:bg-[#1a2235] border-4 border-white dark:border-[#1a2235] flex items-center justify-center text-3xl font-bold text-[#0f2d5e] dark:text-white shadow-md">
              {initials(profile.first_name, profile.last_name)}
            </div>
            <div className="mb-1 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {profile.first_name} {profile.last_name}
                </h1>
                {isSelf && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/40">
                    You
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-white/40">@{profile.username}</p>
              <span className={`inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${roleColor}`}>
                <Shield className="w-3 h-3 inline -mt-0.5 mr-1" />
                {profile.role_display || profile.role}
              </span>
            </div>

            {!isSelf && (
              <div className="flex items-center gap-2">
                <button onClick={handleSendMessage}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--ct-navy)' }}>
                  <MessageCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Message
                </button>
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'PLATFORM_OWNER') && (
                  <button
                    onClick={async () => {
                      try {
                        const targetRole = await useAuthStore.getState().impersonate(profile.id)
                        navigate(targetRole ? getRoleDashboard(targetRole) : '/dashboard')
                      } catch { /* 403 — silenced */ }
                    }}
                    className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white transition-opacity hover:opacity-90"
                  >
                    Impersonate
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info card */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-gray-400" />
            Details
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Hash className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 dark:text-white/40 w-20 shrink-0">User ID</span>
              <span className="text-gray-900 dark:text-white font-mono text-xs">{profile.id}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 dark:text-white/40 w-20 shrink-0">Organization</span>
              <span className="text-gray-900 dark:text-white">{profile.org_name || '—'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 dark:text-white/40 w-20 shrink-0">Member since</span>
              <span className="text-gray-900 dark:text-white">{fmtDate(profile.date_joined)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 dark:text-white/40 w-20 shrink-0">Last seen</span>
              <span className="text-gray-900 dark:text-white text-xs">{fmtDateTime(profile.last_login)}</span>
            </div>
          </div>
        </div>

        {/* Role card */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            Role & Permissions
          </h2>

          <div className="space-y-3">
            <div>
              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${roleColor}`}>
                {profile.role_display || profile.role}
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 dark:text-white/40">Access level</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.role === 'ADMIN' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Full system access</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">User management</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Audit logs</span>
                  </>
                )}
                {profile.role === 'LOGISTICS_MGR' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Shipment management</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Route planning</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Fleet oversight</span>
                  </>
                )}
                {profile.role === 'CLIENT' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Track shipments</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Place orders</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">View documents</span>
                  </>
                )}
                {profile.role === 'CARRIER' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Accept loads</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Log events</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Update ETA</span>
                  </>
                )}
                {profile.role === 'DISPATCHER' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Assign loads</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Route dispatch</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Live tracking</span>
                  </>
                )}
                {profile.role === 'CUSTOMS_BROKER' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Customs clearance</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Document processing</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Compliance check</span>
                  </>
                )}
                {profile.role === 'WAREHOUSE_MGR' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Inventory management</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Inbound/outbound</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Stock audit</span>
                  </>
                )}
                {profile.role === 'PORT_AGENT' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Vessel tracking</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Container management</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Manifest handling</span>
                  </>
                )}
                {profile.role === 'FINANCE_OFFICER' && (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Invoice management</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Payment processing</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/50">Financial reports</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick info footer */}
      <div className="text-center pb-8">
        <p className="text-[11px] text-gray-400 dark:text-white/20">
          Profile information is visible to members of {profile.org_name || 'your organization'}.
          {isSelf && ' Manage your profile in Settings.'}
        </p>
      </div>
    </div>
  )
}
