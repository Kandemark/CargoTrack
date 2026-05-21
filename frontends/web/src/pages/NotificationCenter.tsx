import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, AlertTriangle, Package, DollarSign, Settings, Shield, X, CheckCheck, Loader2, Layers } from 'lucide-react'
import { notificationsApi, type Notification } from '@/api/notifications'

const TYPE_ICONS: Record<string, React.ElementType> = {
  ALERT: AlertTriangle, SHIPMENT: Package, PAYMENT: DollarSign,
  SYSTEM: Settings, SECURITY: Shield,
}

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  LOW:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INFO:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

function NotificationItem({ n, markRead, dismiss }: {
  n: Notification; markRead: (id: number) => void; dismiss: (id: number) => void
}) {
  const Icon = TYPE_ICONS[n.type] ?? Bell
  return (
    <motion.div
      key={n.id}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className={`bg-white dark:bg-gray-800 rounded-xl border p-4 transition-colors group ${
        n.is_read
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${SEVERITY_COLORS[n.severity]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm text-gray-900 dark:text-white">{n.title}</span>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[n.severity]}`}>{n.severity}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{n.message}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!n.is_read && (
            <button
              onClick={() => markRead(n.id)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600"
              title="Mark as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => dismiss(n.id)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ALL' | 'UNREAD' | 'ALERT' | 'SYSTEM'>('ALL')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const load = () => {
    const params: Record<string, string> = {}
    if (tab === 'UNREAD') params.unread = '1'
    if (typeFilter) params.type = typeFilter
    setLoading(true)
    notificationsApi.list(params)
      .then(r => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab, typeFilter])

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

  const [groupByType, setGroupByType] = useState(false)

  const filtered = items.filter(n => {
    if (tab === 'UNREAD') return !n.is_read
    if (tab === 'ALERT') return n.type === 'ALERT'
    if (tab === 'SYSTEM') return n.type === 'SYSTEM'
    return true
  })

  const grouped = useMemo(() => {
    if (!groupByType) return null
    const groups: Record<string, Notification[]> = {}
    for (const n of filtered) {
      const key = n.type
      if (!groups[key]) groups[key] = []
      groups[key].push(n)
    }
    return groups
  }, [filtered, groupByType])

  const TYPE_LABELS: Record<string, string> = { ALERT: 'Alerts', SHIPMENT: 'Shipments', PAYMENT: 'Payments', SYSTEM: 'System', SECURITY: 'Security' }

  const unreadCount = items.filter(n => !n.is_read).length

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Center</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGroupByType(!groupByType)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              groupByType
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Group by type
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          <Link
            to="/settings?tab=preferences"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {(['ALL', 'UNREAD', 'ALERT', 'SYSTEM'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}{t === 'UNREAD' && unreadCount > 0 && <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5">{unreadCount}</span>}
          </button>
        ))}
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[null, 'ALERT', 'SHIPMENT', 'PAYMENT', 'SYSTEM', 'SECURITY'].map(t => (
          <button
            key={t ?? 'ALL'}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }`}
          >
            {t ?? 'All Types'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No notifications</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Notifications will appear here when activity occurs</p>
        </div>
      ) : grouped ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                {TYPE_LABELS[type] ?? type} ({items.length})
              </h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {items.map(n => <NotificationItem key={n.id} n={n} markRead={markRead} dismiss={dismiss} />)}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map(n => <NotificationItem key={n.id} n={n} markRead={markRead} dismiss={dismiss} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
