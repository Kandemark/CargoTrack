/**
 * @route /driver/dashboard  @auth CARRIER
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, MapPin, Clock, AlertTriangle, RefreshCw,
  ArrowUpRight, CheckCircle, Package, Activity,
  Navigation, Star, TrendingUp, Zap,
  FileText, ChevronRight, Bell, Shield,
  Target, DollarSign, BarChart2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type { ShipmentListItem, ShipmentStatus, Alert } from '@/types'
import { useAuthStore } from '@/store/authStore'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ShipmentStatus, { label: string; bg: string; text: string; dot: string; dark_bg: string; dark_text: string }> = {
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400',    dark_bg: 'dark:bg-blue-900/20',    dark_text: 'dark:text-blue-400'    },
  CUSTOMS:    { label: 'At Customs', bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400',  dark_bg: 'dark:bg-purple-900/20',  dark_text: 'dark:text-purple-400'  },
  DELAYED:    { label: 'Delayed',    bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400',     dark_bg: 'dark:bg-red-900/20',     dark_text: 'dark:text-red-400'     },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', dark_bg: 'dark:bg-emerald-900/20', dark_text: 'dark:text-emerald-400' },
  PENDING:    { label: 'Pending',    bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400',    dark_bg: 'dark:bg-white/8',        dark_text: 'dark:text-white/60'    },
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function DriverPortal() {
  const user = useAuthStore((s) => s.user)
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'alerts'>('active')

  async function load() {
    setLoading(true); setError(null)
    try {
      const [shipmentsRes, alertsRes] = await Promise.all([
        shipmentsApi.getShipments({ page_size: 100 }),
        alertsApi.getAlerts(),
      ])
      setShipments(shipmentsRes.data.results)
      setAlerts(alertsRes.data.results)
    } catch {
      setError('Unable to load data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const active    = useMemo(() => shipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'PENDING' || s.status === 'CUSTOMS'), [shipments])
  const completed = useMemo(() => shipments.filter(s => s.status === 'DELIVERED'), [shipments])
  const delayed   = useMemo(() => shipments.filter(s => s.status === 'DELAYED'), [shipments])

  const onTimeRate = useMemo(() => {
    const done = completed.length + delayed.length
    if (!done) return 100
    return Math.round((completed.length / done) * 100)
  }, [completed, delayed])

  const totalWeight = useMemo(() =>
    active.reduce((s, sh) => s + (sh.weight_kg ?? 0), 0), [active])

  const unackedAlerts = useMemo(() => alerts.filter(a => !a.acknowledged), [alerts])

  const weeklyData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const now = new Date()
    const counts = days.map((day, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      const count = shipments.filter(s => {
        const sd = new Date(s.scheduled_departure)
        return sd.toDateString() === d.toDateString()
      }).length
      return { day, deliveries: count }
    })
    return counts
  }, [shipments])

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

      {/* ── Hero header ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden border border-white/0 shadow-card"
        style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #071428 100%)' }}>
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest">Driver Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Welcome back, {user?.first_name ?? 'Driver'}
            </h1>
            <p className="text-white/50 text-sm mt-0.5">
              {active.length > 0
                ? `You have ${active.length} active assignment${active.length > 1 ? 's' : ''}.`
                : 'No active assignments. Enjoy the break.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unackedAlerts.length > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-white/60" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white">
                  {unackedAlerts.length}
                </span>
              </div>
            )}
            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-0 border-t border-white/8">
          {[
            { label: 'Active',    value: active.length,    color: '#60a5fa'   },
            { label: 'Delivered', value: completed.length, color: '#4ade80'   },
            { label: 'Delayed',   value: delayed.length,   color: '#f87171'   },
            { label: 'On-Time',   value: `${onTimeRate}%`, color: '#fb923c'   },
          ].map(({ label, value, color }, i) => (
            <div key={label} className={cn('px-5 py-3.5', i < 3 && 'border-r border-white/8')}>
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{loading ? '—' : value}</p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── KPI row ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Active Jobs',   value: active.length.toString(),      icon: Activity,   color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/15'      },
          { label: 'Total Weight',  value: `${totalWeight.toLocaleString()} kg`, icon: Package, color: '#f5801e', bg: 'bg-orange-50 dark:bg-orange-900/15' },
          { label: 'Delivered',     value: completed.length.toString(),   icon: CheckCircle, color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15' },
          { label: 'On-Time Rate',  value: `${onTimeRate}%`,              icon: Target,     color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15'  },
          { label: 'Alerts',        value: unackedAlerts.length.toString(), icon: Bell,    color: unackedAlerts.length > 0 ? '#ef4444' : '#94a3b8', bg: unackedAlerts.length > 0 ? 'bg-red-50 dark:bg-red-900/15' : 'bg-gray-100 dark:bg-white/8' },
          { label: 'Performance',   value: onTimeRate >= 90 ? 'Excellent' : onTimeRate >= 75 ? 'Good' : 'Needs Work', icon: Star, color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/15' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', bg)}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white font-heading tabular-nums leading-tight">
              {loading ? '—' : value}
            </p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Active job highlight ─────────────────────────────────────────────────── */}
      {!loading && active.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Current Assignment</h2>
            </div>
            <Link to="/driver/shipments" className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
              All assignments <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {active.slice(0, 3).map((s, i) => (
            <div key={s.id} className={cn('px-5 py-4', i < Math.min(active.length, 3) - 1 && 'border-b border-gray-50 dark:border-white/5')}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link to={`/driver/shipments/${s.id}`} className="font-mono text-sm font-bold text-blue-600 hover:underline">
                      {s.tracking_number}
                    </Link>
                    <StatusBadge status={s.status} />
                    {s.delay_risk_score > 0.5 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" /> High Risk
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-medium">{s.route.origin}</span>
                    <Navigation className="w-3 h-3 text-gray-300" />
                    <span>{s.route.destination}</span>
                    <span className="text-xs text-gray-400 dark:text-white/30">· {s.route.distance_km?.toLocaleString() ?? '—'} km</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-white/40">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> ETA {fmtDate(s.scheduled_arrival)}</div>
                    <div className="flex items-center gap-1"><Package className="w-3 h-3" /> {s.weight_kg?.toLocaleString() ?? '—'} kg</div>
                    <div className="flex items-center gap-1"><Truck className="w-3 h-3" /> {s.carrier_name}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Link to={`/driver/shipments/${s.id}/log-event`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--ct-orange)' }}>
                    <Zap className="w-3.5 h-3.5" /> Log Event
                  </Link>
                  <Link to={`/driver/shipments/${s.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    Details <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Route progress bar */}
              {s.actual_departure && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 dark:text-white/30 mb-1">
                    <span>Departed {fmtDate(s.actual_departure)}</span>
                    <span>Expected {fmtDate(s.scheduled_arrival)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-blue-500"
                      initial={{ width: '0%' }}
                      animate={{ width: s.status === 'IN_TRANSIT' ? '55%' : s.status === 'CUSTOMS' ? '85%' : '20%' }}
                      transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Main content: tabs + chart ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Shipment tabs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="xl:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">

          <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 dark:border-white/6">
            {([
              { id: 'active',    label: 'Active',    count: active.length    },
              { id: 'completed', label: 'Completed', count: completed.length },
              { id: 'alerts',    label: 'Alerts',    count: unackedAlerts.length },
            ] as const).map(({ id, label, count }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg -mb-px border-b-2 transition-colors',
                  activeTab === id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-white/60')}>
                {label}
                {count > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    activeTab === id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-white/40')}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Active tab */}
            {activeTab === 'active' && (
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {loading ? (
                  <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} className="h-16 w-full rounded-xl" />)}</div>
                ) : active.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <Truck className="w-10 h-10 text-gray-200 dark:text-white/15" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No active assignments</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-80 overflow-y-auto">
                    {active.map((s, i) => (
                      <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-white/4 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Link to={`/driver/shipments/${s.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                              {s.tracking_number}
                            </Link>
                            <StatusBadge status={s.status} />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-white/40">
                            {s.route.origin} → {s.route.destination} · {s.weight_kg?.toLocaleString() ?? '—'} kg
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs text-gray-400 dark:text-white/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{fmtDate(s.scheduled_arrival)}
                          </span>
                          <Link to={`/driver/shipments/${s.id}/log-event`}
                            className="opacity-0 group-hover:opacity-100 text-xs font-semibold text-orange-500 hover:underline transition-opacity">
                            Log →
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Completed tab */}
            {activeTab === 'completed' && (
              <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {loading ? (
                  <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} className="h-16 w-full rounded-xl" />)}</div>
                ) : completed.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <CheckCircle className="w-10 h-10 text-gray-200 dark:text-white/15" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No completed deliveries yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-80 overflow-y-auto">
                    {completed.map((s, i) => (
                      <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-white/4 transition-colors">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Link to={`/driver/shipments/${s.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                              {s.tracking_number}
                            </Link>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-white/40">
                            {s.route.origin} → {s.route.destination}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-white/30 shrink-0">
                          {s.actual_arrival ? fmtDate(s.actual_arrival) : fmtDate(s.scheduled_arrival)}
                        </span>
                      </motion.div>
                    ))}
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
                    {alerts.slice(0, 12).map((a, i) => (
                      <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-white/4">
                        <span className={cn('mt-1 w-2 h-2 rounded-full shrink-0',
                          a.severity === 'CRITICAL' ? 'bg-red-500' : a.severity === 'HIGH' ? 'bg-orange-400' : a.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-blue-400')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-white/80">{a.title}</p>
                          <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">{a.message}</p>
                        </div>
                        <span className="text-[10px] text-gray-300 dark:text-white/20 shrink-0">{timeAgo(a.created_at)}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Side panel: weekly activity + quick actions */}
        <div className="space-y-4">

          {/* Weekly delivery chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">This Week</h2>
                <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Shipment activity</p>
              </div>
              <BarChart2 className="w-4 h-4 text-gray-300 dark:text-white/20" />
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weeklyData} barCategoryGap="30%" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="deliveries" name="Shipments" fill="#0f2d5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Performance card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-3">My Performance</h2>
            <div className="space-y-2.5">
              {[
                { label: 'On-Time Rate', value: onTimeRate, max: 100, color: '#22c55e', suffix: '%' },
                { label: 'Completed',    value: completed.length, max: Math.max(shipments.length, 1), color: '#3b82f6', suffix: ` / ${shipments.length}` },
                { label: 'Delay Rate',   value: delayed.length, max: Math.max(shipments.length, 1), color: '#ef4444', suffix: ` delays` },
              ].map(({ label, value, max, color, suffix }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-white/40">{label}</span>
                    <span className="font-semibold text-gray-700 dark:text-white/70">{value}{suffix}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                      initial={{ width: 0 }} animate={{ width: `${Math.round((value / max) * 100)}%` }}
                      transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Log Tracking Event', icon: Zap,       color: '#f5801e', to: active[0] ? `/driver/shipments/${active[0].id}/log-event` : '/driver/shipments' },
                { label: 'View Shipments',     icon: Package,   color: '#0f2d5e', to: '/driver/shipments' },
                { label: 'View Documents',     icon: FileText,  color: '#22c55e', to: '/documents'        },
                { label: 'Live Map',           icon: MapPin,    color: '#8b5cf6', to: '/live-map'         },
              ].map(({ label, icon: Icon, color, to }) => (
                <Link key={label} to={to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-white/70 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">{label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-white/20 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

    </div>
  )
}
