/**
 * Settings.tsx — Profile, Notifications, API Keys, Billing, Payment Providers tabs.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Bell, Key, CreditCard, Zap, Eye, EyeOff, Copy, Check, Plus, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'

type Tab = 'profile' | 'notifications' | 'api-keys' | 'billing' | 'providers'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'profile',       label: 'Profile',        icon: <User className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications',  icon: <Bell className="w-4 h-4" /> },
  { key: 'api-keys',      label: 'API Keys',       icon: <Key className="w-4 h-4" /> },
  { key: 'billing',       label: 'Billing',        icon: <CreditCard className="w-4 h-4" /> },
  { key: 'providers',     label: 'Pay Providers',  icon: <Zap className="w-4 h-4" /> },
]

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name:  user?.last_name  ?? '',
    email:      user?.email      ?? '',
    company:    user?.company    ?? '',
    phone:      user?.phone      ?? '',
  })
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [pwForm,   setPwForm]   = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwErr,    setPwErr]    = useState('')
  const [pwOk,     setPwOk]     = useState(false)

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
    <div className="space-y-6 max-w-xl">
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
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Company</label>
              <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
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
    </div>
  )
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

interface NotifPrefs {
  email_on_delay: boolean
  email_on_customs: boolean
  email_on_delivery: boolean
  push_on_delay: boolean
  push_on_customs: boolean
  push_on_delivery: boolean
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', value ? 'bg-blue-500' : 'bg-gray-200 dark:bg-white/15')}>
      <span className={cn('inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform', value ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  )
}

const NOTIF_ROWS: { key: keyof NotifPrefs; label: string; sub: string }[] = [
  { key: 'email_on_delay',    label: 'Email — Delay alerts',      sub: 'Receive an email when a shipment is delayed' },
  { key: 'email_on_customs',  label: 'Email — Customs holds',     sub: 'Receive an email when a shipment enters customs' },
  { key: 'email_on_delivery', label: 'Email — Delivery confirmed', sub: 'Receive an email on successful delivery' },
  { key: 'push_on_delay',     label: 'Push — Delay alerts',       sub: 'Mobile push notification for delays' },
  { key: 'push_on_customs',   label: 'Push — Customs holds',      sub: 'Mobile push notification for customs holds' },
  { key: 'push_on_delivery',  label: 'Push — Delivery confirmed', sub: 'Mobile push notification on delivery' },
]

function NotificationsTab() {
  const [prefs,   setPrefs]   = useState<NotifPrefs>({
    email_on_delay: true, email_on_customs: true, email_on_delivery: true,
    push_on_delay:  true, push_on_customs:  false, push_on_delivery: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function save() {
    setSaving(true)
    try {
      await apiClient.patch('/api/v1/accounts/notification-prefs/', prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card divide-y divide-gray-50 dark:divide-white/5">
        {NOTIF_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">{row.label}</p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{row.sub}</p>
            </div>
            <Toggle value={prefs[row.key]} onChange={(v) => setPrefs((p) => ({ ...p, [row.key]: v }))} />
          </div>
        ))}
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
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Current Plan</h2>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Manage your subscription and billing</p>
          </div>
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">Pro</span>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50 dark:border-white/5">
            <span className="text-gray-500 dark:text-white/40">Plan</span>
            <span className="font-medium text-gray-800 dark:text-white">CargoTrack Pro</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50 dark:border-white/5">
            <span className="text-gray-500 dark:text-white/40">Billing cycle</span>
            <span className="font-medium text-gray-800 dark:text-white">Monthly</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50 dark:border-white/5">
            <span className="text-gray-500 dark:text-white/40">Amount</span>
            <span className="font-medium text-gray-800 dark:text-white">$99 / month</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500 dark:text-white/40">Next renewal</span>
            <span className="font-medium text-gray-800 dark:text-white">May 1, 2026</span>
          </div>
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

      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-700/30 p-4">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Need to upgrade?</p>
        <p className="text-xs text-amber-700 dark:text-amber-400">Contact your account manager or email <span className="font-mono">billing@cargotrack.io</span> for enterprise pricing.</p>
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

// ── Main Settings ─────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              tab === t.key
                ? 'bg-ct-navy text-white'
                : 'bg-white dark:bg-white/5 text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10',
            )}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'profile'       && <ProfileTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'api-keys'      && <ApiKeysTab />}
          {tab === 'billing'       && <BillingTab />}
          {tab === 'providers'     && <ProvidersTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
