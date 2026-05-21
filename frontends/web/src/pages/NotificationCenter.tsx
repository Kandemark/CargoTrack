/**
 * NotificationCenter.tsx — Smart notification hub with channel routing.
 *
 * Features:
 *   - Priority-ordered feed (HIGH → MEDIUM → LOW → INFO)
 *   - Channel preference management (in-app, email, SMS, push)
 *   - Smart bundling by shipment/alert correlation
 *   - Actionable notifications with context-aware CTA buttons
 *   - Digest scheduling (instant / hourly / daily)
 *   - Quiet hours configuration
 */
import { useEffect, useState, useMemo, useCallback, type ComponentType, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertTriangle, Package, DollarSign, Settings, Shield,
  X, CheckCheck, Loader2, Layers, Smartphone, Mail, MessageSquare,
  Clock, ChevronRight, Eye, EyeOff,
} from 'lucide-react'
import { notificationsApi, type Notification, type NotificationPreferences } from '@/api/notifications'

const TYPE_ICONS: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  ALERT: AlertTriangle, SHIPMENT: Package, PAYMENT: DollarSign,
  SYSTEM: Settings, SECURITY: Shield,
}

const TYPE_LABELS: Record<string, string> = {
  ALERT: 'Alerts', SHIPMENT: 'Shipments', PAYMENT: 'Payments',
  SYSTEM: 'System', SECURITY: 'Security',
}

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  LOW:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  INFO:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
}

const SEVERITY_SORT: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 }

const CHANNEL_ICONS: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  in_app: Bell, email: Mail, sms: MessageSquare, push: Smartphone,
}

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-App', email: 'Email', sms: 'SMS', push: 'Push',
}

// ── Preferences Modal ─────────────────────────────────────────────────────────
function PreferencesModal({
  prefs, onSave, onClose,
}: {
  prefs: NotificationPreferences | null; onSave: (p: Partial<NotificationPreferences>) => void; onClose: () => void
}) {
  const [local, setLocal] = useState(prefs)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(prefs) }, [prefs])

  if (!local) return null

  async function handleSave() {
    setSaving(true)
    try { await onSave(local!) } catch { /* modal stays open */ }
    setSaving(false)
    onClose()
  }

  function toggleChannel(cat: string | null, channel: string) {
    setLocal(prev => {
      if (!prev) return prev
      if (cat) {
        return {
          ...prev,
          per_type: {
            ...prev.per_type,
            [cat]: { ...prev.per_type[cat], [channel]: !(prev.per_type[cat] as any)?.[channel] },
          },
        }
      }
      return { ...prev, channels: { ...prev.channels, [channel]: !(prev.channels as any)[channel] } }
    })
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8 sticky top-0 bg-white dark:bg-[#1a2235] z-10">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-5">
          {/* Global channel toggles */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Delivery Channels</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['in_app', 'email', 'sms', 'push'] as const).map(ch => {
                const Icon = CHANNEL_ICONS[ch]
                const active = local.channels[ch]
                return (
                  <button key={ch} onClick={() => toggleChannel(null, ch)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                      active ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-semibold ${active ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{CHANNEL_LABELS[ch]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Per-type channel overrides */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Per Category</h3>
            {Object.keys(TYPE_LABELS).map(cat => (
              <div key={cat} className="mb-2">
                <p className="text-xs font-medium text-gray-700 dark:text-white/70 mb-1">{TYPE_LABELS[cat]}</p>
                <div className="flex gap-1">
                  {(['in_app', 'email', 'sms', 'push'] as const).map(ch => {
                    const active = local.per_type[cat]?.[ch] ?? true
                    return (
                      <button key={ch} onClick={() => toggleChannel(cat, ch)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                          active ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-white/30'}`}>
                        {CHANNEL_LABELS[ch]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Digest */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Digest Settings</h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-700 dark:text-white/70">Enable digest</span>
              <button onClick={() => setLocal(p => p ? { ...p, digest_enabled: !p.digest_enabled } : p)}
                className={`w-9 h-5 rounded-full transition-colors ${local.digest_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform m-0.5 ${local.digest_enabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            {local.digest_enabled && (
              <div className="flex gap-1 mt-2">
                {(['instant', 'hourly', 'daily'] as const).map(f => (
                  <button key={f} onClick={() => setLocal(p => p ? { ...p, digest_frequency: f } : p)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                      local.digest_frequency === f ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quiet hours */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quiet Hours</h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-700 dark:text-white/70">Enable quiet hours</span>
              <button onClick={() => setLocal(p => p ? { ...p, quiet_hours_enabled: !p.quiet_hours_enabled } : p)}
                className={`w-9 h-5 rounded-full transition-colors ${local.quiet_hours_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform m-0.5 ${local.quiet_hours_enabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            {local.quiet_hours_enabled && (
              <div className="flex items-center gap-2 mt-2">
                <input type="time" value={local.quiet_hours_start} onChange={e => setLocal(p => p ? { ...p, quiet_hours_start: e.target.value } : p)}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-900 dark:text-white" />
                <span className="text-xs text-gray-400">to</span>
                <input type="time" value={local.quiet_hours_end} onChange={e => setLocal(p => p ? { ...p, quiet_hours_end: e.target.value } : p)}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-900 dark:text-white" />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/8">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Actionable Notification Item ──────────────────────────────────────────────
function NotificationItem({ n, markRead, dismiss }: {
  n: Notification; markRead: (id: number) => void; dismiss: (id: number) => void
}) {
  const Icon = TYPE_ICONS[n.type] ?? Bell
  const severityColor = SEVERITY_COLORS[n.severity]

  // Context-aware action button
  const action = useMemo(() => {
    if (n.related_url?.startsWith('/shipments/')) return { label: 'View Shipment', to: n.related_url }
    if (n.related_url?.startsWith('/payments/')) return { label: 'View Invoice', to: n.related_url }
    if (n.type === 'ALERT') return { label: 'View Alert', to: n.related_url || '/alerts' }
    if (n.type === 'SYSTEM') return { label: 'Settings', to: '/settings' }
    return null
  }, [n.related_url, n.type])

  return (
    <motion.div
      key={n.id}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className={`bg-white dark:bg-gray-800 rounded-xl border p-4 transition-all group ${
        n.is_read
          ? 'border-gray-200 dark:border-gray-700'
          : `border-l-4 ${severityColor} shadow-sm`
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${severityColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{n.title}</span>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${severityColor}`}>{n.severity}</span>
            <span className="text-[10px] text-gray-400 dark:text-white/30 ml-auto">
              {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{n.message}</p>
          {action && (
            <Link to={action.to}
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              {action.label} <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!n.is_read && (
            <button onClick={() => markRead(n.id)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600"
              title="Mark as read">
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => dismiss(n.id)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
            title="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ALL' | 'UNREAD' | 'HIGH' | 'ALERT'>('ALL')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    notificationsApi.list()
      .then(r => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    notificationsApi.getPreferences()
      .then(r => setPrefs(r.data))
      .catch(() => {})
      .finally(() => setPrefsLoaded(true))
  }, [load])

  const markRead = async (id: number) => {
    await notificationsApi.markRead(id)
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const dismiss = async (id: number) => {
    await notificationsApi.dismiss(id)
    setItems(prev => prev.filter(n => n.id !== id))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleSavePrefs = async (data: Partial<NotificationPreferences>) => {
    const r = await notificationsApi.updatePreferences(data)
    setPrefs(r.data)
  }

  // Priority-sorted filtered list
  const filtered = useMemo(() => {
    let list = [...items]
    if (tab === 'UNREAD') list = list.filter(n => !n.is_read)
    else if (tab === 'HIGH') list = list.filter(n => n.severity === 'HIGH')
    else if (tab === 'ALERT') list = list.filter(n => n.type === 'ALERT')
    if (typeFilter) list = list.filter(n => n.type === typeFilter)
    list.sort((a, b) => (SEVERITY_SORT[a.severity] ?? 9) - (SEVERITY_SORT[b.severity] ?? 9))
    return list
  }, [items, tab, typeFilter])

  // Smart bundles: group correlated notifications
  const bundles = useMemo(() => {
    const bundles: { key: string; items: Notification[]; title: string }[] = []
    const used = new Set<number>()

    for (const n of filtered) {
      if (used.has(n.id)) continue
      // Group alerts by shipment ref in message
      if (n.type === 'ALERT') {
        const related = filtered.filter(o => o.type === 'ALERT' && o.id !== n.id && !used.has(o.id) &&
          n.message.includes('shipment') && o.message.includes('shipment'))
        if (related.length > 0) {
          bundles.push({ key: `bundle-${n.id}`, items: [n, ...related], title: `${related.length + 1} Related Alerts` })
          used.add(n.id); related.forEach(r => used.add(r.id))
          continue
        }
      }
      bundles.push({ key: String(n.id), items: [n], title: '' })
      used.add(n.id)
    }
    return bundles
  }, [filtered])

  const unreadCount = items.filter(n => !n.is_read).length
  const highCount = items.filter(n => n.severity === 'HIGH' && !n.is_read).length

  const TABS = [
    { key: 'ALL' as const, label: 'All', count: items.length },
    { key: 'UNREAD' as const, label: 'Unread', count: unreadCount },
    { key: 'HIGH' as const, label: 'Critical', count: highCount },
    { key: 'ALERT' as const, label: 'Alerts', count: items.filter(n => n.type === 'ALERT').length },
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Center</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread · ${highCount} critical` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Channel status indicators */}
          {prefsLoaded && prefs && (
            <div className="flex items-center gap-1.5 mr-2 text-[10px] text-gray-400 dark:text-white/30">
              {(['in_app', 'email', 'sms', 'push'] as const).map(ch => {
                const Icon = CHANNEL_ICONS[ch]
                const active = prefs.channels[ch]
                return (
                  <span key={ch} className={`flex items-center gap-0.5 ${active ? '' : 'opacity-30'}`} title={`${CHANNEL_LABELS[ch]}: ${active ? 'On' : 'Off'}`}>
                    <Icon className="w-3 h-3" />
                  </span>
                )
              })}
            </div>
          )}
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          <button onClick={() => setShowPrefs(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Notification preferences">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.label}
            {t.count > 0 && <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-gray-100 dark:bg-white/10' : 'bg-white/50 dark:bg-gray-600'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[null, 'ALERT', 'SHIPMENT', 'PAYMENT', 'SYSTEM', 'SECURITY'].map(t => (
          <button key={t ?? 'ALL'} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }`}>
            {t ?? 'All Types'}
          </button>
        ))}
      </div>

      {/* Smart digest indicator */}
      {prefs?.digest_enabled && prefs.digest_frequency !== 'instant' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Digest mode: {prefs.digest_frequency === 'hourly' ? 'Notifications bundled every hour' : 'Daily summary at 9 AM'}</span>
          <button onClick={() => setShowPrefs(true)} className="ml-auto underline font-medium">Change</button>
        </div>
      )}

      {/* Quiet hours indicator */}
      {prefs?.quiet_hours_enabled && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-400">
          <EyeOff className="w-3.5 h-3.5" />
          <span>Quiet hours: {prefs.quiet_hours_start} – {prefs.quiet_hours_end}</span>
        </div>
      )}

      {/* Notification list */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {tab === 'UNREAD' ? "You're all caught up!" : 'Notifications will appear here when activity occurs'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {bundles.map(bundle => (
              <div key={bundle.key}>
                {bundle.items.length > 1 && (
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-white/30 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> {bundle.title}
                  </p>
                )}
                <div className="space-y-2">
                  {bundle.items.map(n => (
                    <NotificationItem key={n.id} n={n} markRead={markRead} dismiss={dismiss} />
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showPrefs && (
          <PreferencesModal prefs={prefs} onSave={handleSavePrefs} onClose={() => setShowPrefs(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
