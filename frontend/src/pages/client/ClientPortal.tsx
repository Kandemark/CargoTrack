/**
 * @route /portal/dashboard  @auth CLIENT
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Clock, AlertTriangle, CheckCircle, RefreshCw,
  ArrowUpRight, MapPin, Bell, CreditCard, FileText,
  Search, TrendingUp, Truck, Star, Shield,
  BarChart2, ChevronRight, Download, Phone,
  Globe, Activity, DollarSign, Target,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import { paymentsApi } from '@/api/payments'
import type { ShipmentListItem, ShipmentStatus, Alert, Invoice } from '@/types'
import { useAuthStore } from '@/store/authStore'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ShipmentStatus, { label: string; bg: string; text: string; dot: string; dark_bg: string; dark_text: string }> = {
  IN_TRANSIT: { label: 'In Transit',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400',    dark_bg: 'dark:bg-blue-900/20',    dark_text: 'dark:text-blue-400'    },
  CUSTOMS:    { label: 'At Customs',  bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400',  dark_bg: 'dark:bg-purple-900/20',  dark_text: 'dark:text-purple-400'  },
  DELAYED:    { label: 'Delayed',     bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400',     dark_bg: 'dark:bg-red-900/20',     dark_text: 'dark:text-red-400'     },
  DELIVERED:  { label: 'Delivered',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', dark_bg: 'dark:bg-emerald-900/20', dark_text: 'dark:text-emerald-400' },
  PENDING:    { label: 'Pending',     bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400',    dark_bg: 'dark:bg-white/8',        dark_text: 'dark:text-white/60'    },
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', c.bg, c.text, c.dark_bg, c.dark_text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtKES(v: number) {
  return v >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(1)}M` : `KES ${(v / 1_000).toFixed(0)}K`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Tracking search modal ──────────────────────────────────────────────────────

function TrackModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.97, y: -12 }} animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated w-full max-w-md border border-gray-200 dark:border-white/10 p-4"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white font-heading mb-3">Track Shipment</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Enter tracking number…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <Link to={q ? `/track/${q}` : '/track'}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: 'var(--ct-navy)' }}
            onClick={onClose}>
            Track
          </Link>
        </div>
        <p className="text-xs text-gray-400 dark:text-white/30 mt-2">Enter the full tracking number from your shipment confirmation</p>
      </motion.div>
    </motion.div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const user = useAuthStore((s) => s.user)
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [invoices,  setInvoices]  = useState<Invoice[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showTrack, setShowTrack] = useState(false)
  const [activeTab, setActiveTab] = useState<'shipments' | 'invoices' | 'alerts'>('shipments')

  const fetchingRef = useRef(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [shipmentsRes, alertsRes, invoicesRes] = await Promise.all([
        shipmentsApi.getShipments({ page_size: 100 }),
        alertsApi.getAlerts(),
        paymentsApi.listInvoices({ page_size: 100 }),
      ])
      setShipments(shipmentsRes.data.results)
      setAlerts(alertsRes.data.results)
      setInvoices(invoicesRes.data.results)
    } catch {
      setError('Unable to load your data. Please try again.')
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

  const counts = useMemo(() => ({
    total:      shipments.length,
    inTransit:  shipments.filter(s => s.status === 'IN_TRANSIT').length,
    delayed:    shipments.filter(s => s.status === 'DELAYED').length,
    delivered:  shipments.filter(s => s.status === 'DELIVERED').length,
    pending:    shipments.filter(s => s.status === 'PENDING').length,
    customs:    shipments.filter(s => s.status === 'CUSTOMS').length,
  }), [shipments])

  const onTimeRate = useMemo(() => {
    if (!counts.delivered) return 100
    return Math.round((counts.delivered / Math.max(counts.delivered + counts.delayed, 1)) * 100)
  }, [counts])

  const statusPie = useMemo(() => [
    { name: 'In Transit', value: counts.inTransit, fill: '#3b82f6' },
    { name: 'Delivered',  value: counts.delivered,  fill: '#22c55e' },
    { name: 'Delayed',    value: counts.delayed,    fill: '#ef4444' },
    { name: 'Pending',    value: counts.pending,    fill: '#f59e0b' },
    { name: 'Customs',    value: counts.customs,    fill: '#8b5cf6' },
  ].filter(d => d.value > 0), [counts])

  const invoiceStats = useMemo(() => ({
    totalPaid:    invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount_kes), 0),
    totalPending: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.amount_kes), 0),
    count:        invoices.length,
  }), [invoices])

  const recentShipments = useMemo(() =>
    [...shipments].sort((a, b) => new Date(b.scheduled_departure).getTime() - new Date(a.scheduled_departure).getTime()).slice(0, 10),
    [shipments])

  const unacknowledged = useMemo(() => alerts.filter(a => !a.acknowledged), [alerts])
  const critical       = useMemo(() => alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH'), [alerts])

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

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden border border-white/0"
        style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #071428 100%)' }}>
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest">Client Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Welcome back, {user?.first_name ?? 'Client'}
            </h1>
            {user?.company && (
              <p className="text-white/50 text-sm mt-0.5 flex items-center gap-1">
                <Shield className="w-3 h-3 text-orange-400 shrink-0" />
                {user.company}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowTrack(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors border border-white/15">
              <Search className="w-3.5 h-3.5" /> Track
            </button>
            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Quick stats row inside hero */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-white/8">
          {[
            { label: 'Total Shipments', value: counts.total,     color: '#fff'      },
            { label: 'In Transit',      value: counts.inTransit, color: '#60a5fa'   },
            { label: 'Delivered',       value: counts.delivered, color: '#4ade80'   },
            { label: 'Delayed',         value: counts.delayed,   color: '#f87171'   },
          ].map(({ label, value, color }, i) => (
            <div key={label} className={cn('px-5 py-3.5', i < 3 && 'border-r border-white/8')}>
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{loading ? '—' : value}</p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── KPI cards ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'On-Time Rate',     value: `${onTimeRate}%`,                  icon: Target,    color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15', sub: 'Delivery performance'  },
          { label: 'Pending',          value: counts.pending.toString(),          icon: Clock,     color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/15',   sub: 'Awaiting dispatch'     },
          { label: 'At Customs',       value: counts.customs.toString(),          icon: Shield,    color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/15', sub: 'Clearance in progress'  },
          { label: 'Invoiced',         value: fmtKES(invoiceStats.totalPaid),     icon: DollarSign, color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/15',   sub: 'Total paid invoices'   },
          { label: 'Outstanding',      value: fmtKES(invoiceStats.totalPending),  icon: CreditCard, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/15', sub: 'Pending payment'      },
          { label: 'Alerts',           value: unacknowledged.length.toString(),   icon: Bell,      color: unacknowledged.length > 0 ? '#ef4444' : '#94a3b8', bg: unacknowledged.length > 0 ? 'bg-red-50 dark:bg-red-900/15' : 'bg-gray-100 dark:bg-white/8', sub: 'Unacknowledged' },
        ].map(({ label, value, icon: Icon, color, bg, sub }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2.5', bg)}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{loading ? '—' : value}</p>
            <p className="text-xs font-medium text-gray-600 dark:text-white/60 mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/25 mt-1.5 border-t border-gray-100 dark:border-white/6 pt-1.5">{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Critical alerts banner ─────────────────────────────────────────────── */}
      {!loading && critical.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-900/30 rounded-2xl px-5 py-3.5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {critical.length} critical alert{critical.length > 1 ? 's' : ''} require your attention
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-0.5 truncate">
              {critical[0].title}
            </p>
          </div>
          <Link to="/shared/alerts" className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
            Review <ArrowUpRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* ── Middle section: chart + delivery perf ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Status donut */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Shipment Status</h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Current distribution</p>
            </div>
            <BarChart2 className="w-4 h-4 text-gray-300 dark:text-white/20" />
          </div>
          {loading ? <Sk className="h-40 w-full rounded-xl" /> : (
            statusPie.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <Package className="w-8 h-8 text-gray-200 dark:text-white/15" />
                <p className="text-xs text-gray-400 dark:text-white/30">No shipments yet</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={statusPie} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                      {statusPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5">
                  {statusPie.map((s) => (
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
            )
          )}
        </motion.div>

        {/* Delivery performance metrics */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="xl:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Delivery Performance</h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Your logistics health metrics</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{onTimeRate}% on-time</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: 'Shipments This Month', value: shipments.filter(s => new Date(s.scheduled_departure).getMonth() === new Date().getMonth()).length.toString(), sub: 'Dispatched', color: '#0f2d5e' },
              { label: 'Avg Transit Time',     value: '—',  sub: 'Days (no data yet)', color: '#f97316' },
              { label: 'On-Time Delivery',     value: `${onTimeRate}%`, sub: 'vs last month', color: '#22c55e' },
              { label: 'Total Weight',         value: `${shipments.reduce((s, sh) => s + (sh.weight_kg ?? 0), 0).toLocaleString()} kg`, sub: 'All shipments', color: '#8b5cf6' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="rounded-xl p-3 bg-gray-50 dark:bg-white/4 border border-gray-100 dark:border-white/6">
                <p className="text-lg font-bold font-heading" style={{ color }}>{loading ? '—' : value}</p>
                <p className="text-xs font-medium text-gray-600 dark:text-white/60 mt-0.5">{label}</p>
                <p className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          {/* Mini progress bars */}
          <div className="space-y-2.5">
            {[
              { label: 'Delivered', count: counts.delivered, total: counts.total, color: '#22c55e' },
              { label: 'In Transit', count: counts.inTransit, total: counts.total, color: '#3b82f6' },
              { label: 'Delayed', count: counts.delayed, total: counts.total, color: '#ef4444' },
            ].map(({ label, count, total, color }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-gray-500 dark:text-white/40 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }} />
                  </div>
                  <span className="w-8 text-right font-semibold text-gray-700 dark:text-white/70">{pct}%</span>
                  <span className="w-6 text-right text-gray-400 dark:text-white/30">{count}</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Tab panel: shipments / invoices / alerts ───────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 dark:border-white/6">
          {([
            { id: 'shipments', label: 'Shipments', icon: Package, count: recentShipments.length },
            { id: 'invoices',  label: 'Invoices',  icon: CreditCard, count: invoices.length   },
            { id: 'alerts',    label: 'Alerts',    icon: Bell, count: unacknowledged.length    },
          ] as const).map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg -mb-px border-b-2 transition-colors',
                activeTab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-white/60')}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  activeTab === id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-white/40')}>
                  {count}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto pb-1">
            {activeTab === 'shipments' && (
              <Link to="/portal/shipments" className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Shipments tab */}
          {activeTab === 'shipments' && (
            <motion.div key="shipments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Sk key={i} className="h-14 w-full rounded-xl" />)}</div>
              ) : recentShipments.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3">
                  <Package className="w-10 h-10 text-gray-200 dark:text-white/15" />
                  <p className="text-sm text-gray-400 dark:text-white/30">No shipments found.</p>
                  <Link to="/track" className="text-xs text-blue-600 hover:underline">Track a shipment →</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/6 bg-gray-50/50 dark:bg-white/2">
                        <th className="px-5 py-2.5 text-left font-medium">Tracking</th>
                        <th className="px-5 py-2.5 text-left font-medium">Route</th>
                        <th className="px-5 py-2.5 text-left font-medium">Status</th>
                        <th className="px-5 py-2.5 text-left font-medium">ETA</th>
                        <th className="px-5 py-2.5 text-left font-medium">Weight</th>
                        <th className="px-5 py-2.5 text-center font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {recentShipments.map((s, i) => (
                        <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                          className="hover:bg-gray-50/70 dark:hover:bg-white/4 transition-colors group">
                          <td className="px-5 py-3">
                            <Link to={`/portal/shipments/${s.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                              {s.tracking_number}
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40">
                              <span className="font-medium text-gray-700 dark:text-white/70">{s.route.origin}</span>
                              <span className="text-gray-300 dark:text-white/20">→</span>
                              <span>{s.route.destination}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-5 py-3 text-xs text-gray-500 dark:text-white/40">{fmtDate(s.scheduled_arrival)}</td>
                          <td className="px-5 py-3 text-xs text-gray-500 dark:text-white/40">{s.weight_kg?.toLocaleString() ?? '—'} kg</td>
                          <td className="px-5 py-3 text-center">
                            <Link to={`/portal/shipments/${s.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
                              Details <ChevronRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* Invoices tab */}
          {activeTab === 'invoices' && (
            <motion.div key="invoices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} className="h-12 w-full rounded-xl" />)}</div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3">
                  <CreditCard className="w-10 h-10 text-gray-200 dark:text-white/15" />
                  <p className="text-sm text-gray-400 dark:text-white/30">No invoices yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/6 bg-gray-50/50 dark:bg-white/2">
                        <th className="px-5 py-2.5 text-left font-medium">Invoice</th>
                        <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                        <th className="px-5 py-2.5 text-left font-medium">Status</th>
                        <th className="px-5 py-2.5 text-left font-medium">Date</th>
                        <th className="px-5 py-2.5 text-center font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {invoices.slice(0, 10).map((inv, i) => (
                        <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="hover:bg-gray-50/70 dark:hover:bg-white/4 transition-colors group">
                          <td className="px-5 py-3">
                            <Link to={`/payments/${inv.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{Number(inv.amount_kes).toLocaleString()}</span>
                            <span className="text-xs text-gray-400 ml-1">{inv.currency}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                              inv.status === 'PAID'     ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                              inv.status === 'PENDING'  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' :
                              inv.status === 'FAILED'   ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                                                          'bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/60'
                            )}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500 dark:text-white/40">{fmtDate(inv.created_at)}</td>
                          <td className="px-5 py-3 text-center">
                            <Link to={`/payments/${inv.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Download className="w-3 h-3" /> View
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {invoices.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-white/6 flex justify-between text-xs text-gray-400 dark:text-white/30 bg-gray-50/30">
                  <span>{invoices.length} invoices</span>
                  <span>Paid: <strong className="text-gray-700 dark:text-white/70">{fmtKES(invoiceStats.totalPaid)}</strong> · Outstanding: <strong className="text-amber-600">{fmtKES(invoiceStats.totalPending)}</strong></span>
                </div>
              )}
            </motion.div>
          )}

          {/* Alerts tab */}
          {activeTab === 'alerts' && (
            <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} className="h-12 w-full rounded-xl" />)}</div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3">
                  <CheckCircle className="w-10 h-10 text-emerald-300" />
                  <p className="text-sm text-gray-400 dark:text-white/30">No alerts. All clear!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-80 overflow-y-auto">
                  {alerts.slice(0, 15).map((a, i) => (
                    <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-white/4 transition-colors">
                      <span className={cn('mt-1 w-2 h-2 rounded-full shrink-0',
                        a.severity === 'CRITICAL' ? 'bg-red-500' :
                        a.severity === 'HIGH'     ? 'bg-orange-400' :
                        a.severity === 'MEDIUM'   ? 'bg-amber-400' : 'bg-blue-400')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white/80">{a.title}</p>
                        <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">{a.message}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                          a.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                          a.severity === 'HIGH'     ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' :
                          a.severity === 'MEDIUM'   ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' :
                                                      'bg-blue-100 dark:bg-blue-900/20 text-blue-600')}>
                          {a.severity}
                        </span>
                        <p className="text-[10px] text-gray-300 dark:text-white/20 mt-1">{timeAgo(a.created_at)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Quick actions ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Track a Shipment', desc: 'Real-time GPS tracking',    icon: MapPin,    color: 'var(--ct-navy)',   action: () => setShowTrack(true) },
          { label: 'View Documents',   desc: 'BOL, invoices & customs',   icon: FileText,  color: '#22c55e',          to: '/documents'                 },
          { label: 'Pay Invoice',      desc: 'M-Pesa, card & more',       icon: CreditCard, color: 'var(--ct-orange)', to: '/payments'                 },
          { label: 'Contact Support',  desc: 'Get help from our team',    icon: Phone,     color: '#8b5cf6',          to: '/settings'                  },
        ].map(({ label, desc, icon: Icon, color, action, to }) => {
          const cls = 'group flex items-center gap-3 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 px-4 py-3.5 hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer'
          const inner = (
            <>
              <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{label}</p>
                <p className="text-xs text-gray-400 dark:text-white/40 truncate">{desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:translate-x-0.5 transition-transform" />
            </>
          )
          if (action) return <button key={label} onClick={action} className={cls}>{inner}</button>
          return <Link key={label} to={to!} className={cls}>{inner}</Link>
        })}
      </motion.div>

      {/* Track modal */}
      <AnimatePresence>
        {showTrack && <TrackModal onClose={() => setShowTrack(false)} />}
      </AnimatePresence>
    </div>
  )
}
