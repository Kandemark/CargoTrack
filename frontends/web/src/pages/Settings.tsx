/**
 * Settings.tsx — Profile, Notifications, API Keys, Billing, Payment Providers,
 * Sessions, Security, and Preferences tabs.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Bell, Key, CreditCard, Zap, Eye, EyeOff, Copy, Check,
  Plus, Trash2, RefreshCw, Shield, Monitor, Sliders, Activity,
  Clock, FileText, LogIn, AlertTriangle, Smartphone, Globe,
  Truck, Package, QrCode, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/roleUtils'
import apiClient from '@/api/client'
import { accountApi, type ActivityItem, type UserStats, type SessionItem, type SecurityLogEntry, type NotifPrefs } from '@/api/account'
import { useAuthStore } from '@/store/authStore'

type Tab = 'profile' | 'notifications' | 'api-keys' | 'billing' | 'providers' | 'sessions' | 'security' | 'preferences'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'profile',       label: 'Profile',        icon: <User className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications',  icon: <Bell className="w-4 h-4" /> },
  { key: 'api-keys',      label: 'API Keys',       icon: <Key className="w-4 h-4" /> },
  { key: 'billing',       label: 'Billing',        icon: <CreditCard className="w-4 h-4" /> },
  { key: 'providers',     label: 'Pay Providers',  icon: <Zap className="w-4 h-4" /> },
  { key: 'sessions',      label: 'Sessions',       icon: <Monitor className="w-4 h-4" /> },
  { key: 'security',      label: 'Security',       icon: <Shield className="w-4 h-4" /> },
  { key: 'preferences',   label: 'Preferences',    icon: <Sliders className="w-4 h-4" /> },
]

// ── Time ago helper ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  tracking_event: Activity, document_upload: FileText, login: LogIn, logout: LogIn,
  password_change: Shield, api_key_create: Key, api_key_delete: Trash2,
}

// ── Profile Tab (with account overview, activity timeline & stats) ──────────

function ProfileTab() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name:  user?.last_name  ?? '',
    phone:      user?.phone      ?? '',
  })
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [pwForm,   setPwForm]   = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwErr,    setPwErr]    = useState('')
  const [pwOk,     setPwOk]     = useState(false)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])

  const roleColor = ROLE_COLOR[user?.role ?? ''] ?? '#0f2d5e'
  const roleLabel = ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? ''

  useEffect(() => {
    accountApi.stats().then(r => setStats(r.data)).catch(() => {})
    accountApi.activity({ page_size: 8 }).then(r => setActivities(r.data.activities)).catch(() => {})
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false)
    try {
      const { data } = await apiClient.patch('/api/v1/accounts/me/', form)
      setUser(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) { setPwErr('Passwords do not match.'); return }
    setPwSaving(true); setPwErr(''); setPwOk(false)
    try {
      await apiClient.post('/api/v1/accounts/change-password/', {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      })
      setPwOk(true)
      setPwForm({ old_password: '', new_password: '', confirm: '' })
      setTimeout(() => setPwOk(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string; old_password?: string[] } } })?.response?.data
      setPwErr(msg?.old_password?.[0] ?? msg?.detail ?? 'Failed to change password.')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Profile header card ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden"
      >
        <div className="h-1.5" style={{ background: roleColor }} />
        <div className="p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Avatar with status dot */}
            <div className="relative shrink-0">
              <div
                className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-[28px] font-bold text-white shadow-lg"
                style={{ background: roleColor }}
              >
                {`${user?.first_name?.charAt(0) ?? ''}${user?.last_name?.charAt(0) ?? ''}`.toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 ring-[3px] ring-white dark:ring-[#1a2235]" />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white font-heading tracking-tight">
                  {user?.first_name} {user?.last_name}
                </h2>
                <span
                  className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ background: roleColor }}
                >
                  {roleLabel}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-white/40 mt-1">{user?.email}</p>
              {user?.org_name && (
                <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {user.org_name}
                </p>
              )}
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Member Since', value: user?.date_joined ? new Date(user.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { label: 'Last Login', value: user?.last_login ? timeAgo(user.last_login) : 'First session' },
              { label: 'Username', value: `@${user?.username ?? '—'}` },
              { label: 'Status', value: 'Active' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-white/35 uppercase tracking-wide font-semibold">{label}</p>
                  <p className="text-xs font-semibold text-gray-800 dark:text-white/80 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats card row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Shipments', value: stats.total_shipments, sub: `${stats.shipments_mtd} this month`, color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/15', Icon: Package },
            { label: 'Events Logged', value: stats.events_logged, sub: `${stats.events_mtd} this month`, color: '#f5801e', bg: 'bg-orange-50 dark:bg-orange-900/15', Icon: Activity },
            { label: 'Docs Uploaded', value: stats.docs_uploaded, sub: 'Total', color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15', Icon: FileText },
            { label: 'Top Carrier', value: stats.most_used_carrier ?? '—', sub: 'Most used', color: '#a78bfa', bg: 'bg-violet-50 dark:bg-violet-900/15', isText: true, Icon: Truck },
          ].map(({ label, value, sub, color, bg, isText, Icon }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden"
            >
              <div className="flex items-center gap-4 p-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <div className={isText ? 'text-base font-bold text-gray-800 dark:text-white/80 truncate' : 'text-xl font-bold text-gray-900 dark:text-white tabular-nums'}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-white/40">{label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Profile form */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-4">Personal Info</h2>
        <form onSubmit={saveProfile} className="space-y-4">
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
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Email</label>
            <input type="email" value={user?.email ?? ''} disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-500 dark:text-white/40 cursor-not-allowed" />
            <p className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5">Contact support to change your email address.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+254 712 345 678"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password change */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          {pwErr && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{pwErr}</p>}
          {pwOk  && <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Password changed successfully.</p>}
          {(['old_password', 'new_password', 'confirm'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">
                {field === 'old_password' ? 'Current Password' : field === 'new_password' ? 'New Password' : 'Confirm New Password'}
              </label>
              <input type="password" value={pwForm[field]}
                onChange={(e) => setPwForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          ))}
          <div className="flex justify-end">
            <button type="submit" disabled={pwSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-4">Data & Privacy</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={async () => {
            try {
              const { data } = await accountApi.requestExport()
              alert(`Export requested. Status: ${data.status}. You'll receive a download link when ready.`)
            } catch { alert('Failed to request data export.') }
          }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export My Data
          </button>
          <button onClick={async () => {
            if (!confirm('This permanently deletes your account and all data. This cannot be undone. Continue?')) return
            const pw = prompt('Enter your password to confirm:')
            if (!pw) return
            try {
              await accountApi.deleteAccount({ password: pw })
              alert('Account deletion requested. You will be logged out.')
              window.location.href = '/login'
            } catch { alert('Failed to delete account. Check your password.') }
          }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete Account
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/25 mt-3">
          Export your data in machine-readable format (GDPR compliant). Account deletion is permanent and irreversible.
        </p>
      </div>

      {/* Activity timeline */}
      {activities.length > 0 && (
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-4">Recent Activity</h2>
          <div className="space-y-0">
            {activities.map((a, i) => {
              const Icon = ACTION_ICONS[a.action_type] ?? Activity
              return (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-white/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-white/70">{a.description}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5">{timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', value ? 'bg-blue-500' : 'bg-gray-200 dark:bg-white/15')}>
      <span className={cn('inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform', value ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  )
}

const NOTIF_ROWS: { key: keyof NotifPrefs; label: string; sub: string; channel: 'email' | 'push' }[] = [
  { key: 'email_on_delay',    label: 'Delay alerts',      sub: 'Receive an email when a shipment is delayed',          channel: 'email' },
  { key: 'email_on_customs',  label: 'Customs holds',     sub: 'Receive an email when a shipment enters customs',      channel: 'email' },
  { key: 'email_on_delivery', label: 'Delivery confirmed', sub: 'Receive an email on successful delivery',              channel: 'email' },
  { key: 'push_on_delay',     label: 'Delay alerts',      sub: 'Mobile push notification for delays',                   channel: 'push' },
  { key: 'push_on_customs',   label: 'Customs holds',     sub: 'Mobile push notification for customs holds',            channel: 'push' },
  { key: 'push_on_delivery',  label: 'Delivery confirmed', sub: 'Mobile push notification on delivery',                 channel: 'push' },
]

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  email_on_delay: true, email_on_customs: true, email_on_delivery: true,
  push_on_delay:  true, push_on_customs:  false, push_on_delivery: true,
}

function NotificationsTab() {
  const [prefs,   setPrefs]   = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    accountApi.notifPrefs()
      .then(r => { if (r.data) setPrefs({ ...DEFAULT_NOTIF_PREFS, ...r.data }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      await accountApi.updateNotifPrefs(prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Email section */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/8 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <span className="text-xs font-bold text-gray-600 dark:text-white/60 uppercase tracking-wide">Email Notifications</span>
              </div>
            </div>
            {NOTIF_ROWS.filter(r => r.channel === 'email').map((row) => (
              <div key={row.key} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{row.label}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{row.sub}</p>
                </div>
                <Toggle value={prefs[row.key]} onChange={(v) => setPrefs((p) => ({ ...p, [row.key]: v }))} />
              </div>
            ))}

            {/* Push section */}
            <div className="px-5 py-3 border-b border-t border-gray-100 dark:border-white/8 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <Smartphone className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-xs font-bold text-gray-600 dark:text-white/60 uppercase tracking-wide">Push Notifications</span>
              </div>
            </div>
            {NOTIF_ROWS.filter(r => r.channel === 'push').map((row) => (
              <div key={row.key} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{row.label}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{row.sub}</p>
                </div>
                <Toggle value={prefs[row.key]} onChange={(v) => setPrefs((p) => ({ ...p, [row.key]: v }))} />
              </div>
            ))}
          </>
        )}
      </div>
      <div className="flex justify-end mt-4 gap-3 items-center">
        {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
        <button onClick={() => void save()} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-navy)' }}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

// ── API Keys Tab ──────────────────────────────────────────────────────────────

interface ApiKey {
  id:         number
  name:       string
  prefix:     string
  created_at: string
  last_used:  string | null
}

function ApiKeyRow({ apiKey, onDeleted }: { apiKey: ApiKey; onDeleted: () => void }) {
  const [copied,   setCopied]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function del() {
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/accounts/api-keys/${apiKey.id}/`)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Key className="w-4 h-4 text-gray-400 dark:text-white/30 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-white">{apiKey.name}</p>
        <p className="font-mono text-xs text-gray-400 dark:text-white/30">{apiKey.prefix}••••••••</p>
      </div>
      <div className="text-right text-xs text-gray-400 dark:text-white/30 hidden sm:block">
        <p>Created {new Date(apiKey.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        {apiKey.last_used && <p>Last used {new Date(apiKey.last_used).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
      </div>
      <button onClick={() => { void navigator.clipboard.writeText(apiKey.prefix); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => void del()} disabled={deleting}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function ApiKeysTab() {
  const [keys,     setKeys]     = useState<ApiKey[]>([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey,   setNewKey]   = useState<{ key: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await apiClient.get<{ results?: ApiKey[] } | ApiKey[]>('/api/v1/accounts/api-keys/')
      setKeys((res.data as { results?: ApiKey[] })?.results ?? (res.data as ApiKey[]) ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await apiClient.post<{ key: string; name: string }>('/api/v1/accounts/api-keys/', { name: newName.trim() })
      setNewKey(res.data)
      setNewName('')
      void load()
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="max-w-xl space-y-4">
      {newKey && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Key created — save it now!</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">This key will never be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs bg-white dark:bg-black/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700/40 text-emerald-800 dark:text-emerald-200 break-all flex-1">{newKey.key}</code>
            <button onClick={() => void navigator.clipboard.writeText(newKey.key)}
              className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Dismiss</button>
        </motion.div>
      )}

      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">API Keys</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Use API keys to authenticate programmatic access to CargoTrack.</p>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 dark:text-white/30">No API keys yet</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {keys.map((k) => <ApiKeyRow key={k.id} apiKey={k} onDeleted={load} />)}
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/8">
          <form onSubmit={create} className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Key name (e.g. Production)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="submit" disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

function BillingTab() {
  return (
    <div className="max-w-xl space-y-4">
      {/* Plan card with gradient accent */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-ct-navy via-blue-500 to-ct-navy" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Current Plan</h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Manage your subscription and billing</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500 to-ct-navy text-white shadow-md shadow-blue-500/20">
              <Zap className="w-3 h-3" /> Pro
            </span>
          </div>
          <div className="space-y-0">
            {[
              { label: 'Plan', value: 'CargoTrack Pro' },
              { label: 'Billing cycle', value: 'Monthly' },
              { label: 'Amount', value: '$99 / month' },
              { label: 'Next renewal', value: 'May 1, 2026' },
            ].map(({ label, value }, i) => (
              <div key={label} className={cn('flex justify-between items-center py-3', i < 3 && 'border-b border-gray-50 dark:border-white/5')}>
                <span className="text-sm text-gray-500 dark:text-white/40">{label}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ background: 'var(--ct-navy)' }}>
              Manage Subscription
            </button>
            <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              Download Invoices
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-700/30 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Need to upgrade?</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">Contact your account manager or email <span className="font-mono">billing@cargotrack.io</span> for enterprise pricing.</p>
        </div>
      </div>
    </div>
  )
}

// ── Payment Providers Tab ─────────────────────────────────────────────────────

interface ProviderConfig {
  key:         string
  label:       string
  emoji:       string
  envVars:     { label: string; envKey: string }[]
  docsUrl:     string
  description: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: 'MPESA', label: 'M-Pesa (Daraja)', emoji: '🇰🇪',
    description: 'Safaricom STK Push for Kenya & Tanzania',
    docsUrl: 'https://developer.safaricom.co.ke/',
    envVars: [
      { label: 'Consumer Key',    envKey: 'MPESA_CONSUMER_KEY' },
      { label: 'Consumer Secret', envKey: 'MPESA_CONSUMER_SECRET' },
      { label: 'Shortcode',       envKey: 'MPESA_SHORTCODE' },
      { label: 'Passkey',         envKey: 'MPESA_PASSKEY' },
    ],
  },
  {
    key: 'AIRTEL', label: 'Airtel Money', emoji: '🇺🇬',
    description: 'Airtel Money API for Uganda, Rwanda & Tanzania',
    docsUrl: 'https://developers.airtel.africa/',
    envVars: [
      { label: 'Client ID',     envKey: 'AIRTEL_CLIENT_ID' },
      { label: 'Client Secret', envKey: 'AIRTEL_CLIENT_SECRET' },
    ],
  },
  {
    key: 'MTN', label: 'MTN MoMo', emoji: '🇷🇼',
    description: 'MTN Mobile Money API for Uganda & Rwanda',
    docsUrl: 'https://momodeveloper.mtn.com/',
    envVars: [
      { label: 'Primary Key',    envKey: 'MTN_MOMO_PRIMARY_KEY' },
      { label: 'User ID',        envKey: 'MTN_MOMO_USER_ID' },
      { label: 'API Key',        envKey: 'MTN_MOMO_API_KEY' },
    ],
  },
  {
    key: 'FLUTTERWAVE', label: 'Flutterwave', emoji: '🌍',
    description: 'Pan-Africa card & mobile money via Flutterwave',
    docsUrl: 'https://developer.flutterwave.com/',
    envVars: [
      { label: 'Secret Key',    envKey: 'FLUTTERWAVE_SECRET_KEY' },
      { label: 'Webhook Hash',  envKey: 'FLUTTERWAVE_WEBHOOK_HASH' },
    ],
  },
  {
    key: 'STRIPE', label: 'Stripe', emoji: '💳',
    description: 'International card payments via Stripe',
    docsUrl: 'https://stripe.com/docs/',
    envVars: [
      { label: 'Secret Key',        envKey: 'STRIPE_SECRET_KEY' },
      { label: 'Webhook Secret',    envKey: 'STRIPE_WEBHOOK_SECRET' },
    ],
  },
  {
    key: 'PESAPAL', label: 'Pesapal', emoji: '🌐',
    description: 'Multi-channel payments across East Africa',
    docsUrl: 'https://developer.pesapal.com/',
    envVars: [
      { label: 'Consumer Key',    envKey: 'PESAPAL_CONSUMER_KEY' },
      { label: 'Consumer Secret', envKey: 'PESAPAL_CONSUMER_SECRET' },
    ],
  },
]

function ProvidersTab() {
  const [open, setOpen] = useState<string | null>(null)
  const [showEnv, setShowEnv] = useState<Record<string, boolean>>({})

  return (
    <div className="max-w-xl space-y-3">
      <p className="text-xs text-gray-500 dark:text-white/40">
        Configure payment providers via environment variables on your Django server. Set credentials in your <code className="font-mono">.env</code> file and restart the server.
      </p>
      {PROVIDERS.map((p) => (
        <div key={p.key} className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
          <button
            onClick={() => setOpen((o) => o === p.key ? null : p.key)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <span className="text-xl">{p.emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{p.label}</p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{p.description}</p>
            </div>
            <RefreshCw className={cn('w-4 h-4 text-gray-300 dark:text-white/20 transition-transform', open === p.key && 'rotate-90')} />
          </button>

          <AnimatePresence>
            {open === p.key && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden">
                <div className="px-5 pb-5 space-y-3 border-t border-gray-100 dark:border-white/8 pt-4">
                  {p.envVars.map((ev) => (
                    <div key={ev.envKey}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-white/50 mb-1">{ev.label}</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-white/60">
                          {showEnv[ev.envKey] ? `${ev.envKey}=<your-value>` : `${ev.envKey}=••••••••`}
                        </code>
                        <button
                          onClick={() => setShowEnv((s) => ({ ...s, [ev.envKey]: !s[ev.envKey] }))}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                          {showEnv[ev.envKey] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">
                    View {p.label} docs →
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

// ── Sessions Tab ───────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [revoking, setRevoking] = useState<number | null>(null)

  useEffect(() => {
    accountApi.sessions()
      .then(r => setSessions(r.data.sessions))
      .catch(() => setMsg('Could not load sessions from server.'))
      .finally(() => setLoading(false))
  }, [])

  async function revoke(id: number) {
    setRevoking(id)
    try {
      await accountApi.revokeSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      setMsg('Session revoked.')
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setMsg('Failed to revoke session.')
    } finally {
      setRevoking(null)
    }
  }

  const deviceIcon = (device: string) => {
    switch (device) {
      case 'mobile': return <Smartphone className="w-4 h-4" />
      case 'tablet': return <Smartphone className="w-4 h-4 rotate-90" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  const deviceLabel = (device: string) => {
    switch (device) {
      case 'mobile': return 'Mobile'
      case 'tablet': return 'Tablet'
      default: return 'Desktop'
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {msg && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 rounded-lg flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> {msg}
        </motion.div>
      )}

      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Active Sessions</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} — revoke any you don't recognise
          </p>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center">
            <Monitor className="w-8 h-8 text-gray-300 dark:text-white/15 mx-auto mb-2" />
            <p className="text-sm text-gray-400 dark:text-white/30">No active sessions found</p>
            <p className="text-xs text-gray-400 dark:text-white/20 mt-0.5">Sessions appear here when you log in from any device.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {sessions.map(s => (
              <div key={s.id} className={cn(
                'px-5 py-4 transition-colors',
                s.is_current && 'bg-blue-50/50 dark:bg-blue-900/10',
              )}>
                <div className="flex items-start gap-3">
                  {/* Device icon */}
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    s.is_current
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30',
                  )}>
                    {deviceIcon(s.device)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {s.browser || 'Unknown'} on {deviceLabel(s.device)}
                      </p>
                      {s.is_current && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                      {s.ip_address && <span className="font-mono text-[11px]">{s.ip_address} · </span>}
                      Started {s.created_at ? timeAgo(s.created_at) : '—'}
                      {s.expires_at && <span> · Expires {new Date(s.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                    </p>
                    {s.user_agent && (
                      <p className="text-[10px] text-gray-400 dark:text-white/20 mt-1 truncate max-w-md" title={s.user_agent}>
                        {s.user_agent}
                      </p>
                    )}
                  </div>

                  {!s.is_current && (
                    <button
                      onClick={() => revoke(s.id)}
                      disabled={revoking === s.id}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {revoking === s.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [entries, setEntries] = useState<SecurityLogEntry[]>([])
  const [lastLogin, setLastLogin] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr_code_url: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [totpMsg, setTotpMsg] = useState('')

  useEffect(() => {
    accountApi.securityLog()
      .then(r => { setEntries(r.data.entries); setLastLogin(r.data.last_login) })
      .catch(() => {})
      .finally(() => setLoading(false))
    accountApi.totpStatus()
      .then(r => setTotpEnabled(r.data.is_enabled))
      .catch(() => {})
  }, [])

  async function startTotpSetup() {
    setTotpLoading(true); setTotpMsg('')
    try {
      const { data } = await accountApi.totpSetup()
      setTotpSetup(data)
    } catch { setTotpMsg('Failed to setup TOTP.') }
    finally { setTotpLoading(false) }
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault()
    setTotpLoading(true); setTotpMsg('')
    try {
      await accountApi.totpVerify({ code: totpCode })
      setTotpEnabled(true); setTotpSetup(null); setTotpCode('')
      setTotpMsg('Two-factor authentication enabled.')
    } catch { setTotpMsg('Invalid verification code.') }
    finally { setTotpLoading(false) }
  }

  async function disableTotp() {
    const pw = prompt('Enter your password to disable 2FA:')
    if (!pw) return
    setTotpLoading(true); setTotpMsg('')
    try {
      await accountApi.totpDisable({ password: pw })
      setTotpEnabled(false)
      setTotpMsg('Two-factor authentication disabled.')
    } catch { setTotpMsg('Failed to disable TOTP. Check your password.') }
    finally { setTotpLoading(false) }
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Summary card */}
      {lastLogin && (
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Last login</p>
            <p className="text-xs text-gray-500 dark:text-white/40">
              {new Date(lastLogin).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}

      {/* Two-Factor Authentication */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Two-Factor Authentication</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
            {totpEnabled ? 'TOTP is enabled on your account.' : 'Add an extra layer of security with authenticator app.'}
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {totpMsg && (
            <p className={cn('text-xs px-3 py-2 rounded-lg', totpMsg.includes('enabled') || totpMsg.includes('disabled') ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-red-600 bg-red-50 dark:bg-red-900/20')}>{totpMsg}</p>
          )}
          {totpEnabled ? (
            <button onClick={disableTotp} disabled={totpLoading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
              {totpLoading ? 'Disabling…' : 'Disable 2FA'}
            </button>
          ) : totpSetup ? (
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                {totpSetup.qr_code_url && (
                  <img src={totpSetup.qr_code_url} alt="TOTP QR Code" className="w-32 h-32 rounded-xl border border-gray-200 dark:border-white/10 bg-white p-1" />
                )}
                <div className="text-xs space-y-1">
                  <p className="text-gray-600 dark:text-white/60">Scan with your authenticator app</p>
                  <p className="font-mono text-gray-800 dark:text-white select-all">{totpSetup.secret}</p>
                </div>
              </div>
              <form onSubmit={verifyTotp} className="flex gap-2">
                <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6-digit verification code" maxLength={6}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="submit" disabled={totpLoading || totpCode.length !== 6}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'var(--ct-navy)' }}>
                  {totpLoading ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            </div>
          ) : (
            <button onClick={startTotpSetup} disabled={totpLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--ct-navy)' }}>
              <QrCode className="w-3.5 h-3.5" /> {totpLoading ? 'Loading…' : 'Setup 2FA'}
            </button>
          )}
        </div>
      </div>

      {/* Security events */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Security Events</h2>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 dark:text-white/30">No security events</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {entries.map((e, i) => {
              const Icon = ACTION_ICONS[e.action.toLowerCase()] ?? Shield
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-white/30" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-white/80">{e.description}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/25">{timeAgo(e.timestamp)}{e.ip_address ? ` · IP ${e.ip_address}` : ''}</p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', e.result === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20')}>
                    {e.result}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Preferences Tab ───────────────────────────────────────────────────────────

interface UserPreferences {
  date_format: string
  distance_unit: string
  timezone: string
  language: string
  auto_refresh: string
  map_zoom: string
}

const DEFAULT_PREFS: UserPreferences = {
  date_format: 'DD/MM/YYYY',
  distance_unit: 'km',
  timezone: 'Africa/Nairobi',
  language: 'en',
  auto_refresh: '60',
  map_zoom: '6',
}

function PreferencesTab() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    accountApi.userPreferences()
      .then(r => { if (r.data && Object.keys(r.data).length > 0) setPrefs({ ...DEFAULT_PREFS, ...r.data }) })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true); setSaved(false); setError('')
    try {
      await accountApi.updateUserPreferences(prefs as unknown as Record<string, string>)
      if (prefs.language) {
        document.documentElement.lang = prefs.language
        localStorage.setItem('ct-lang', prefs.language)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</div>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-4">Display & Locale</h2>
        <div className="space-y-4">
          {[
            { label: 'Date Format', field: 'date_format', type: 'select', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
            { label: 'Distance Unit', field: 'distance_unit', type: 'select', options: ['km', 'mi'] },
            { label: 'Timezone', field: 'timezone', type: 'select', options: ['Africa/Nairobi', 'Africa/Kampala', 'Africa/Kigali', 'Africa/Dar_es_Salaam', 'Africa/Juba'] },
            { label: 'Language', field: 'language', type: 'select', options: ['en', 'sw', 'fr'] },
          ].map(({ label, field, options }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">{label}</label>
              <select value={prefs[field as keyof UserPreferences]}
                onChange={e => setPrefs(p => ({ ...p, [field]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-4">Dashboard Defaults</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Auto-refresh Interval (seconds)</label>
            <select value={prefs.auto_refresh}
              onChange={e => setPrefs(p => ({ ...p, auto_refresh: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              {['30', '60', '120', '300', 'off'].map(o => <option key={o} value={o}>{o === 'off' ? 'Disabled' : `${o}s`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Default Map Zoom</label>
            <select value={prefs.map_zoom}
              onChange={e => setPrefs(p => ({ ...p, map_zoom: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              {['4', '5', '6', '7', '8', '9', '10'].map(o => <option key={o} value={o}>Level {o}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 items-center">
        {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Preferences saved</span>}
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-navy)' }}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
        </>
      )}
    </div>
  )
}

// ── Main Settings ─────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile')
  const { user } = useAuthStore()
  const roleColor = ROLE_COLOR[user?.role ?? ''] ?? '#0f2d5e'

  return (
    <div className="space-y-5 pb-10">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading tracking-tight">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">Manage your account, security, and preferences</p>
        </div>
        {tab === 'profile' && user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Account active
          </div>
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all duration-200',
              tab === t.key
                ? 'bg-ct-navy text-white shadow-lg shadow-ct-navy/25 scale-[1.02]'
                : 'bg-white dark:bg-white/5 text-gray-500 dark:text-white/45 border border-gray-200/60 dark:border-white/8 hover:text-gray-700 dark:hover:text-white/70 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/8',
            )}>
            <span className={cn('transition-transform duration-200', tab === t.key && 'scale-110')}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {tab === 'profile'       && <ProfileTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'api-keys'      && <ApiKeysTab />}
          {tab === 'billing'       && <BillingTab />}
          {tab === 'providers'     && <ProvidersTab />}
          {tab === 'sessions'      && <SessionsTab />}
          {tab === 'security'      && <SecurityTab />}
          {tab === 'preferences'   && <PreferencesTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
