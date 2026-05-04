/**
 * Team.tsx — User management: list, invite, role assignment, deactivate.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, UserPlus, Shield, X, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import type { User } from '@/types'
import { useAuthStore } from '@/store/authStore'

interface TeamMember extends User {
  is_active: boolean
  last_login: string | null
  date_joined: string
}

type UserRole = 'ADMIN' | 'LOGISTICS_MGR' | 'CARRIER' | 'CLIENT'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:         'Admin',
  LOGISTICS_MGR: 'Logistics Mgr',
  CARRIER:       'Carrier',
  CLIENT:        'Client',
}

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:         'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  LOGISTICS_MGR: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  CARRIER:       'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  CLIENT:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', role: 'CLIENT' as UserRole })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email) { setErr('Email is required.'); return }
    setSaving(true); setErr('')
    try {
      await apiClient.post('/api/v1/accounts/invite/', form)
      setOk(true)
      setTimeout(() => { onInvited() }, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { email?: string[]; detail?: string } } })?.response?.data
      setErr(msg?.email?.[0] ?? msg?.detail ?? 'Invite failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white font-heading">Invite Team Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {ok ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Invitation sent!</p>
            <p className="text-xs text-gray-500 dark:text-white/40">An email has been sent to {form.email}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">First name</label>
                <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Last name</label>
                <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@company.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="CLIENT">Client</option>
                <option value="CARRIER">Carrier</option>
                <option value="LOGISTICS_MGR">Logistics Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--ct-navy)' }}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}

function RoleSelect({ member, onChanged }: { member: TeamMember; onChanged: (m: TeamMember) => void }) {
  const [loading, setLoading] = useState(false)

  async function change(role: UserRole) {
    setLoading(true)
    try {
      const { data } = await apiClient.patch<TeamMember>(`/api/v1/accounts/${member.id}/`, { role })
      onChanged({ ...member, ...data })
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      value={member.role}
      onChange={(e) => void change(e.target.value as UserRole)}
      disabled={loading}
      className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-medium text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60">
      <option value="CLIENT">Client</option>
      <option value="CARRIER">Carrier</option>
      <option value="LOGISTICS_MGR">Logistics Mgr</option>
      <option value="ADMIN">Admin</option>
    </select>
  )
}

export default function Team() {
  const currentUser = useAuthStore((s) => s.user)
  const [members,    setMembers]    = useState<TeamMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.get<any>('/api/v1/accounts/')
      const raw: any = res.data
      const data: TeamMember[] = Array.isArray(raw) ? raw : (raw?.results ?? [])
      setMembers(data)
    } catch {
      setError('Failed to load team members.')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(member: TeamMember) {
    try {
      const { data } = await apiClient.patch<TeamMember>(`/api/v1/accounts/${member.id}/`, {
        is_active: !member.is_active,
      })
      setMembers((ms) => ms.map((m) => m.id === member.id ? { ...m, ...data } : m))
    } catch {
      // silently ignore — could add toast
    }
  }

  useEffect(() => { void load() }, [])

  const isAdmin = currentUser?.role === 'ADMIN'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Team</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">{members.length} members</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--ct-orange)' }}>
            <UserPlus className="w-4 h-4" /> Invite
          </button>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <Users className="w-10 h-10 text-gray-200 dark:text-white/15" />
              <p className="text-sm font-medium text-gray-500 dark:text-white/50">No team members yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/8">
                    <th className="px-5 py-3.5 text-left font-medium">Member</th>
                    <th className="px-5 py-3.5 text-left font-medium">Role</th>
                    <th className="px-5 py-3.5 text-left font-medium">Company</th>
                    <th className="px-5 py-3.5 text-left font-medium">Last Login</th>
                    <th className="px-5 py-3.5 text-left font-medium">Joined</th>
                    <th className="px-5 py-3.5 text-left font-medium">Status</th>
                    {isAdmin && <th className="px-5 py-3.5 text-left font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  <AnimatePresence initial={false}>
                    {members.map((m, i) => (
                      <motion.tr key={m.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className={cn(
                          'transition-colors',
                          m.is_active
                            ? 'hover:bg-gray-50 dark:hover:bg-white/5'
                            : 'opacity-50 hover:bg-gray-50 dark:hover:bg-white/5',
                        )}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: 'var(--ct-navy)' }}>
                              {(m.first_name?.[0] ?? m.username[0]).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username}
                                {m.id === currentUser?.id && (
                                  <span className="ml-1.5 text-xs text-gray-400 dark:text-white/30">(you)</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-white/30">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {isAdmin && m.id !== currentUser?.id ? (
                            <RoleSelect member={m} onChanged={(updated) => setMembers((ms) => ms.map((x) => x.id === m.id ? updated : x))} />
                          ) : (
                            <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', ROLE_COLORS[m.role as UserRole])}>
                              <Shield className="w-3 h-3 mr-1 mt-px" />
                              {ROLE_LABELS[m.role as UserRole] ?? m.role}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">{m.company || '—'}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                          {m.last_login
                            ? new Date(m.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Never'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                          {m.date_joined
                            ? new Date(m.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                            m.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-white/8 dark:text-white/40',
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', m.is_active ? 'bg-emerald-500' : 'bg-gray-400')} />
                            {m.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            {m.id !== currentUser?.id && (
                              <button
                                onClick={() => void toggleActive(m)}
                                className={cn(
                                  'text-xs font-medium px-3 py-1 rounded-lg transition-colors',
                                  m.is_active
                                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                                    : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20',
                                )}>
                                {m.is_active ? 'Deactivate' : 'Reactivate'}
                              </button>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showInvite && (
          <InviteModal
            onClose={() => setShowInvite(false)}
            onInvited={() => { setShowInvite(false); void load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
