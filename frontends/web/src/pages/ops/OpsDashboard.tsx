/**
 * @file OpsDashboard.tsx
 * @description Operations dashboard for ADMIN and LOGISTICS_MGR users.
 * Shows KPIs, shipment table, carrier performance, and active alerts.
 * All internal links use /ops/* and /shared/* URL prefixes.
 *
 * @route /ops/dashboard
 * @auth ADMIN, LOGISTICS_MGR
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, Truck, AlertTriangle, CheckCircle,
  Search, ChevronLeft, ChevronRight, ArrowUpRight,
  Clock, RefreshCw, Minus, TrendingUp, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type { DashboardSummary, CarrierPerformance, ShipmentListItem, ShipmentStatus, Alert } from '@/types'

// ── Status badge ──────────────────────────────────────────────────────────────

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

function RiskBar({ risk }: { risk: number }) {
  const pct = Math.round(risk * 100)
  const color = pct >= 70 ? 'text-red-600' : pct >= 40 ? 'text-amber-600' : 'text-emerald-600'
  const bar   = pct >= 70 ? 'bg-red-400'   : pct >= 40 ? 'bg-amber-400'   : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', color)}>{pct}%</span>
    </div>
  )
}

function StatCard({
  label, value, sub, trend, icon: Icon, iconBg,
}: {
  label: string; value: string | number; sub: string
  trend: { dir: 'up' | 'down' | 'flat'; label: string }
  icon: React.ElementType; iconBg: string
}) {
  const TrendIcon = trend.dir === 'up' ? TrendingUp : trend.dir === 'down' ? TrendingDown : Minus
  const trendColor = trend.dir === 'up'
    ? 'text-emerald-600 bg-emerald-50'
    : trend.dir === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-100'
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-lg', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', trendColor)}>
          <TrendIcon className="w-3 h-3" />
          {trend.label}
        </span>
      </div>
      <div>
        <p className="text-4xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-sm font-medium text-gray-500 mt-1">{label}</p>
      </div>
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">{sub}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 8

export default function OpsDashboard() {
  const [summary, setSummary]     = useState<DashboardSummary | null>(null)
  const [carriers, setCarriers]   = useState<CarrierPerformance[]>([])
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, shipmentsRes, alertsRes] = await Promise.all([
        dashboardApi.getStats(),
        shipmentsApi.getShipments({ page_size: 50 }),
        alertsApi.getAlerts(),
      ])
      setSummary(statsRes.data.summary)
      setCarriers(statsRes.data.carrier_performance)
      setShipments(shipmentsRes.data.results)
      setAlerts(alertsRes.data.results.slice(0, 5))
    } catch {
      setError('Unable to load operations data. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return shipments.filter((s) =>
      !q ||
      s.tracking_number.toLowerCase().includes(q) ||
      s.carrier_name.toLowerCase().includes(q) ||
      s.route.origin.toLowerCase().includes(q) ||
      s.route.destination.toLowerCase().includes(q),
    )
  }, [shipments, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--ct-navy)' }}
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {summary
              ? `${summary.total_shipments.toLocaleString()} shipments · ${summary.carrier_count} carriers`
              : 'Loading…'}
          </p>
        </div>
        <Link
          to="/ops/shipments/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-orange)' }}
        >
          <Package className="w-4 h-4" /> New Shipment
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-36 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Shipments" value={summary.total_shipments.toLocaleString()}
              sub={`${summary.delivered_shipments} delivered · ${summary.carrier_count} carriers`}
              trend={{ dir: 'up', label: `${summary.active_shipments} active` }}
              icon={Package} iconBg="bg-blue-500"
            />
            <StatCard
              label="Active" value={summary.active_shipments}
              sub={`${summary.total_shipments > 0 ? ((summary.active_shipments / summary.total_shipments) * 100).toFixed(0) : 0}% of fleet`}
              trend={{ dir: 'flat', label: 'In progress' }}
              icon={Truck} iconBg="bg-amber-500"
            />
            <StatCard
              label="Delayed" value={summary.delayed_shipments}
              sub={`${summary.exception_count} exceptions · ${summary.open_alerts} alerts`}
              trend={{ dir: summary.delayed_shipments > 0 ? 'down' : 'flat', label: `${summary.open_alerts} open` }}
              icon={AlertTriangle} iconBg="bg-red-500"
            />
            <StatCard
              label="On-Time Rate" value={`${summary.on_time_rate.toFixed(1)}%`}
              sub="Based on delivered shipments"
              trend={{ dir: summary.on_time_rate >= 90 ? 'up' : 'down', label: `${summary.delivered_shipments} delivered` }}
              icon={CheckCircle} iconBg="bg-emerald-500"
            />
          </>
        )}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Shipments table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Recent Shipments</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40 text-gray-700 placeholder:text-gray-400"
                />
              </div>
              <Link to="/ops/shipments" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Tracking #</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Route</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">ETA</th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageRows.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/ops/shipments/${s.id}`}
                            className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 group-hover:underline"
                          >
                            {s.tracking_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600">
                          <span className="font-medium truncate max-w-[80px] inline-block">{s.route.origin}</span>
                          <span className="text-gray-300 mx-1">→</span>
                          <span className="truncate max-w-[80px] inline-block">{s.route.destination}</span>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Clock className="w-3 h-3 text-gray-300 shrink-0" />
                            {new Date(s.scheduled_arrival).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><RiskBar risk={s.delay_risk_score} /></td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                          {search ? 'No shipments match your search.' : 'No shipments found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-1">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Carrier performance */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Carrier Performance</h2>
              <p className="text-xs text-gray-400 mt-0.5">On-time delivery rate</p>
            </div>
            {loading ? (
              <div className="px-5 py-4 space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-32 rounded bg-gray-100" />
                    <div className="h-1.5 rounded-full bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : carriers.length === 0 ? (
              <p className="px-5 py-4 text-xs text-gray-400">No carrier data.</p>
            ) : (
              <div className="px-5 py-3 divide-y divide-gray-50">
                {carriers.map((c) => {
                  const pct = c.shipment_count > 0 ? (c.on_time / c.shipment_count) * 100 : 100
                  return (
                    <div key={c.carrier_name} className="py-3 first:pt-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">{c.carrier_name}</span>
                        <span className={cn('text-xs font-bold tabular-nums', pct >= 90 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600')}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Active Alerts</h2>
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
    </div>
  )
}
