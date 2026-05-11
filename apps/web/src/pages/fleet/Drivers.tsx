import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, AlertTriangle, RefreshCw, Search, ChevronRight,
  MapPin, Star, Truck, Package, Clock,
  Phone, Mail, Award, TrendingUp, Shield,
  Activity, Calendar,
} from 'lucide-react'
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { fleetApi } from '@/api/fleet'
import type { Driver, DriverStats } from '@/api/fleet'

// ── Utilities ──────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string; text: string }> = {
  AVAILABLE:  { label: 'Available',  dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
  ON_ROUTE:   { label: 'On Route',   dot: 'bg-blue-500',    badge: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-700 dark:text-blue-400'       },
  OFF_DUTY:   { label: 'Off Duty',   dot: 'bg-gray-400',    badge: 'bg-gray-100 dark:bg-white/8',          text: 'text-gray-600 dark:text-white/60'       },
  ON_LEAVE:   { label: 'On Leave',   dot: 'bg-amber-400',   badge: 'bg-amber-50 dark:bg-amber-900/20',    text: 'text-amber-700 dark:text-amber-400'     },
  SUSPENDED:  { label: 'Suspended',  dot: 'bg-red-400',     badge: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-700 dark:text-red-400'         },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.OFF_DUTY
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.badge, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function StarRating({ value }: { value: number }) {
  const safe = value ?? 0
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <Star key={n} className={cn('w-3 h-3', n <= Math.round(safe) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-white/15')} />
      ))}
      <span className="ml-1 text-xs font-semibold text-gray-600 dark:text-white/60">{safe.toFixed(1)}</span>
    </div>
  )
}

const FILTERS = ['ALL', 'AVAILABLE', 'ON_ROUTE', 'OFF_DUTY', 'ON_LEAVE'] as const
type FilterType = typeof FILTERS[number]

// ── Main ───────────────────────────────────────────────────────────────────────

export default function FleetDrivers() {
  const [drivers,  setDrivers]  = useState<Driver[]>([])
  const [stats,    setStats]    = useState<DriverStats | null>(null)
  const [selected, setSelected] = useState<Driver | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [filter,   setFilter]   = useState<FilterType>('ALL')
  const [search,   setSearch]   = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const [driversRes, statsRes] = await Promise.all([
        fleetApi.listDrivers({ page_size: 200 }),
        fleetApi.driverStats(),
      ])
      const dd: any = driversRes.data
      setDrivers(dd.results ?? (Array.isArray(dd) ? dd : []))
      setStats(statsRes.data)
    } catch {
      setError('Failed to load driver data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    let list = drivers
    if (filter !== 'ALL') list = list.filter(d => d.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.full_name.toLowerCase().includes(q) ||
        d.driver_id.toLowerCase().includes(q) ||
        d.phone.includes(q)
      )
    }
    return list
  }, [drivers, filter, search])

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: drivers.length }
    for (const d of drivers) counts[d.status] = (counts[d.status] ?? 0) + 1
    return counts
  }, [drivers])

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

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Fleet — Drivers</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            {stats
              ? `${stats.total} drivers · ${stats.on_route} on route · avg rating ${(stats.avg_rating ?? 0).toFixed(1)} · ${(stats.avg_on_time ?? 0).toFixed(0)}% on-time`
              : 'Loading drivers…'}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total',      value: stats?.total ?? 0,     icon: Users,       color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/15'      },
          { label: 'Available',  value: stats?.available ?? 0, icon: Activity,    color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15' },
          { label: 'On Route',   value: stats?.on_route ?? 0,  icon: Truck,       color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/15'      },
          { label: 'Off Duty',   value: stats?.off_duty ?? 0,  icon: Clock,       color: '#94a3b8', bg: 'bg-gray-100 dark:bg-white/8'         },
          { label: 'Avg Rating', value: stats?.avg_rating ?? 0, icon: Star,       color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/15', decimal: true },
          { label: 'On-Time %',  value: stats?.avg_on_time ?? 0, icon: TrendingUp, color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15', decimal: true },
        ].map(({ label, value, icon: Icon, color, bg, decimal }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', bg)}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">
              {loading ? '—' : decimal ? value.toFixed(1) : value}
            </p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Master-detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Driver list */}
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">

          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ID, phone…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn('px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors',
                    filter === f ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
                  style={filter === f ? { background: 'var(--ct-navy)' } : {}}>
                  {f === 'ALL' ? 'All' : STATUS_CFG[f].label}
                  <span className="ml-1 opacity-70">({filterCounts[f] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <Sk key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <Users className="w-8 h-8 text-gray-200 dark:text-white/15" />
              <p className="text-sm text-gray-400 dark:text-white/30">No drivers found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-[600px] overflow-y-auto">
              {filtered.map((driver, i) => (
                <motion.button key={driver.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(driver)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/4',
                    selected?.id === driver.id && 'bg-blue-50/80 dark:bg-white/6 border-l-2 border-blue-500'
                  )}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                    style={{ background: 'var(--ct-navy)' }}>
                    {driver.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white font-heading">{driver.full_name}</span>
                      <StatusBadge status={driver.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">
                      {driver.driver_id} · {driver.phone}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating value={driver.rating} />
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-3 bg-white dark:bg-[#1a2235] rounded-2xl border border-dashed border-gray-200 dark:border-white/8">
                <Users className="w-12 h-12 text-gray-200 dark:text-white/15" />
                <p className="text-sm text-gray-400 dark:text-white/30">Select a driver to view details</p>
              </motion.div>
            ) : (
              <motion.div key={selected.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">

                {/* Profile header */}
                <div className="rounded-2xl overflow-hidden border border-white/0 shadow-card"
                  style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #071428 100%)' }}>
                  <div className="px-6 py-5 flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                      style={{ background: 'rgba(249,115,22,0.25)', border: '2px solid rgba(249,115,22,0.4)' }}>
                      {selected.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-white font-heading">{selected.full_name}</h2>
                        <StatusBadge status={selected.status} />
                      </div>
                      <p className="text-white/50 text-sm mt-0.5">{selected.driver_id} · {selected.license_class}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-white/50">
                          <Phone className="w-3 h-3 text-orange-400" />{selected.phone}
                        </div>
                        {selected.email && (
                          <div className="flex items-center gap-1 text-xs text-white/50">
                            <Mail className="w-3 h-3 text-orange-400" />{selected.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <StarRating value={selected.rating} />
                      <p className="text-xs text-white/40 mt-1">{selected.years_experience}y experience</p>
                    </div>
                  </div>

                  {selected.active_route && (
                    <div className="mx-6 mb-5 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8">
                      <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                      <p className="text-xs text-white/60 truncate">{selected.active_route}</p>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Jobs',  value: selected.total_jobs.toString(),                               icon: Package,   color: '#0f2d5e' },
                    { label: 'Total KM',    value: `${(selected.total_km ?? 0).toLocaleString()} km`,           icon: Activity,  color: '#f5801e' },
                    { label: 'On-Time',     value: `${(selected.on_time_rate ?? 0).toFixed(0)}%`,                 icon: TrendingUp, color: '#22c55e' },
                    { label: 'Earnings MTD', value: `KES ${Number(selected.earnings_mtd || 0).toLocaleString()}`, icon: Award,     color: '#8b5cf6' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-3 shadow-card">
                      <Icon className="w-4 h-4 mb-1.5" style={{ color }} />
                      <p className="text-sm font-bold text-gray-900 dark:text-white font-heading">{value}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* On-time radial + license info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* On-time donut */}
                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card flex flex-col items-center">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-white/70 uppercase tracking-wide self-start mb-3">On-Time Rate</h3>
                    <div className="relative">
                      <ResponsiveContainer width={120} height={120}>
                        <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%"
                          startAngle={225} endAngle={-45}
                          data={[{ value: selected.on_time_rate, fill: selected.on_time_rate >= 90 ? '#22c55e' : selected.on_time_rate >= 75 ? '#f59e0b' : '#ef4444' }]}>
                          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f1f5f9' }} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold font-heading text-gray-900 dark:text-white">{selected.on_time_rate.toFixed(0)}%</span>
                        <span className="text-[10px] text-gray-400 dark:text-white/40">on time</span>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-xs text-gray-400 dark:text-white/30">{selected.total_jobs} total jobs</p>
                    </div>
                  </div>

                  {/* License + assignment */}
                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-white/70 uppercase tracking-wide mb-3">License & Assignment</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'License #',  value: selected.license_number || '—',      icon: Shield   },
                        { label: 'Class',      value: selected.license_class,               icon: Award    },
                        { label: 'Expiry',     value: selected.license_expiry ? new Date(selected.license_expiry).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—', icon: Calendar },
                        { label: 'Joined',     value: selected.date_joined ? new Date(selected.date_joined).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—', icon: Clock   },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-white/40">
                            <Icon className="w-3 h-3" />{label}
                          </div>
                          <span className="font-semibold text-gray-700 dark:text-white/70">{value}</span>
                        </div>
                      ))}
                    </div>
                    {selected.truck_info && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/6">
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                          <Truck className="w-4 h-4 text-blue-500 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-gray-800 dark:text-white/80">{selected.truck_info.fleet_id}</p>
                            <p className="text-[10px] text-gray-400 dark:text-white/30">{selected.truck_info.plate}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Certifications */}
                {(selected.certifications?.length ?? 0) > 0 && (
                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-white/70 uppercase tracking-wide mb-3">Certifications</h3>
                    <div className="flex flex-wrap gap-2">
                      {selected.certifications.map((cert) => (
                        <span key={cert} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">
                          <Award className="w-3 h-3" />{cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent jobs */}
                {(selected.job_history?.length ?? 0) > 0 && (
                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-white/6 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Recent Jobs</h3>
                      <span className="ml-auto text-xs text-gray-400 dark:text-white/30">{selected.job_history.length} records</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-48 overflow-y-auto">
                      {selected.job_history.slice(0, 8).map((job) => (
                        <div key={job.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">{job.route_label}</p>
                            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                              {(job.distance_km ?? 0).toLocaleString()} km · {job.completed_at ? new Date(job.completed_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                              job.on_time ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600')}>
                              {job.on_time ? 'ON TIME' : 'LATE'}
                            </span>
                            <span className="text-xs font-semibold text-gray-700 dark:text-white/70">
                              KES {Number(job.earnings_kes || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
