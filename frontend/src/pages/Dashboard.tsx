/**
 * Dashboard.tsx — Analytics-rich operations dashboard.
 * Charts: RadialBarChart (on-time rate), AreaChart (volume), horizontal risk bars,
 *         grouped BarChart (carrier perf), vertical timeline (recent events).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Package, Truck, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, ArrowUpRight, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type { DashboardSummary, CarrierPerformance, ShipmentListItem, Alert, AlertSeverity } from '@/types'

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function useCountUp(target: number, active: boolean): number {
  const [val, setVal] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const dur = 900
    ref.current = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed >= dur) { setVal(target); clearInterval(ref.current!); return }
      setVal(Math.round((elapsed / dur) * target))
    }, 16)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [target, active])
  return val
}

// ── Skeleton blocks ───────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

function KpiSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5 space-y-3">
      <div className="flex justify-between">
        <Sk className="w-10 h-10 rounded-lg" />
        <Sk className="w-20 h-5 rounded-full" />
      </div>
      <Sk className="w-16 h-9" />
      <Sk className="w-28 h-3.5" />
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number
  suffix?: string
  sub: string
  trend: 'up' | 'down' | 'flat'
  trendLabel: string
  iconBg: string
  icon: React.ElementType
  delay: number
}

function KpiCard({ label, value, suffix, sub, trend, trendLabel, iconBg, icon: Icon, delay }: KpiCardProps) {
  const [active, setActive] = useState(false)
  const displayed = useCountUp(value, active)
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null
  const trendCls = trend === 'up'
    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
    : trend === 'down'
    ? 'text-red-600 bg-red-50 dark:bg-red-900/30'
    : 'text-gray-500 bg-gray-100 dark:bg-white/8'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      onAnimationComplete={() => setActive(true)}
      className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5 flex flex-col gap-3 shadow-card hover:shadow-elevated transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-lg', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', trendCls)}>
          {TrendIcon && <TrendIcon className="w-3 h-3" />}
          {trendLabel}
        </span>
      </div>
      <div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">
          {displayed.toLocaleString()}{suffix}
        </p>
        <p className="text-sm font-medium text-gray-500 dark:text-white/50 mt-1">{label}</p>
      </div>
      <p className="text-xs text-gray-400 dark:text-white/30 border-t border-gray-100 dark:border-white/8 pt-3">{sub}</p>
    </motion.div>
  )
}

// ── Event type colours ────────────────────────────────────────────────────────

const EVENT_DOT: Record<string, string> = {
  DEPARTURE:    'bg-blue-400',
  CHECKPOINT:   'bg-gray-300',
  CUSTOMS_ENTRY:'bg-amber-400',
  CUSTOMS_CLEAR:'bg-amber-400',
  ARRIVAL:      'bg-emerald-400',
  DELAY:        'bg-red-400',
  NOTE:         'bg-gray-300',
}
const EVENT_BORDER: Record<string, string> = {
  DEPARTURE:    'border-blue-200',
  CHECKPOINT:   'border-gray-100',
  CUSTOMS_ENTRY:'border-amber-200',
  CUSTOMS_CLEAR:'border-amber-200',
  ARRIVAL:      'border-emerald-200',
  DELAY:        'border-red-200',
  NOTE:         'border-gray-100',
}

// ── Volume chart data builder ─────────────────────────────────────────────────

type Range = '7D' | '14D' | '30D' | '90D'

function buildVolumeData(shipments: ShipmentListItem[], range: Range) {
  const days = range === '7D' ? 7 : range === '14D' ? 14 : range === '30D' ? 30 : 90
  const buckets: Record<string, { delivered: number; delayed: number; other: number }> = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    buckets[key] = { delivered: 0, delayed: 0, other: 0 }
  }
  for (const s of shipments) {
    const d = new Date(s.scheduled_arrival)
    if (isNaN(d.getTime())) continue
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
    if (daysAgo < 0 || daysAgo >= days) continue
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    if (key in buckets) {
      if (s.status === 'DELIVERED') buckets[key].delivered++
      else if (s.status === 'DELAYED') buckets[key].delayed++
      else buckets[key].other++
    }
  }
  return Object.entries(buckets).map(([day, v]) => ({ day, ...v }))
}

// ── Alert severity config ─────────────────────────────────────────────────────

const SEV_CONFIG: Record<AlertSeverity, { label: string; bg: string; text: string }> = {
  LOW:      { label: 'Low',      bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300'   },
  MEDIUM:   { label: 'Medium',   bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
  HIGH:     { label: 'High',     bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300' },
  CRITICAL: { label: 'Critical', bg: 'bg-red-50 dark:bg-red-900/20',     text: 'text-red-700 dark:text-red-300'     },
}

// ── Main component ────────────────────────────────────────────────────────────

const RANGES: Range[] = ['7D', '14D', '30D', '90D']

export default function Dashboard() {
  const [summary,   setSummary]   = useState<DashboardSummary | null>(null)
  const [carriers,  setCarriers]  = useState<CarrierPerformance[]>([])
  const [events,    setEvents]    = useState<{ event_type: string; event_type_display: string; location: string; timestamp: string }[]>([])
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [range,     setRange]     = useState<Range>('14D')

  async function load() {
    setLoading(true); setError(null)
    try {
      const [statsRes, shipmentsRes, alertsRes] = await Promise.all([
        dashboardApi.getStats(),
        shipmentsApi.getShipments({ page_size: 100 }),
        alertsApi.getAlerts({ all: '1' }),
      ])
      setSummary(statsRes.data.summary)
      setCarriers(statsRes.data.carrier_performance)
      setEvents(statsRes.data.recent_events ?? [])
      setShipments(shipmentsRes.data.results)
      setAlerts(alertsRes.data.results)
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  // ── Derived data ──────────────────────────────────────────────────────────

  const volumeData = useMemo(() => buildVolumeData(shipments, range), [shipments, range])

  const riskTop10 = useMemo(
    () => [...shipments].sort((a, b) => b.delay_risk_score - a.delay_risk_score).slice(0, 10),
    [shipments],
  )

  const carrierChartData = useMemo(() =>
    carriers.map((c) => ({
      name: c.carrier_name.length > 12 ? c.carrier_name.slice(0, 12) + '…' : c.carrier_name,
      fullName: c.carrier_name,
      onTime: c.shipment_count > 0 ? Math.round((c.on_time / c.shipment_count) * 100) : 0,
      risk: Math.round(c.avg_risk * 100),
    })), [carriers])

  const sevCounts = useMemo(() => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<AlertSeverity, number>
    for (const a of alerts) counts[a.severity] = (counts[a.severity] ?? 0) + 1
    return counts
  }, [alerts])

  const onTimeData = summary
    ? [{ name: 'On-Time', value: summary.on_time_rate, fill: summary.on_time_rate >= 90 ? '#22c55e' : summary.on_time_rate >= 75 ? '#f59e0b' : '#ef4444' }]
    : []

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-white/60">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            {summary ? `${summary.total_shipments.toLocaleString()} shipments · ${summary.carrier_count} carriers` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/ops/shipments/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--ct-orange)' }}
          >
            <Package className="w-4 h-4" /> New Shipment
          </Link>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total Shipments"  value={summary.total_shipments}   sub={`${summary.carrier_count} active carriers`} trend="up" trendLabel="All time" iconBg="bg-blue-500"    icon={Package}       delay={0}    />
            <KpiCard label="Active In-Transit" value={summary.active_shipments}  sub={`${((summary.active_shipments / Math.max(summary.total_shipments, 1)) * 100).toFixed(0)}% of fleet`} trend="flat" trendLabel="Live now" iconBg="bg-amber-500" icon={Truck}         delay={0.06} />
            <KpiCard label="Delayed Shipments" value={summary.delayed_shipments} sub={`${summary.exception_count} exceptions`} trend="down" trendLabel="Need action" iconBg="bg-red-500"    icon={AlertTriangle} delay={0.12} />
            <KpiCard label="On-Time Rate" value={Math.round(summary.on_time_rate)} suffix="%" sub={`${summary.delivered_shipments} delivered`} trend={summary.on_time_rate >= 90 ? 'up' : 'down'} trendLabel="Last 30d" iconBg="bg-emerald-500" icon={CheckCircle} delay={0.18} />
          </>
        )}
      </div>

      {/* ── Alert severity pills ──────────────────────────────────────────────── */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="flex flex-wrap gap-3">
          {(Object.keys(SEV_CONFIG) as AlertSeverity[]).map((sev) => {
            const cfg = SEV_CONFIG[sev]
            const count = sevCounts[sev] ?? 0
            return (
              <Link
                key={sev}
                to="/shared/alerts"
                className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80', cfg.bg, cfg.text)}
              >
                <Bell className="w-3.5 h-3.5" />
                {cfg.label}
                <span className="px-1.5 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-xs font-bold">{count}</span>
              </Link>
            )
          })}
        </motion.div>
      )}

      {/* ── Middle row: volume chart + on-time donut ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Volume AreaChart */}
        <div className="xl:col-span-2 bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Shipment Volume</h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Delivered vs delayed by day</p>
            </div>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                    range === r ? 'bg-ct-navy text-white' : 'text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10')}
                >{r}</button>
              ))}
            </div>
          </div>
          {loading ? <Sk className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={volumeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDeliv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDelay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#22c55e" fill="url(#gDeliv)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="delayed"   name="Delayed"   stroke="#ef4444" fill="url(#gDelay)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* On-Time RadialBar */}
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5 shadow-card flex flex-col items-center">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading self-start">On-Time Rate</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 self-start mt-0.5 mb-4">Last 30 days · delivered shipments</p>
          {loading || !summary ? <Sk className="w-40 h-40 rounded-full" /> : (
            <div className="relative">
              <ResponsiveContainer width={180} height={180}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="90%"
                  startAngle={225} endAngle={-45} data={onTimeData}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#f1f5f9' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-heading text-gray-900 dark:text-white">
                  {summary.on_time_rate.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400 dark:text-white/40">on time</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: risk heatmap + carrier chart + events ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Delay risk heatmap */}
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Delay Risk Heatmap</h2>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Top 10 highest-risk shipments</p>
          </div>
          {loading ? (
            <div className="px-5 py-4 space-y-3">{[...Array(5)].map((_, i) => <Sk key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {riskTop10.map((s, idx) => {
                const pct = Math.round(s.delay_risk_score * 100)
                const color = pct >= 70 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e'
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 px-5 py-3 group"
                  >
                    <Link
                      to={`/ops/shipments/${s.id}`}
                      className="font-mono text-xs text-blue-600 hover:underline truncate w-28 shrink-0"
                    >
                      {s.tracking_number}
                    </Link>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3 + idx * 0.04, duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color }}>
                      {pct}%
                    </span>
                    <Link to={`/ops/shipments/${s.id}`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </motion.div>
                )
              })}
              {riskTop10.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-400 dark:text-white/30">No shipments loaded.</p>
              )}
            </div>
          )}
        </div>

        {/* Carrier performance BarChart */}
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-1">Carrier Performance</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-4">On-time % vs avg risk score</p>
          {loading ? <Sk className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={carrierChartData} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, n) => [`${v}%`, n === 'onTime' ? 'On-Time Rate' : 'Avg Risk']} />
                <Bar dataKey="onTime" name="onTime" fill="#22c55e" radius={[3, 3, 0, 0]}>
                  {carrierChartData.map((_, i) => <Cell key={i} fill="#22c55e" />)}
                </Bar>
                <Bar dataKey="risk" name="risk" fill="#f59e0b" radius={[3, 3, 0, 0]}>
                  {carrierChartData.map((_, i) => <Cell key={i} fill="#f59e0b" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent events timeline */}
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Recent Events</h2>
            <Link to="/shared/tracking" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="px-5 py-4 space-y-4">{[...Array(4)].map((_, i) => <Sk key={i} className="h-12 w-full" />)}</div>
          ) : events.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400 dark:text-white/30">No recent events.</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-64 overflow-y-auto">
              {events.slice(0, 12).map((ev, i) => {
                const dot = EVENT_DOT[ev.event_type] ?? 'bg-gray-300'
                const border = EVENT_BORDER[ev.event_type] ?? 'border-gray-100'
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn('flex gap-3 px-5 py-3 border-l-2', border)}
                  >
                    <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-white/80 leading-snug">{ev.event_type_display}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 truncate">{ev.location}</p>
                    </div>
                    <span className="text-xs text-gray-300 dark:text-white/20 shrink-0">{timeAgo(ev.timestamp)}</span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
