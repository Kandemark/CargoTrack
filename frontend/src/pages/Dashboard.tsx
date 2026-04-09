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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardSummary, CarrierPerformance, ShipmentListItem, ShipmentStatus } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────
// Pre-populated so the dashboard looks live from first render.
// Replaced by API data when the backend responds.

const MOCK_SUMMARY: DashboardSummary = {
  total_shipments: 247,
  active_shipments: 89,
  delivered_shipments: 63,
  delayed_shipments: 14,
  on_time_rate: 91.2,
  exception_count: 8,
  carrier_count: 4,
  open_alerts: 3,
}

const mkRoute = (origin: string, destination: string) => ({
  id: 0, origin, destination, distance_km: 0, estimated_hours: 0,
})

const MOCK_SHIPMENTS: ShipmentListItem[] = [
  { id: 1,  tracking_number: 'CT-20240408-A7B2', status_display: 'In Transit', status: 'IN_TRANSIT', carrier_name: 'Siginon Freight',        route: mkRoute('Mombasa Port',    'Nairobi ICD'),       weight_kg: 4200,  scheduled_departure: '2026-04-08', scheduled_arrival: '2026-04-10', delay_risk_score: 18 },
  { id: 2,  tracking_number: 'CT-20240407-C3D4', status_display: 'Delayed',    status: 'DELAYED',    carrier_name: 'Trans Africa Logistics', route: mkRoute('Dar es Salaam',   'Kampala ICD'),       weight_kg: 9100,  scheduled_departure: '2026-04-07', scheduled_arrival: '2026-04-09', delay_risk_score: 82 },
  { id: 3,  tracking_number: 'CT-20240406-E5F6', status_display: 'In Transit', status: 'IN_TRANSIT', carrier_name: 'Siginon Freight',        route: mkRoute('Mombasa Port',    'Kigali Dry Port'),   weight_kg: 6300,  scheduled_departure: '2026-04-06', scheduled_arrival: '2026-04-11', delay_risk_score: 31 },
  { id: 4,  tracking_number: 'CT-20240405-G7H8', status_display: 'Delivered',  status: 'DELIVERED',  carrier_name: 'Ken Freight Ltd',        route: mkRoute('Busia Border',    'Jinja ICD'),         weight_kg: 2100,  scheduled_departure: '2026-04-05', scheduled_arrival: '2026-04-07', delay_risk_score:  5 },
  { id: 5,  tracking_number: 'CT-20240405-I9J0', status_display: 'At Customs', status: 'CUSTOMS',    carrier_name: 'East Africa Carriers',   route: mkRoute('Dar es Salaam',   'Lusaka Freight'),    weight_kg: 7800,  scheduled_departure: '2026-04-05', scheduled_arrival: '2026-04-12', delay_risk_score: 65 },
  { id: 6,  tracking_number: 'CT-20240404-K1L2', status_display: 'In Transit', status: 'IN_TRANSIT', carrier_name: 'Trans Africa Logistics', route: mkRoute('Mombasa Port',    'Bujumbura Port'),    weight_kg: 5500,  scheduled_departure: '2026-04-04', scheduled_arrival: '2026-04-13', delay_risk_score: 22 },
  { id: 7,  tracking_number: 'CT-20240403-M3N4', status_display: 'Delayed',    status: 'DELAYED',    carrier_name: 'Ken Freight Ltd',        route: mkRoute('Kigali Dry Port', 'Nairobi ICD'),       weight_kg: 3300,  scheduled_departure: '2026-04-03', scheduled_arrival: '2026-04-08', delay_risk_score: 78 },
  { id: 8,  tracking_number: 'CT-20240402-O5P6', status_display: 'Pending',    status: 'PENDING',    carrier_name: 'Siginon Freight',        route: mkRoute('Mombasa Port',    'Juba Container'),    weight_kg: 1800,  scheduled_departure: '2026-04-10', scheduled_arrival: '2026-04-15', delay_risk_score: 12 },
  { id: 9,  tracking_number: 'CT-20240401-Q7R8', status_display: 'Delivered',  status: 'DELIVERED',  carrier_name: 'East Africa Carriers',   route: mkRoute('Dar es Salaam',   'Nairobi ICD'),       weight_kg: 8700,  scheduled_departure: '2026-04-01', scheduled_arrival: '2026-04-05', delay_risk_score:  9 },
  { id: 10, tracking_number: 'CT-20240401-S9T0', status_display: 'In Transit', status: 'IN_TRANSIT', carrier_name: 'Trans Africa Logistics', route: mkRoute('Mombasa Port',    'Kampala ICD'),       weight_kg: 5100,  scheduled_departure: '2026-04-01', scheduled_arrival: '2026-04-11', delay_risk_score: 45 },
]

const MOCK_CARRIERS: CarrierPerformance[] = [
  { carrier: 'Siginon Freight',        total: 84, on_time: 77, delayed: 7,  on_time_pct: 91.7 },
  { carrier: 'Ken Freight Ltd',        total: 56, on_time: 52, delayed: 4,  on_time_pct: 92.9 },
  { carrier: 'Trans Africa Logistics', total: 71, on_time: 61, delayed: 10, on_time_pct: 85.9 },
  { carrier: 'East Africa Carriers',   total: 36, on_time: 29, delayed: 7,  on_time_pct: 80.6 },
]

const MOCK_ALERTS = [
  { id: 1, tracking_number: 'CT-20240407-C3D4', message: 'High delay risk — road closure on A109 Nairobi corridor',  severity: 'critical' as const, sent_at: '2026-04-08T07:30:00Z' },
  { id: 2, tracking_number: 'CT-20240403-M3N4', message: 'Customs clearance stalled at Namanga border crossing',     severity: 'warning'  as const, sent_at: '2026-04-08T06:15:00Z' },
  { id: 3, tracking_number: 'CT-20240405-I9J0', message: 'Shipment held at Dar customs — additional docs required',  severity: 'warning'  as const, sent_at: '2026-04-08T04:00:00Z' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'tracking_number' | 'carrier_name' | 'scheduled_arrival' | 'delay_risk_score' | 'status'
type SortDir = 'asc' | 'desc'

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  IN_TRANSIT: { label: 'In Transit',  bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  CUSTOMS:    { label: 'At Customs',  bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  DELAYED:    { label: 'Delayed',     bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-400'    },
  DELIVERED:  { label: 'Delivered',   bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-400'},
  PENDING:    { label: 'Pending',     bg: 'bg-gray-100',  text: 'text-gray-600',   dot: 'bg-gray-400'   },
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', c.bg, c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

function RiskBadge({ risk }: { risk: number | null }) {
  if (risk === null) return <span className="text-gray-300 text-sm">—</span>
  const pct = Math.round(risk)
  const color = risk >= 70 ? 'text-red-600' : risk >= 40 ? 'text-amber-600' : 'text-emerald-600'
  const barColor = risk >= 70 ? 'bg-red-400' : risk >= 40 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', color)}>{pct}%</span>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  iconBg,
}: {
  label: string
  value: string | number
  sub: string
  trend: { dir: 'up' | 'down' | 'flat'; label: string }
  icon: React.ElementType
  iconBg: string
}) {
  const TrendIcon = trend.dir === 'up' ? TrendingUp : trend.dir === 'down' ? TrendingDown : Minus
  const trendColor = trend.dir === 'up' ? 'text-emerald-600 bg-emerald-50' : trend.dir === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-100'
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

function SortButton({
  colKey,
  sortCol,
  sortDir,
  onSort,
  children,
}: {
  colKey: SortKey
  sortCol: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  children: React.ReactNode
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

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 8

export default function Dashboard() {
  const [summary, setSummary]     = useState<DashboardSummary>(MOCK_SUMMARY)
  const [carriers, setCarriers]   = useState<CarrierPerformance[]>(MOCK_CARRIERS)
  const [sortCol, setSortCol]     = useState<SortKey>('scheduled_arrival')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)

  // Try to hydrate from API; fall back silently to mock data
  useEffect(() => {
    dashboardApi.getStats()
      .then((res) => {
        if (res.data.summary)              setSummary(res.data.summary)
        if (res.data.carrier_performance)  setCarriers(res.data.carrier_performance)
      })
      .catch(() => { /* keep mock */ })
  }, [])

  function handleSort(col: SortKey) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return MOCK_SHIPMENTS.filter(
      (s) =>
        !q ||
        s.tracking_number.toLowerCase().includes(q) ||
        s.carrier_name.toLowerCase().includes(q) ||
        s.route.origin.toLowerCase().includes(q) ||
        s.route.destination.toLowerCase().includes(q),
    )
  }, [search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = a[sortCol] ?? ''
      let bv: string | number = b[sortCol] ?? ''
      if (sortCol === 'delay_risk_score') {
        av = a.delay_risk_score ?? -1
        bv = b.delay_risk_score ?? -1
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Logistics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Northern Corridor — real-time visibility across {summary.total_shipments} shipments
          </p>
        </div>
        <Link
          to="/shipments/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-orange)' }}
        >
          <Package className="w-4 h-4" />
          New Shipment
        </Link>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Shipments"
          value={summary.total_shipments.toLocaleString()}
          sub={`${summary.delivered_shipments} delivered · ${summary.carrier_count} carriers`}
          trend={{ dir: 'up', label: '+12% vs last month' }}
          icon={Package}
          iconBg="bg-blue-500"
        />
        <StatCard
          label="Active"
          value={summary.active_shipments}
          sub={`${((summary.active_shipments / summary.total_shipments) * 100).toFixed(0)}% of total fleet`}
          trend={{ dir: 'flat', label: 'Stable' }}
          icon={Truck}
          iconBg="bg-amber-500"
        />
        <StatCard
          label="Delayed"
          value={summary.delayed_shipments}
          sub={`${summary.exception_count} exceptions requiring action`}
          trend={{ dir: 'down', label: '-2 vs yesterday' }}
          icon={AlertTriangle}
          iconBg="bg-red-500"
        />
        <StatCard
          label="On-Time Rate"
          value={`${summary.on_time_rate.toFixed(1)}%`}
          sub="Based on delivered shipments this month"
          trend={{ dir: 'up', label: '+2.1pp this month' }}
          icon={CheckCircle}
          iconBg="bg-emerald-500"
        />
      </div>

      {/* ── Middle row: table + right panel ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Shipments table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          {/* Table header */}
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
                View all
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left">
                    <SortButton colKey="tracking_number" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>
                      Tracking #
                    </SortButton>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Route</span>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <SortButton colKey="carrier_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>
                      Carrier
                    </SortButton>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <SortButton colKey="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>
                      Status
                    </SortButton>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <SortButton colKey="scheduled_arrival" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>
                      ETA
                    </SortButton>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <SortButton colKey="delay_risk_score" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>
                      Risk
                    </SortButton>
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
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Clock className="w-3 h-3 text-gray-300 shrink-0" />
                        {new Date(s.scheduled_arrival).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
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
                      No shipments match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              {filtered.length === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)}`} of {filtered.length} shipments
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={cn(
                    'w-6 h-6 rounded text-xs font-medium transition-colors',
                    n === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600',
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">

          {/* Carrier performance */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Carrier Performance</h2>
              <p className="text-xs text-gray-400 mt-0.5">On-time delivery rate</p>
            </div>
            <div className="px-5 py-3 divide-y divide-gray-50">
              {carriers.map((c) => (
                <div key={c.carrier} className="py-3 first:pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">{c.carrier}</span>
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      c.on_time_pct >= 90 ? 'text-emerald-600' : c.on_time_pct >= 80 ? 'text-amber-600' : 'text-red-600',
                    )}>
                      {c.on_time_pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          c.on_time_pct >= 90 ? 'bg-emerald-400' : c.on_time_pct >= 80 ? 'bg-amber-400' : 'bg-red-400',
                        )}
                        style={{ width: `${c.on_time_pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums w-16 text-right">
                      {c.on_time}/{c.total} trips
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active alerts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Active Alerts</h2>
                <p className="text-xs text-gray-400 mt-0.5">{MOCK_ALERTS.length} require attention</p>
              </div>
              <Link
                to="/alerts"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
              >
                All alerts <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {MOCK_ALERTS.map((alert) => (
                <div key={alert.id} className="px-5 py-3.5 flex gap-3">
                  <div className={cn(
                    'mt-0.5 w-2 h-2 rounded-full shrink-0',
                    alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400',
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 leading-snug">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs text-gray-400">{alert.tracking_number}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(alert.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Map placeholder ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Live Shipment Map</h2>
            <p className="text-xs text-gray-400 mt-0.5">Northern Corridor — Mombasa to Kigali</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
            <Clock className="w-3 h-3" />
            Coming Week 3
          </span>
        </div>

        {/* Styled map placeholder with dot-grid background */}
        <div
          className="relative h-48 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafb 50%, #f0f7f4 100%)',
          }}
        >
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Faint route lines */}
          <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
            <line x1="15%" y1="75%" x2="55%" y2="40%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="55%" y1="40%" x2="72%" y2="28%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="55%" y1="40%" x2="80%" y2="45%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="55%" y1="40%" x2="68%" y2="60%" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" />
            <circle cx="15%" cy="75%" r="4" fill="#f5801e" />
            <circle cx="55%" cy="40%" r="4" fill="#0f2d5e" />
            <circle cx="72%" cy="28%" r="3" fill="#64748b" />
            <circle cx="80%" cy="45%" r="3" fill="#64748b" />
            <circle cx="68%" cy="60%" r="3" fill="#64748b" />
          </svg>

          {/* City labels */}
          <div className="absolute bottom-5 left-[13%] text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mx-auto mb-1 shadow-sm" />
            <span className="text-xs font-medium text-gray-500">Mombasa</span>
          </div>
          <div className="absolute top-[32%] left-[52%] text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-900 mx-auto mb-1 shadow-sm" />
            <span className="text-xs font-medium text-gray-500">Nairobi</span>
          </div>

          {/* Center message */}
          <div className="relative z-10 text-center px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
            <MapPin className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-gray-700">Leaflet.js integration — Week 3</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Live GPS positions, route overlays, and geofence alerts
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
