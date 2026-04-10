/**
 * @file Dashboard.tsx
 * @description Main logistics dashboard page — the primary view for ADMIN,
 * LOGISTICS_MGR, and CARRIER users.
 *
 * Fetches three parallel API calls on mount:
 *   - `dashboardApi.getStats()` → KPI summary + carrier performance
 *   - `shipmentsApi.getShipments({ page_size: 50 })` → recent shipments table
 *   - `alertsApi.getAlerts()` → up to 5 unacknowledged alerts for the sidebar
 *
 * Sub-components (defined in this file):
 *   - `StatCard`    — individual KPI metric card with trend indicator
 *   - `KPISkeleton` — animated skeleton shown while KPI data loads
 *   - `StatusBadge` — coloured pill badge for shipment status
 *   - `RiskBadge`   — horizontal progress bar for delay_risk_score
 *   - `SortButton`  — column header with asc/desc chevron indicator
 *
 * @route /dashboard
 * @auth Any authenticated user (IsAuthenticated)
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ArrowUpRight,
  Clock,
  Minus,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type {
  DashboardSummary,
  CarrierPerformance,
  ShipmentListItem,
  ShipmentStatus,
  Alert,
} from '@/types'

// ── Status display config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  IN_TRANSIT: { label: 'In Transit',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  CUSTOMS:    { label: 'At Customs',  bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400'  },
  DELAYED:    { label: 'Delayed',     bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400'     },
  DELIVERED:  { label: 'Delivered',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  PENDING:    { label: 'Pending',     bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400'    },
}

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-red-400',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-blue-400',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', c.bg, c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

function RiskBadge({ risk }: { risk: number }) {
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

type SortKey = 'tracking_number' | 'carrier_name' | 'scheduled_arrival' | 'delay_risk_score' | 'status'
type SortDir = 'asc' | 'desc'

function SortButton({
  colKey, sortCol, sortDir, onSort, children,
}: {
  colKey: SortKey; sortCol: SortKey; sortDir: SortDir
  onSort: (k: SortKey) => void; children: React.ReactNode
}) {
  const active = sortCol === colKey
  return (
    <button
      onClick={() => onSort(colKey)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors',
        active ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600',
      )}
    >
      {children}
      <span className="flex flex-col gap-px">
        <ChevronUp   className={cn('w-2.5 h-2.5 -mb-0.5', active && sortDir === 'asc'  ? 'text-gray-800' : 'text-gray-300')} />
        <ChevronDown className={cn('w-2.5 h-2.5',          active && sortDir === 'desc' ? 'text-gray-800' : 'text-gray-300')} />
      </span>
    </button>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
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

function KPISkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-gray-100" />
        <div className="w-20 h-5 rounded-full bg-gray-100" />
      </div>
      <div>
        <div className="w-16 h-9 rounded bg-gray-100 mb-2" />
        <div className="w-24 h-4 rounded bg-gray-100" />
      </div>
      <div className="w-full h-4 rounded bg-gray-100 border-t border-gray-100 pt-3" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 8

export default function Dashboard() {
  const [summary, setSummary]       = useState<DashboardSummary | null>(null)
  const [carriers, setCarriers]     = useState<CarrierPerformance[]>([])
  const [shipments, setShipments]   = useState<ShipmentListItem[]>([])
  const [alerts, setAlerts]         = useState<Alert[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [sortCol, setSortCol]       = useState<SortKey>('scheduled_arrival')
  const [sortDir, setSortDir]       = useState<SortDir>('asc')
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)

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
      setError('Unable to load dashboard data. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return shipments.filter(
      (s) =>
        !q ||
        s.tracking_number.toLowerCase().includes(q) ||
        s.carrier_name.toLowerCase().includes(q) ||
        s.route.origin.toLowerCase().includes(q) ||
        s.route.destination.toLowerCase().includes(q),
    )
  }, [shipments, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number
      let bv: string | number
      if (sortCol === 'delay_risk_score') {
        av = a.delay_risk_score
        bv = b.delay_risk_score
      } else {
        av = (a[sortCol] as string) ?? ''
        bv = (b[sortCol] as string) ?? ''
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 font-medium">{error}</p>
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
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Logistics Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {summary
              ? `Northern Corridor — real-time visibility across ${summary.total_shipments.toLocaleString()} shipments`
              : 'Northern Corridor — loading…'}
          </p>
        </div>
        <Link
          to="/shipments/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-orange)' }}
        >
          <Package className="w-4 h-4" /> New Shipment
        </Link>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Shipments"
              value={summary.total_shipments.toLocaleString()}
              sub={`${summary.delivered_shipments} delivered · ${summary.carrier_count} carriers`}
              trend={{ dir: 'up', label: `${summary.active_shipments} active` }}
              icon={Package} iconBg="bg-blue-500"
            />
            <StatCard
              label="Active"
              value={summary.active_shipments}
              sub={`${summary.total_shipments > 0
                ? ((summary.active_shipments / summary.total_shipments) * 100).toFixed(0)
                : 0}% of total fleet`}
              trend={{ dir: 'flat', label: 'In progress' }}
              icon={Truck} iconBg="bg-amber-500"
            />
            <StatCard
              label="Delayed"
              value={summary.delayed_shipments}
              sub={`${summary.exception_count} exceptions requiring action`}
              trend={{ dir: summary.delayed_shipments > 0 ? 'down' : 'flat', label: `${summary.open_alerts} open alerts` }}
              icon={AlertTriangle} iconBg="bg-red-500"
            />
            <StatCard
              label="On-Time Rate"
              value={`${summary.on_time_rate.toFixed(1)}%`}
              sub="Based on delivered shipments"
              trend={{ dir: summary.on_time_rate >= 90 ? 'up' : 'down', label: `${summary.delivered_shipments} delivered` }}
              icon={CheckCircle} iconBg="bg-emerald-500"
            />
          </>
        )}
      </div>

      {/* ── Middle row ───────────────────────────────────────────────────────── */}
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
                  placeholder="Search shipments…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-44 text-gray-700 placeholder:text-gray-400"
                />
              </div>
              <Link
                to="/shipments"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-400">Loading shipments…</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left">
                        <SortButton colKey="tracking_number" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Tracking #</SortButton>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Route</span>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <SortButton colKey="carrier_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Carrier</SortButton>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <SortButton colKey="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Status</SortButton>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <SortButton colKey="scheduled_arrival" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>ETA</SortButton>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <SortButton colKey="delay_risk_score" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Risk</SortButton>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageRows.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/shipments/${s.id}`}
                            className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 group-hover:underline"
                          >
                            {s.tracking_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="font-medium truncate max-w-[90px]">{s.route.origin}</span>
                            <span className="text-gray-300">→</span>
                            <span className="truncate max-w-[90px]">{s.route.destination}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 max-w-[120px] truncate">
                          {s.carrier_name}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Clock className="w-3 h-3 text-gray-300 shrink-0" />
                            {new Date(s.scheduled_arrival).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <RiskBadge risk={s.delay_risk_score} />
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                          {search ? 'No shipments match your search.' : 'No shipments found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {filtered.length === 0
                      ? '0'
                      : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)}`} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n} onClick={() => setPage(n)}
                        className={cn('w-6 h-6 rounded text-xs font-medium transition-colors', n === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600')}
                      >{n}</button>
                    ))}
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
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
                  <div key={i}>
                    <div className="flex justify-between mb-1.5">
                      <div className="w-28 h-3 rounded bg-gray-100" />
                      <div className="w-8 h-3 rounded bg-gray-100" />
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : carriers.length === 0 ? (
              <p className="px-5 py-4 text-xs text-gray-400">No carrier data available.</p>
            ) : (
              <div className="px-5 py-3 divide-y divide-gray-50">
                {carriers.map((c) => {
                  const pct = c.shipment_count > 0
                    ? (c.on_time / c.shipment_count) * 100
                    : 100
                  return (
                  <div key={c.carrier_name} className="py-3 first:pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">{c.carrier_name}</span>
                      <span className={cn('text-xs font-bold tabular-nums',
                        pct >= 90 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600',
                      )}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full',
                            pct >= 90 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-red-400',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 tabular-nums w-16 text-right">
                        {c.on_time}/{c.shipment_count} trips
                      </span>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active alerts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Active Alerts</h2>
                {!loading && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {alerts.length > 0 ? `${alerts.length} require attention` : 'No active alerts'}
                  </p>
                )}
              </div>
              <Link to="/alerts" className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5">
                All alerts <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-3.5 flex gap-3">
                    <div className="mt-0.5 w-2 h-2 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded bg-gray-100 w-3/4" />
                      <div className="h-3 rounded bg-gray-100 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-400">
                No unacknowledged alerts
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alerts.map((alert) => (
                  <div key={alert.id} className="px-5 py-3.5 flex gap-3">
                    <div className={cn(
                      'mt-0.5 w-2 h-2 rounded-full shrink-0',
                      SEVERITY_DOT[alert.severity] ?? 'bg-gray-400',
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-gray-400">{alert.shipment_tracking}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-gray-400">
                          {new Date(alert.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Map placeholder ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Live Shipment Map</h2>
            <p className="text-xs text-gray-400 mt-0.5">Northern Corridor — Mombasa to Kigali</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
            <Clock className="w-3 h-3" /> Leaflet.js — coming soon
          </span>
        </div>
        <div
          className="relative h-48 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafb 50%, #f0f7f4 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '28px 28px' }}
          />
          <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
            <line x1="15%" y1="75%" x2="55%" y2="40%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="55%" y1="40%" x2="72%" y2="28%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="55%" y1="40%" x2="80%" y2="45%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <circle cx="15%" cy="75%" r="4" fill="#f5801e" />
            <circle cx="55%" cy="40%" r="4" fill="#0f2d5e" />
            <circle cx="72%" cy="28%" r="3" fill="#64748b" />
            <circle cx="80%" cy="45%" r="3" fill="#64748b" />
          </svg>
          <div className="absolute bottom-5 left-[13%] text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mx-auto mb-1 shadow-sm" />
            <span className="text-xs font-medium text-gray-500">Mombasa</span>
          </div>
          <div className="absolute top-[32%] left-[52%] text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-900 mx-auto mb-1 shadow-sm" />
            <span className="text-xs font-medium text-gray-500">Nairobi</span>
          </div>
          <div className="relative z-10 text-center px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
            <MapPin className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-gray-700">Leaflet.js integration</p>
            <p className="text-xs text-gray-400 mt-0.5">Live GPS positions, route overlays, and geofence alerts</p>
          </div>
        </div>
      </div>
    </div>
  )
}
