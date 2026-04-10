/**
 * @file Alerts.tsx
 * @description Alerts management page — lists unacknowledged delay alerts and
 * allows managers to acknowledge them.
 *
 * Data flow:
 *   - Reads `alerts`, `isLoading`, `error` from `useAlertStore`.
 *   - Calls `fetchAlerts()` on mount; re-fetches after each acknowledge action.
 *   - Acknowledge button calls `acknowledgeAlert(id)` (requires LOGISTICS_MGR+).
 *
 * @route /alerts
 * @auth IsAuthenticated (read); IsManagerUser (acknowledge)
 */
import { useEffect } from 'react'
import { Bell, CheckCheck, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAlertStore } from '@/store/alertStore'
import type { AlertSeverity } from '@/types'

const SEVERITY_STYLE: Record<AlertSeverity, { card: string; dot: string; badge: string }> = {
  CRITICAL: { card: 'border-red-200 bg-red-50',     dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700'     },
  HIGH:     { card: 'border-red-100 bg-red-50/50',  dot: 'bg-red-400',    badge: 'bg-red-50 text-red-600'      },
  MEDIUM:   { card: 'border-amber-200 bg-amber-50', dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  LOW:      { card: 'border-blue-100 bg-blue-50',   dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700'   },
}

export default function Alerts() {
  const { alerts, unreadCount, isLoading, error, fetchAlerts, acknowledgeAlert } = useAlertStore()

  useEffect(() => { fetchAlerts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAcknowledgeAll() {
    const unread = alerts.filter((a) => !a.acknowledged)
    await Promise.all(unread.map((a) => acknowledgeAlert(a.id)))
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-gray-400" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Alerts</h1>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unacknowledged` : 'All alerts acknowledged'}
              </p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleAcknowledgeAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Acknowledge all
          </button>
        )}
      </div>

      {/* States */}
      {error ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchAlerts}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--ct-navy)' }}
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-gray-100 bg-white flex gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-100 mt-1.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 rounded bg-gray-100 w-3/4" />
                <div className="h-3 rounded bg-gray-100 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Bell className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No alerts</p>
          <p className="text-xs text-gray-400">All clear — no active alerts at this time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.LOW
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border transition-opacity',
                  style.card,
                  alert.acknowledged && 'opacity-50',
                )}
              >
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', style.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{alert.message}</p>
                    <span className={cn('shrink-0 inline-flex px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide', style.badge)}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-mono text-xs text-gray-500">{alert.shipment_tracking}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.sent_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {alert.acknowledged && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" /> Acknowledged
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="shrink-0 text-xs font-semibold text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
