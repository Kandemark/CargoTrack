import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Package, Truck, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  ArrowUpRight, RefreshCw, DollarSign, Zap, Globe, BarChart2, Bell,
  Activity, Map, ChevronRight, Clock, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import { paymentsApi } from '@/api/payments'
import { analyticsApi, type ProfitMonthly } from '@/api/analytics'
import type { DashboardSummary, CarrierPerformance, ShipmentListItem, Alert, AlertSeverity, Invoice } from '@/types'

const GlobeScene = lazy(() => import('@/components/3d/GlobeScene'))

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function useCountUp(target: number, active: boolean): number {
  const [val, setVal] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const dur = 1100
    ref.current = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed >= dur) { setVal(target); clearInterval(ref.current!); return }
      const ease = 1 - Math.pow(1 - elapsed / dur, 3)
      setVal(Math.round(ease * target))
    }, 16)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [target, active])
  return val
}

const fmtKES = (v: number) => v >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(1)}M` : `KES ${(v / 1_000).toFixed(0)}K`

function buildRevenueData(invoices: Invoice[], profitMonthly?: ProfitMonthly[]) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const buckets: Record<string, { income: number; cost: number }> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    buckets[key] = { income: 0, cost: 0 }
  }
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue
    const d = new Date(inv.created_at)
    const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    if (key in buckets) buckets[key].income += Number(inv.amount_kes)
  }
  if (profitMonthly) {
    for (const pm of profitMonthly) {
      const monthAbbr = MONTHS[new Date(pm.month + '-01').getMonth()]
      const year = new Date(pm.month + '-01').getFullYear()
      const key = `${monthAbbr} ${year}`
      if (key in buckets) buckets[key].cost = pm.cost
    }
  }
  return Object.entries(buckets).map(([key, v]) => ({
    month: key.split(' ')[0],
    income: v.income,
    expenses: v.cost > 0 ? v.cost : Math.round(v.income * 0.38),
  }))
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string; value: number; suffix?: string; sub: string
  trend: 'up' | 'down' | 'flat'; trendLabel: string
  iconBg: string; icon: React.ElementType; delay: number
  prefix?: string; sparkline?: number[]
}

function KpiCard({ label, value, suffix, sub, trend, trendLabel, iconBg, icon: Icon, delay, prefix, sparkline }: KpiProps) {
  const [active, setActive] = useState(false)
  const displayed = useCountUp(value, active)
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null
  const trendCls = trend === 'up'
    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
    : trend === 'down' ? 'text-red-600 bg-red-50 dark:bg-red-900/30'
    : 'text-gray-500 bg-gray-100 dark:bg-white/8'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => setActive(true)}
      className="group bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100 dark:border-white/8 p-5
        flex flex-col gap-3 shadow-card hover:shadow-xl hover:shadow-gray-100 dark:hover:shadow-black/20
        hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', trendCls)}>
          {TrendIcon && <TrendIcon className="w-3 h-3" />}
          {trendLabel}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white font-heading tabular-nums tracking-tight">
          {prefix}{displayed.toLocaleString()}{suffix}
        </p>
        <p className="text-sm font-medium text-gray-500 dark:text-white/50 mt-1">{label}</p>
      </div>
      {sparkline && (
        <div className="h-8 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
              <Line type="monotone" dataKey="v" stroke={trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#94a3b8'} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-white/30 border-t border-gray-100 dark:border-white/6 pt-2.5">{sub}</p>
    </motion.div>
  )
}

// ── Alert severity config ─────────────────────────────────────────────────────

const SEV_CONFIG: Record<AlertSeverity, { label: string; bg: string; text: string; dot: string }> = {
  LOW:      { label: 'Low',      bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-400'   },
  MEDIUM:   { label: 'Medium',   bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-400'  },
  HIGH:     { label: 'High',     bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-400' },
  CRITICAL: { label: 'Critical', bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-400'    },
}

type Range = '7D' | '14D' | '30D' | '90D'
const RANGES: Range[] = ['7D', '14D', '30D', '90D']

const EVENT_DOT: Record<string, string> = {
  DEPARTURE: 'bg-blue-400', CHECKPOINT: 'bg-gray-400',
  CUSTOMS_ENTRY: 'bg-amber-400', CUSTOMS_CLEAR: 'bg-amber-400',
  ARRIVAL: 'bg-emerald-400', DELAY: 'bg-red-400', NOTE: 'bg-gray-400',
}

function buildVolumeData(shipments: ShipmentListItem[], range: Range) {
  const days = range === '7D' ? 7 : range === '14D' ? 14 : range === '30D' ? 30 : 90
  const buckets: Record<string, { delivered: number; delayed: number; active: number }> = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    buckets[key] = { delivered: 0, delayed: 0, active: 0 }
  }
  for (const s of shipments) {
    const d = new Date(s.scheduled_arrival)
    if (isNaN(d.getTime())) continue
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
    if (daysAgo < 0 || daysAgo >= days) continue
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    if (!(key in buckets)) continue
    if (s.status === 'DELIVERED') buckets[key].delivered++
    else if (s.status === 'DELAYED') buckets[key].delayed++
    else buckets[key].active++
  }
  return Object.entries(buckets).map(([day, v]) => ({ day, ...v }))
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/10 rounded-xl shadow-elevated px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 dark:text-white/80 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 dark:text-white/50">{p.name}:</span>
          <span className="font-semibold text-gray-700 dark:text-white/80">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ── Live dot ──────────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading tracking-tight">{title}</h2>
        {sub && <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary,   setSummary]   = useState<DashboardSummary | null>(null)
  const [carriers,  setCarriers]  = useState<CarrierPerformance[]>([])
  const [events,    setEvents]    = useState<{ event_type: string; event_type_display: string; location: string; timestamp: string }[]>([])
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [invoices,  setInvoices]  = useState<Invoice[]>([])
  const [profitMonthly, setProfitMonthly] = useState<ProfitMonthly[]>([])
  const [profitMargin, setProfitMargin] = useState<number>(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [range,     setRange]     = useState<Range>('14D')
  const [globeReady, setGlobeReady] = useState(false)

  const fetchingRef = useRef(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [statsRes, shipmentsRes, alertsRes, invoicesRes, profitRes] = await Promise.all([
        dashboardApi.getStats(),
        shipmentsApi.getShipments({ page_size: 200 }),
        alertsApi.getAlerts({ all: '1' }),
        paymentsApi.listInvoices({ page_size: 500 }),
        analyticsApi.profit({ date_from: '', date_to: '' }).catch(() => ({ data: { monthly: [], margin_pct: 0, revenue_total: 0, cost_total: 0, profit_total: 0, by_carrier: [], by_route: [] } })),
      ])
      setSummary(statsRes.data.summary)
      setCarriers(statsRes.data.carrier_performance)
      setEvents(statsRes.data.recent_events ?? [])
      setShipments(shipmentsRes.data.results)
      setAlerts(alertsRes.data.results)
      setInvoices(invoicesRes.data.results)
      setProfitMonthly(profitRes.data.monthly ?? [])
      setProfitMargin(Math.round(profitRes.data.margin_pct ?? 0))
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  useEffect(() => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    void load()
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setGlobeReady(true), 600)
    return () => clearTimeout(t)
  }, [])

  const volumeData = useMemo(() => buildVolumeData(shipments, range), [shipments, range])
  const revenueData = useMemo(() => buildRevenueData(invoices, profitMonthly), [invoices, profitMonthly])
  const totalRevenueMTD = useMemo(() => {
    const now = new Date()
    return invoices
      .filter(inv => inv.status === 'PAID' && new Date(inv.created_at).getMonth() === now.getMonth() && new Date(inv.created_at).getFullYear() === now.getFullYear())
      .reduce((sum, inv) => sum + Number(inv.amount_kes), 0)
  }, [invoices])

  const riskTop10 = useMemo(
    () => [...shipments].sort((a, b) => b.delay_risk_score - a.delay_risk_score).slice(0, 10),
    [shipments],
  )

  const carrierChartData = useMemo(() =>
    carriers.map((c) => ({
      name: c.carrier_name.length > 14 ? c.carrier_name.slice(0, 14) + '…' : c.carrier_name,
      fullName: c.carrier_name,
      onTime: c.shipment_count > 0 ? Math.round((c.on_time / c.shipment_count) * 100) : 0,
      risk: Math.round(c.avg_risk * 100),
      count: c.shipment_count,
    })), [carriers])

  const sevCounts = useMemo(() => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<AlertSeverity, number>
    for (const a of alerts) counts[a.severity] = (counts[a.severity] ?? 0) + 1
    return counts
  }, [alerts])

  const onTimeRate = summary?.on_time_rate ?? 0
  const onTimeData = summary
    ? [{ name: 'On-Time', value: onTimeRate, fill: onTimeRate >= 90 ? '#22c55e' : onTimeRate >= 75 ? '#f59e0b' : '#ef4444' }]
    : []

  const fleetPct = summary
    ? Math.round((summary.active_shipments / Math.max(summary.total_shipments, 1)) * 100)
    : 0
  const fleetDonutData = [
    { name: 'Active', value: fleetPct, fill: '#0f2d5e' },
    { name: 'Idle', value: 100 - fleetPct, fill: '#f1f5f9' },
  ]

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of shipments) counts[s.status] = (counts[s.status] ?? 0) + 1
    return [
      { name: 'Delivered', value: counts['DELIVERED'] ?? 0, fill: '#22c55e' },
      { name: 'In Transit', value: counts['IN_TRANSIT'] ?? 0, fill: '#0f2d5e' },
      { name: 'Delayed', value: counts['DELAYED'] ?? 0, fill: '#ef4444' },
      { name: 'Pending', value: counts['PENDING'] ?? 0, fill: '#f59e0b' },
      { name: 'Customs', value: counts['CUSTOMS'] ?? 0, fill: '#8b5cf6' },
    ]
  }, [shipments])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-white/60">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-4">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Operations Dashboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <LiveDot />
            <p className="text-sm text-gray-500 dark:text-white/50">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <Link to="/ops/shipments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'var(--ct-orange)' }}>
            <Package className="w-4 h-4" /> New Shipment
          </Link>
        </div>
      </motion.div>

      {/* ── Hero: globe + quick stats ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.45 }}
        className="relative rounded-2xl overflow-hidden border border-white/0 shadow-2xl shadow-[#0f2d5e]/20"
        style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #0a1e40 60%, #071428 100%)' }}>
        {/* Ambient glow orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.08] blur-[80px]"
          style={{ background: 'radial-gradient(circle, #f5801e 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-[0.06] blur-[60px]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #f5801e 0%, transparent 50%), radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 40%)' }} />
        <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-0 min-h-[220px]">

          {/* Left stats */}
          <div className="lg:col-span-3 p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-[#f5801e]/20 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest">Global Operations</span>
              </div>
              <h2 className="text-2xl font-bold text-white font-heading leading-tight">
                CargoTrack Intelligence
                <br />
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">East Africa Hub</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              {[
                { label: 'Total Shipments', value: summary?.total_shipments ?? 0, icon: Package },
                { label: 'Active Routes', value: summary?.active_shipments ?? 0, icon: Map },
                { label: 'Carriers', value: summary?.carrier_count ?? 0, icon: Truck },
                { label: 'Exceptions', value: summary?.exception_count ?? 0, icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }, i) => (
                <motion.div key={label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }}
                  className="bg-white/6 hover:bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 border border-white/5 hover:border-white/10 transition-all duration-200">
                  <Icon className="w-4 h-4 text-white/50 mb-1.5" />
                  <p className="text-xl font-bold text-white tabular-nums">{loading ? '—' : value.toLocaleString()}</p>
                  <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">{label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Globe */}
          <div className="lg:col-span-2 relative flex items-center justify-center min-h-[200px] lg:min-h-0">
            <AnimatePresence>
              {globeReady && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="w-full h-full absolute inset-0">
                  <Suspense fallback={null}>
                    <GlobeScene className="w-full h-full" />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-400" />
                </span>
                <span className="text-[10px] text-white/70 font-medium">Nairobi Hub · Live</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── KPI row (6 cards) ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading || !summary ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 space-y-3">
              <Sk className="w-10 h-10 rounded-xl" />
              <Sk className="w-14 h-8" /><Sk className="w-24 h-3.5" />
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Total Shipments" value={summary.total_shipments} sub={`${summary.carrier_count} carriers`} trend="up" trendLabel="All time" iconBg="bg-gradient-to-br from-blue-500 to-blue-600" icon={Package} delay={0} sparkline={[40,55,45,65,70,60,80,75,90,summary.total_shipments > 0 ? 100 : 0]} />
            <KpiCard label="In Transit" value={summary.active_shipments} sub="Currently active" trend="flat" trendLabel="Live" iconBg="bg-gradient-to-br from-amber-500 to-orange-500" icon={Truck} delay={0.05} sparkline={[30,40,35,50,45,55,50,60,55,summary.active_shipments > 0 ? 65 : 0]} />
            <KpiCard label="Delayed" value={summary.delayed_shipments} sub={`${summary.exception_count} exceptions`} trend="down" trendLabel="Need action" iconBg="bg-gradient-to-br from-red-500 to-rose-500" icon={AlertTriangle} delay={0.10} />
            <KpiCard label="On-Time Rate" value={Math.round(summary.on_time_rate)} suffix="%" sub={`${summary.delivered_shipments} delivered`} trend={summary.on_time_rate >= 90 ? 'up' : 'down'} trendLabel="Last 30d" iconBg="bg-gradient-to-br from-emerald-500 to-teal-500" icon={CheckCircle} delay={0.15} sparkline={[70,72,75,78,74,80,82,79,85,Math.round(summary.on_time_rate)]} />
            <KpiCard label="Revenue MTD" value={Math.round(totalRevenueMTD / 1000)} prefix="" suffix="K KES" sub="Paid invoices this month" trend="up" trendLabel="MTD" iconBg="bg-gradient-to-br from-violet-500 to-purple-500" icon={DollarSign} delay={0.20} sparkline={revenueData.slice(-10).map(d => d.income / 1000)} />
            <KpiCard label="Profit Margin" value={profitMargin > 0 ? profitMargin : Math.round(((summary.total_revenue_mtd ?? 0) - (summary.total_cost_mtd ?? 0)) / Math.max((summary.total_revenue_mtd ?? 1), 1) * 100)} suffix="%" sub="Revenue vs cost MTD" trend={profitMargin >= 20 ? 'up' : profitMargin > 0 ? 'flat' : 'down'} trendLabel="MTD" iconBg="bg-gradient-to-br from-emerald-500 to-green-500" icon={DollarSign} delay={0.25} />
          </>
        )}
      </div>

      {/* ── Alert severity pills ──────────────────────────────────────────────── */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2.5">
          {(Object.keys(SEV_CONFIG) as AlertSeverity[]).map((sev) => {
            const cfg = SEV_CONFIG[sev]
            const count = sevCounts[sev] ?? 0
            return (
              <Link key={sev} to="/alerts"
                className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 hover:shadow-sm', cfg.bg, cfg.text)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                {cfg.label}
                <span className="px-1.5 py-0.5 rounded-full bg-black/8 dark:bg-white/10 text-xs font-bold">{count}</span>
                <ChevronRight className="w-3 h-3 opacity-50" />
              </Link>
            )
          })}
          <Link to="/alerts" className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/70 transition-colors self-center">
            View all alerts <ArrowUpRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* ── Middle row: charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* Revenue & Volume Area Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="xl:col-span-8 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <SectionHead
            title="Revenue Overview"
            sub="Paid invoices vs estimated expenses — 12-month rolling"
            action={
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r} onClick={() => setRange(r)}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                      range === r ? 'text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
                    style={range === r ? { background: 'var(--ct-navy)' } : {}}>
                    {r}
                  </button>
                ))}
              </div>
            }
          />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f2d5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0f2d5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5801e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f5801e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtKES(v)} />
              <Tooltip content={<ChartTooltip />} formatter={(v: number) => fmtKES(v)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#0f2d5e" fill="url(#gIncome)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f5801e" fill="url(#gExpenses)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Shipment status donut */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="xl:col-span-4 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card flex flex-col">
          <SectionHead title="Shipment Status" sub="Current distribution" />
          {loading ? <Sk className="flex-1 w-full rounded-xl" /> : (
            <div className="flex flex-col items-center gap-3">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value">
                    {statusBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-1.5">
                {statusBreakdown.filter(s => s.value > 0).map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                      <span className="text-gray-600 dark:text-white/60">{s.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-white/80">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Shipment volume + on-time + fleet ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* Shipment volume */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="xl:col-span-7 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <SectionHead title="Shipment Volume" sub="Delivered vs delayed vs active by day" />
          {loading ? <Sk className="h-48 w-full rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeData} barCategoryGap="25%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="delivered" name="Delivered" fill="#22c55e" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="active"    name="Active"    fill="#0f2d5e" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="delayed"   name="Delayed"   fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* On-time rate donut */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}
          className="xl:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card flex flex-col items-center">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading self-start">On-Time</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 self-start mb-4">Last 30 days</p>
          {loading || !summary ? <Sk className="w-28 h-28 rounded-full" /> : (
            <div className="relative">
              <ResponsiveContainer width={110} height={110}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="62%" outerRadius="90%" startAngle={225} endAngle={-45} data={onTimeData}>
                  <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f1f5f9' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-heading text-gray-900 dark:text-white">{summary.on_time_rate.toFixed(0)}%</span>
                <span className="text-[9px] text-gray-400 dark:text-white/40 mt-0.5">on time</span>
              </div>
            </div>
          )}
          <div className="mt-auto pt-3 w-full border-t border-gray-100 dark:border-white/6 text-center">
            <p className="text-xs text-gray-400 dark:text-white/30">{summary?.delivered_shipments ?? 0} delivered</p>
          </div>
        </motion.div>

        {/* Fleet utilization donut */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.50 }}
          className="xl:col-span-3 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card flex flex-col items-center">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading self-start">Fleet Util.</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 self-start mb-4">Active vs total capacity</p>
          {loading || !summary ? <Sk className="w-28 h-28 rounded-full" /> : (
            <div className="relative">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={fleetDonutData} cx="50%" cy="50%" innerRadius={34} outerRadius={50} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                    {fleetDonutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-heading" style={{ color: 'var(--ct-navy)' }}>{fleetPct}%</span>
              </div>
            </div>
          )}
          <div className="mt-auto pt-3 w-full border-t border-gray-100 dark:border-white/6 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1 text-gray-500 dark:text-white/40"><span className="w-2 h-2 rounded-full bg-ct-navy" />Active</span>
              <span className="font-semibold text-gray-700 dark:text-white/70">{summary?.active_shipments ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1 text-gray-400 dark:text-white/30"><span className="w-2 h-2 rounded-full bg-gray-200" />Idle</span>
              <span className="font-semibold text-gray-500 dark:text-white/50">{(summary?.total_shipments ?? 0) - (summary?.active_shipments ?? 0)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom row: risk + carrier + events ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Delay risk heatmap */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Delay Risk Radar</h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Top 10 highest-risk shipments</p>
            </div>
            <Shield className="w-4 h-4 text-gray-300 dark:text-white/20" />
          </div>
          {loading ? (
            <div className="px-5 py-4 space-y-3">{[...Array(6)].map((_, i) => <Sk key={i} className="h-7 w-full rounded-lg" />)}</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {riskTop10.map((s, idx) => {
                const pct = Math.round(s.delay_risk_score * 100)
                const color = pct >= 70 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e'
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-white/4 transition-colors group">
                    <Link to={`/ops/shipments/${s.id}`}
                      className="font-mono text-xs font-semibold text-blue-600 hover:underline truncate w-28 shrink-0">
                      {s.tracking_number}
                    </Link>
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.4 + idx * 0.04, duration: 0.7, ease: 'easeOut' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color }}>{pct}%</span>
                    <Link to={`/ops/shipments/${s.id}`} className="text-gray-300 dark:text-white/20 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100">
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
        </motion.div>

        {/* Carrier performance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <SectionHead
            title="Carrier Performance"
            sub="On-time rate vs avg delay risk"
            action={<BarChart2 className="w-4 h-4 text-gray-300 dark:text-white/20" />}
          />
          {loading ? <Sk className="h-52 w-full rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={carrierChartData} layout="vertical" barCategoryGap="20%" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<ChartTooltip />} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="onTime" name="On-Time %" fill="#0f2d5e" radius={[0, 3, 3, 0]}>
                  {carrierChartData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#0f2d5e' : '#1e3a5f'} />)}
                </Bar>
                <Bar dataKey="risk" name="Risk Score" fill="#f5801e" radius={[0, 3, 3, 0]}>
                  {carrierChartData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#f5801e' : '#fb923c'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Recent events */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.60 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/6 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Live Events</h2>
                <LiveDot />
              </div>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Real-time tracking updates</p>
            </div>
            <Link to="/tracking" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="px-5 py-4 space-y-4">{[...Array(5)].map((_, i) => <Sk key={i} className="h-11 w-full rounded-lg" />)}</div>
          ) : events.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-white/30">No recent events.</p>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5 max-h-80">
              {events.slice(0, 15).map((ev, i) => {
                const dot = EVENT_DOT[ev.event_type] ?? 'bg-gray-400'
                return (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                    className="flex gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/4 transition-colors group">
                    <div className="flex flex-col items-center pt-1.5 shrink-0">
                      <div className={cn('w-2 h-2 rounded-full', dot)} />
                      {i < events.slice(0,15).length - 1 && <div className="w-px flex-1 bg-gray-100 dark:bg-white/6 mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-xs font-semibold text-gray-800 dark:text-white/80 leading-snug">{ev.event_type_display}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 truncate flex items-center gap-1 mt-0.5">
                        <Map className="w-2.5 h-2.5 shrink-0" />{ev.location}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-gray-300 dark:text-white/20">{timeAgo(ev.timestamp)}</span>
                      <Clock className="w-2.5 h-2.5 text-gray-200 dark:text-white/15 mt-0.5" />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Recent critical alerts ─────────────────────────────────────────────── */}
      {!loading && alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-red-100 dark:border-red-900/30 overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-red-50 dark:border-red-900/20 bg-red-50/50 dark:bg-red-900/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-red-700 dark:text-red-400 font-heading">Critical & High Alerts</h2>
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-xs font-bold text-red-600 dark:text-red-400">
                {alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length}
              </span>
            </div>
            <Link to="/alerts" className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-0.5">
              Review all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-red-50 dark:divide-red-900/10">
            {alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').slice(0, 4).map((alert, i) => (
              <motion.div key={alert.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-colors">
                <span className={cn('mt-1 w-2 h-2 rounded-full shrink-0', alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/80">{alert.title}</p>
                  <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">{alert.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold',
                    alert.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400')}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-300 dark:text-white/20">{timeAgo(alert.created_at)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.70 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Quick Tracking', desc: 'Search any shipment by number', icon: Package, to: '/tracking', gradient: 'from-blue-500/10 to-blue-600/10', iconColor: '#3b82f6' },
          { label: 'Live Map', desc: 'View all active shipments on map', icon: Map, to: '/live-map', gradient: 'from-emerald-500/10 to-teal-500/10', iconColor: '#22c55e' },
          { label: 'AI Predictions', desc: 'Delay risk & route intelligence', icon: Activity, to: '/predictions', gradient: 'from-orange-500/10 to-amber-500/10', iconColor: '#f5801e' },
        ].map(({ label, desc, icon: Icon, to, iconColor }) => (
          <Link key={label} to={to}
            className="group flex items-center gap-4 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100
              dark:border-white/8 px-5 py-4 hover:border-gray-300 dark:hover:border-white/15
              hover:shadow-xl hover:shadow-gray-100 dark:hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-300">
            <div className="p-2.5 rounded-xl shrink-0 group-hover:scale-110 transition-transform duration-300"
              style={{ backgroundColor: `${iconColor}15` }}>
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{label}</p>
              <p className="text-xs text-gray-400 dark:text-white/40 truncate mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </motion.div>

    </div>
  )
}
