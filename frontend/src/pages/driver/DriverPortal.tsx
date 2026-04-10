/**
 * @file DriverPortal.tsx
 * @description Carrier (driver) portal — shows active shipments assigned to
 * this carrier and provides a quick link to log tracking events.
 *
 * Data sources:
 *   GET /api/v1/shipments/      — full shipment list (filtered client-side for active)
 *   GET /api/v1/alerts/         — alerts for awareness
 *
 * @route /driver/dashboard
 * @auth CARRIER only
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Truck, MapPin, Clock, AlertTriangle, RefreshCw,
  ArrowUpRight, CheckCircle, Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type { ShipmentListItem, ShipmentStatus, Alert } from '@/types'
import { useAuthStore } from '@/store/authStore'

const STATUS_CFG: Record<ShipmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  IN_TRANSIT: { label: 'In Transit',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  CUSTOMS:    { label: 'At Customs',  bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400'  },
  DELAYED:    { label: 'Delayed',     bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400'     },
  DELIVERED:  { label: 'Delivered',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  PENDING:    { label: 'Pending',     bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400'    },
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', c.bg, c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

export default function DriverPortal() {
  const user = useAuthStore((s) => s.user)
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [shipmentsRes, alertsRes] = await Promise.all([
        shipmentsApi.getShipments({ page_size: 50 }),
        alertsApi.getAlerts(),
      ])
      setShipments(shipmentsRes.data.results)
      setAlerts(alertsRes.data.results.slice(0, 4))
    } catch {
      setError('Unable to load data. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeShipments  = shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'PENDING')
  const delayedShipments = shipments.filter((s) => s.status === 'DELAYED')

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Driver Portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Welcome back, {user?.first_name}. Here are your active assignments.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
          ))
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500"><Truck className="w-5 h-5 text-white" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeShipments.length}</p>
                <p className="text-sm text-gray-500">Active Assignments</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500"><AlertTriangle className="w-5 h-5 text-white" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{delayedShipments.length}</p>
                <p className="text-sm text-gray-500">Delayed</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500"><CheckCircle className="w-5 h-5 text-white" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {shipments.filter((s) => s.status === 'DELIVERED').length}
                </p>
                <p className="text-sm text-gray-500">Delivered</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Shipments list */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">My Shipments</h2>
            <Link to="/driver/shipments" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-gray-100" />
                    <div className="h-3 w-48 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : shipments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No shipments assigned yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {shipments.slice(0, 8).map((s) => (
                <div key={s.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={`/driver/shipments/${s.id}`}
                        className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 group-hover:underline"
                      >
                        {s.tracking_number}
                      </Link>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 text-gray-300 shrink-0" />
                      <span className="font-medium">{s.route.origin}</span>
                      <span className="text-gray-300">→</span>
                      <span>{s.route.destination}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(s.scheduled_arrival).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                    <Link
                      to={`/driver/shipments/${s.id}/log-event`}
                      className="mt-1 inline-flex text-xs font-medium text-blue-600 hover:text-blue-800 gap-0.5 items-center"
                    >
                      Log event <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerts panel */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Alerts</h2>
            <Link to="/shared/alerts" className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5">
              All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="divide-y divide-gray-50 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-3.5 flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-100 mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-gray-100" />
                    <div className="h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-gray-400">No active alerts</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex gap-3">
                  <div className={cn('mt-0.5 w-2 h-2 rounded-full shrink-0', {
                    'bg-red-500': a.severity === 'CRITICAL',
                    'bg-red-400': a.severity === 'HIGH',
                    'bg-amber-400': a.severity === 'MEDIUM',
                    'bg-blue-400': a.severity === 'LOW',
                  })} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 leading-snug">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono">{a.shipment_tracking}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
