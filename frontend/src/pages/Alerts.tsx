import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { Alert, AlertSeverity } from '@/types'

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  info:     'bg-blue-50 border-blue-200 text-blue-800',
  warning:  'bg-amber-50 border-amber-200 text-amber-800',
  critical: 'bg-red-50 border-red-200 text-red-800',
}

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  info:     'bg-blue-400',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi
      .getAlerts()
      .then((res) => setAlerts(res.data))
      .finally(() => setLoading(false))
  }, [])

  async function markRead(id: number) {
    await dashboardApi.markAlertRead(id)
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)))
  }

  async function markAllRead() {
    const unread = alerts.filter((a) => !a.is_read)
    await Promise.all(unread.map((a) => dashboardApi.markAlertRead(a.id)))
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })))
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-gray-400" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Alerts</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No alerts
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-opacity ${SEVERITY_STYLES[alert.severity]} ${alert.is_read ? 'opacity-60' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs opacity-60 font-mono">{alert.tracking_number}</span>
                  <span className="text-xs opacity-60">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              {!alert.is_read && (
                <button
                  onClick={() => markRead(alert.id)}
                  className="text-xs font-medium underline opacity-70 hover:opacity-100 shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
