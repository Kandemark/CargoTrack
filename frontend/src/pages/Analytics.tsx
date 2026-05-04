/**
 * Analytics.tsx — Multi-tab analytics hub.
 *
 * Tabs: Overview | Profit | Routes | Corridors | Customers | Temporal | Drivers
 * Each tab loads data independently with its own loading/error state.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Package, CheckCircle, AlertTriangle,
  DollarSign, Loader2, Download, BarChart2, Route, Building2,
  Users, Clock, Truck, FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyticsApi, type AnalyticsData, type CarrierBenchmarkData, type CustomerAnalyticsData, type TemporalData, type DriverAnalytics } from '@/api/analytics'
import DateRangePicker from '@/components/analytics/DateRangePicker'
import AnalyticsProfit from './AnalyticsProfit'
import RoutePerformanceTable from '@/components/analytics/RoutePerformanceTable'
import CorridorComparison from '@/components/analytics/CorridorComparison'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'

const fade = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }

type Tab = 'overview' | 'profit' | 'routes' | 'corridors' | 'customers' | 'temporal' | 'drivers'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview',  label: 'Overview',   icon: BarChart2 },
  { key: 'profit',    label: 'Profit',     icon: DollarSign },
  { key: 'routes',    label: 'Routes',     icon: Route },
  { key: 'corridors', label: 'Corridors',  icon: Truck },
  { key: 'customers', label: 'Customers',  icon: Building2 },
  { key: 'temporal',  label: 'Temporal',   icon: Clock },
  { key: 'drivers',   label: 'Drivers',    icon: Users },
]

const fmtKES = (v: number) => v >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(2)}M` : `KES ${(v / 1_000).toFixed(0)}K`

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    analyticsApi.get()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error || !data) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>

  const totalRevenue = data.monthly_revenue.reduce((s, m) => s + (m.revenue ?? 0), 0)
  const prevRevenue = data.monthly_revenue.slice(0, 6).reduce((s, m) => s + (m.revenue ?? 0), 0)
  const currRevenue = data.monthly_revenue.slice(6).reduce((s, m) => s + (m.revenue ?? 0), 0)
  const revenueGrowth = prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : '0'

  const kpis = [
    { label: 'Total Revenue (12m)', value: fmtKES(totalRevenue), trend: `${revenueGrowth}% vs prior 6m`, up: Number(revenueGrowth) >= 0, icon: DollarSign, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Total Shipments', value: data.total_shipments.toLocaleString(), trend: `${data.status_counts['IN_TRANSIT'] ?? 0} in transit`, up: true, icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'On-Time Rate', value: `${data.on_time_rate}%`, trend: data.on_time_rate >= 85 ? 'On target' : 'Below target', up: data.on_time_rate >= 85, icon: CheckCircle, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'Avg Delay Risk', value: `${data.avg_risk}%`, trend: data.avg_risk < 30 ? 'Low risk' : 'Elevated', up: data.avg_risk < 30, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ]

  return (
    <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} variants={fade} transition={{ delay: i * 0.08 }}
            className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
            <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center mb-3`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{k.value}</div>
            <div className="text-sm text-gray-500 dark:text-white/40">{k.label}</div>
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${k.up ? 'text-green-600' : 'text-red-500'}`}>
              {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {k.trend}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Monthly Revenue</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly_revenue}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ct-orange)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--ct-orange)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--ct-orange)" fill="url(#revArea)" strokeWidth={2} name="Revenue (KES)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Delay Risk Trend</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly_risk}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
                <Line type="monotone" dataKey="avg_risk" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Avg Risk %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Carrier performance bar chart */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Carrier Performance</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.carrier_performance} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
              <XAxis dataKey="carrier_name" tick={{ fontSize: 10, fill: 'oklch(0.55 0.015 286)' }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
              <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
              <Bar dataKey="total" fill="var(--ct-navy)" name="Total Shipments" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" fill="var(--ct-orange)" name="Delivered" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  )
}

// ── Routes Tab ──────────────────────────────────────────────────────────────

function RoutesTab() {
  const [data, setData] = useState<{ routes: import('@/api/analytics').RouteAnalytics[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<{ date_from?: string; date_to?: string }>({})

  useEffect(() => {
    setLoading(true)
    analyticsApi.routes(range)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load route analytics'))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error || !data) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-heading">Route Performance</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{data.routes.length} routes analysed</p>
        </div>
        <DateRangePicker onChange={setRange} />
      </div>
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <RoutePerformanceTable routes={data.routes} />
      </div>
    </div>
  )
}

// ── Corridors Tab ───────────────────────────────────────────────────────────

function CorridorsTab() {
  const [data, setData] = useState<{ corridors: import('@/api/analytics').CorridorAnalytics[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<{ date_from?: string; date_to?: string }>({})

  useEffect(() => {
    setLoading(true)
    analyticsApi.corridors(range)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load corridor analytics'))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error || !data) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-heading">Corridor Analytics</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">East African trade corridor comparison</p>
        </div>
        <DateRangePicker onChange={setRange} />
      </div>
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <CorridorComparison corridors={data.corridors} />
      </div>
    </div>
  )
}

// ── Customers Tab ───────────────────────────────────────────────────────────

function CustomersTab() {
  const [data, setData] = useState<CustomerAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<{ date_from?: string; date_to?: string }>({})

  useEffect(() => {
    setLoading(true)
    analyticsApi.customers(range)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load customer analytics'))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error || !data) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>

  const columns: ColumnDef<(typeof data.customers)[0]>[] = [
    { key: 'client_name', header: 'Client', sortable: true, render: (r) => (
      <div>
        <p className="text-xs font-medium text-gray-800 dark:text-white/80">{r.client_name}</p>
        {r.company && <p className="text-[10px] text-gray-400 dark:text-white/25">{r.company}</p>}
      </div>
    )},
    { key: 'total_shipments', header: 'Shipments', sortable: true, align: 'right' },
    { key: 'total_spend', header: 'Total Spend', sortable: true, align: 'right', render: (r) => <span className="tabular-nums">{fmtKES(r.total_spend)}</span> },
    { key: 'on_time_rate', header: 'On-Time %', sortable: true, align: 'right', render: (r) => (
      <span className={cn('font-semibold', r.on_time_rate >= 85 ? 'text-emerald-600' : r.on_time_rate >= 70 ? 'text-amber-500' : 'text-red-500')}>{r.on_time_rate}%</span>
    )},
    { key: 'avg_risk', header: 'Avg Risk', sortable: true, align: 'right', render: (r) => (
      <span className={cn('font-semibold', r.avg_risk < 30 ? 'text-emerald-600' : r.avg_risk < 50 ? 'text-amber-500' : 'text-red-500')}>{r.avg_risk}%</span>
    )},
    { key: 'preferred_carrier', header: 'Top Carrier', render: (r) => <span className="text-xs text-gray-500">{r.preferred_carrier ?? '—'}</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-heading">Customer Insights</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{data.customers.length} active shippers</p>
        </div>
        <DateRangePicker onChange={setRange} />
      </div>

      {/* Top 10 customers spend bar */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Top Customers by Spend</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.customers.slice(0, 10)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
              <YAxis type="category" dataKey="client_name" width={100} tick={{ fontSize: 10, fill: 'oklch(0.55 0.015 286)' }} />
              <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
              <Bar dataKey="total_spend" name="Total Spend" fill="var(--ct-navy)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full customer table */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <DataTable columns={columns} data={data.customers} searchable searchPlaceholder="Search clients…" pageSize={10} />
      </div>
    </div>
  )
}

// ── Temporal Tab ────────────────────────────────────────────────────────────

function TemporalTab() {
  const [data, setData] = useState<TemporalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<{ date_from?: string; date_to?: string }>({})

  useEffect(() => {
    setLoading(true)
    analyticsApi.temporal(range)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load temporal analytics'))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error || !data) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-heading">Temporal Patterns</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Hourly and weekly seasonality</p>
        </div>
        <DateRangePicker onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hourly risk heatmap */}
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Hour-of-Day Risk Pattern</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_hour} barSize={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'oklch(0.55 0.015 286)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }}
                  formatter={(val: number) => [`${val}`, 'Avg Risk %']}
                  labelFormatter={(h: number) => `${h}:00`} />
                <Bar dataKey="avg_risk" fill="var(--ct-navy)" radius={[2, 2, 0, 0]}>
                  {data.by_hour.map((_, i) => {
                    const colors = ['#22c55e', '#22c55e', '#22c55e', '#3b82f6', '#f59e0b', '#f59e0b', '#f97316', '#f97316',
                      '#f97316', '#f59e0b', '#f59e0b', '#f97316', '#f97316', '#f59e0b', '#f59e0b', '#f59e0b',
                      '#f97316', '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#f59e0b', '#22c55e', '#22c55e']
                    return <rect key={i} fill={colors[i]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekday pattern */}
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Day-of-Week Pattern</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_weekday} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
                <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
                <Bar dataKey="count" fill="var(--ct-orange)" name="Shipments" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly seasonality */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Monthly Volume & On-Time Rate</h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.by_month}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'oklch(0.55 0.015 286)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Volume" />
              <Line yAxisId="right" type="monotone" dataKey="on_time_rate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="On-Time %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Drivers Tab ─────────────────────────────────────────────────────────────

function DriversTab() {
  const [drivers, setDrivers] = useState<DriverAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    analyticsApi.drivers()
      .then(r => setDrivers(r.data))
      .catch(() => setError('Failed to load driver analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>

  const columns: ColumnDef<DriverAnalytics>[] = [
    { key: 'name', header: 'Driver', sortable: true, render: (d) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-ct-navy flex items-center justify-center text-white text-xs font-bold">
          {d.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-800 dark:text-white/80">{d.name}</p>
          <p className="text-[10px] text-gray-400">{d.driver_id}</p>
        </div>
      </div>
    )},
    { key: 'status', header: 'Status', sortable: true, render: (d) => (
      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold',
        d.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
        d.status === 'ON_ROUTE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
        'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/40')}>{d.status}</span>
    )},
    { key: 'rating', header: 'Rating', sortable: true, align: 'right', render: (d) => <span className="font-semibold">{d.rating.toFixed(1)}</span> },
    { key: 'on_time_rate', header: 'On-Time %', sortable: true, align: 'right', render: (d) => (
      <span className={cn('font-semibold', d.on_time_rate >= 90 ? 'text-emerald-600' : d.on_time_rate >= 75 ? 'text-amber-500' : 'text-red-500')}>{d.on_time_rate}%</span>
    )},
    { key: 'total_jobs', header: 'Jobs', sortable: true, align: 'right' },
    { key: 'total_km', header: 'Total KM', sortable: true, align: 'right', render: (d) => <span>{d.total_km.toLocaleString()}</span> },
    { key: 'earnings_mtd', header: 'Earnings MTD', sortable: true, align: 'right', render: (d) => <span>KES {d.earnings_mtd.toLocaleString()}</span> },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white font-heading">Driver Performance</h2>
        <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{drivers.length} drivers</p>
      </div>
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <DataTable columns={columns} data={drivers} searchable searchPlaceholder="Search drivers…" pageSize={10} />
      </div>
    </div>
  )
}

// ── Export helper ───────────────────────────────────────────────────────────

function exportFile(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Main Analytics Page ─────────────────────────────────────────────────────

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('overview')
  const [exporting, setExporting] = useState(false)

  async function handleExport(dataset: string) {
    setExporting(true)
    try {
      const res = await analyticsApi.exportCsv(dataset)
      exportFile(res.data as unknown as Blob, `cargotrack-${dataset}-export.csv`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Platform-wide business intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-600 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a2235] shadow-elevated py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              {[
                { key: 'shipments', label: 'Shipments CSV' },
                { key: 'carriers', label: 'Carriers CSV' },
                { key: 'financial', label: 'Financial CSV' },
                { key: 'drivers', label: 'Drivers CSV' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => handleExport(key)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2">
                  <FileDown className="w-3 h-3" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide border-b border-gray-200 dark:border-white/8">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-[1px]',
              tab === key
                ? 'text-ct-navy dark:text-white border-ct-orange bg-white dark:bg-[#1a2235]'
                : 'text-gray-500 dark:text-white/35 border-transparent hover:text-gray-700 dark:hover:text-white/60',
            )}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab />}
      {tab === 'profit' && <AnalyticsProfit />}
      {tab === 'routes' && <RoutesTab />}
      {tab === 'corridors' && <CorridorsTab />}
      {tab === 'customers' && <CustomersTab />}
      {tab === 'temporal' && <TemporalTab />}
      {tab === 'drivers' && <DriversTab />}
    </div>
  )
}
