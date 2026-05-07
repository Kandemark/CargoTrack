import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, AlertTriangle, RefreshCw, Search, ChevronRight,
  MapPin, Gauge, Calendar, Wrench, Package, Clock,
  Activity, Battery, Fuel, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fleetApi } from '@/api/fleet'
import type { Truck as TruckType, TruckStats } from '@/api/fleet'

// ── Utilities ──────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string; text: string }> = {
  ACTIVE:         { label: 'Active',         dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
  IDLE:           { label: 'Idle',           dot: 'bg-gray-400',    badge: 'bg-gray-100 dark:bg-white/8',          text: 'text-gray-600 dark:text-white/60'       },
  MAINTENANCE:    { label: 'Maintenance',    dot: 'bg-amber-400',   badge: 'bg-amber-50 dark:bg-amber-900/20',    text: 'text-amber-700 dark:text-amber-400'     },
  OFF_DUTY:       { label: 'Off Duty',       dot: 'bg-red-400',     badge: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-700 dark:text-red-400'         },
  DECOMMISSIONED: { label: 'Decommissioned', dot: 'bg-slate-400',   badge: 'bg-slate-100 dark:bg-white/5',        text: 'text-slate-600 dark:text-white/40'      },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.IDLE
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.badge, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

const FILTERS = ['ALL', 'ACTIVE', 'IDLE', 'MAINTENANCE', 'OFF_DUTY'] as const
type FilterType = typeof FILTERS[number]

// ── Main ───────────────────────────────────────────────────────────────────────

export default function FleetTrucks() {
  const [trucks,   setTrucks]   = useState<TruckType[]>([])
  const [stats,    setStats]    = useState<TruckStats | null>(null)
  const [selected, setSelected] = useState<TruckType | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [filter,   setFilter]   = useState<FilterType>('ALL')
  const [search,   setSearch]   = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const [trucksRes, statsRes] = await Promise.all([
        fleetApi.listTrucks({ page_size: 200 }),
        fleetApi.truckStats(),
      ])
      const td: any = trucksRes.data
      setTrucks(td.results ?? (Array.isArray(td) ? td : []))
      setStats(statsRes.data)
    } catch {
      setError('Failed to load fleet data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    let list = trucks
    if (filter !== 'ALL') list = list.filter(t => t.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.fleet_id.toLowerCase().includes(q) ||
        t.make.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.plate.toLowerCase().includes(q)
      )
    }
    return list
  }, [trucks, filter, search])

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: trucks.length }
    for (const t of trucks) counts[t.status] = (counts[t.status] ?? 0) + 1
    return counts
  }, [trucks])

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Fleet — Trucks</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            {stats ? `${stats.total} vehicles · ${stats.active} active · ${stats.maintenance} in maintenance` : 'Loading fleet…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/fleet/trucks/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--ct-navy)' }}
          >
            <Plus className="w-4 h-4" /> Add Truck
          </Link>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',       value: stats?.total ?? 0,       icon: Truck,         color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/15'       },
          { label: 'Active',      value: stats?.active ?? 0,      icon: Activity,      color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15'  },
          { label: 'Idle',        value: stats?.idle ?? 0,        icon: Clock,         color: '#94a3b8', bg: 'bg-gray-100 dark:bg-white/8'           },
          { label: 'Maintenance', value: stats?.maintenance ?? 0, icon: Wrench,        color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/15'      },
          { label: 'Off Duty',    value: stats?.off_duty ?? 0,    icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/15'          },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', bg)}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{loading ? '—' : value}</p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Master-detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Truck list */}
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">

          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fleet ID, make, plate…"
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
              <Truck className="w-8 h-8 text-gray-200 dark:text-white/15" />
              <p className="text-sm text-gray-400 dark:text-white/30">No trucks found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-[600px] overflow-y-auto">
              {filtered.map((truck, i) => (
                <motion.div key={truck.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(truck)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/4 cursor-pointer',
                    selected?.id === truck.id && 'bg-blue-50/80 dark:bg-white/6 border-l-2 border-blue-500'
                  )}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', STATUS_CFG[truck.status]?.badge ?? 'bg-gray-100')}>
                    <Truck className="w-4 h-4" style={{ color: truck.status === 'ACTIVE' ? '#22c55e' : truck.status === 'MAINTENANCE' ? '#f59e0b' : '#94a3b8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white font-heading">{truck.fleet_id}</span>
                      <StatusBadge status={truck.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">
                      {truck.year} {truck.make} {truck.model} · {truck.plate}
                    </p>
                    {truck.current_location && (
                      <p className="text-xs text-gray-400 dark:text-white/30 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{truck.current_location}</span>
                      </p>
                    )}
                  </div>
                  <Link to={`/fleet/trucks/${truck.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 hover:text-blue-500" />
                  </Link>
                </motion.div>
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
                <Truck className="w-12 h-12 text-gray-200 dark:text-white/15" />
                <p className="text-sm text-gray-400 dark:text-white/30">Select a truck to view details</p>
              </motion.div>
            ) : (
              <motion.div key={selected.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">

                {/* Detail header */}
                <div className="rounded-2xl overflow-hidden border border-white/0 shadow-card"
                  style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #071428 100%)' }}>
                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-5 h-5 text-orange-400" />
                          <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest">{selected.fuel_type}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white font-heading">{selected.fleet_id}</h2>
                        <p className="text-white/60 text-sm mt-0.5">{selected.year} {selected.make} {selected.model}</p>
                        <p className="text-white/40 text-xs mt-0.5 font-mono">{selected.plate}{selected.vin ? ` · ${selected.vin}` : ''}</p>
                      </div>
                      <StatusBadge status={selected.status} />
                    </div>

                    {selected.status === 'ACTIVE' && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-white/50 mb-1">
                          <span>Load</span><span className="font-semibold text-white/80">{selected.load_pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-orange-400"
                            initial={{ width: 0 }} animate={{ width: `${selected.load_pct}%` }}
                            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }} />
                        </div>
                      </div>
                    )}

                    {selected.current_location && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
                        <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                        <span>{selected.current_location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Odometer',     value: `${(selected.odometer_km ?? 0).toLocaleString()} km`, icon: Gauge,    color: '#0f2d5e' },
                    { label: 'Payload',      value: `${selected.payload_tonnes} t`,                 icon: Package,  color: '#f97316' },
                    { label: 'Last Service', value: selected.last_service_date ? new Date(selected.last_service_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—', icon: Wrench, color: '#22c55e' },
                    { label: 'Next Service', value: selected.next_service_date ? new Date(selected.next_service_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—', icon: Calendar, color: '#8b5cf6' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-3 shadow-card">
                      <Icon className="w-4 h-4 mb-1.5" style={{ color }} />
                      <p className="text-sm font-bold text-gray-900 dark:text-white font-heading">{value}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Specs + assignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-white/70 uppercase tracking-wide mb-3">Specifications</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Engine', value: selected.engine_cc ? `${(selected.engine_cc / 1000).toFixed(1)}L` : '—', icon: Activity },
                        { label: 'Fuel',   value: selected.fuel_type,                                                        icon: Fuel     },
                        { label: 'Tank',   value: selected.fuel_capacity_l ? `${selected.fuel_capacity_l}L` : '—',           icon: Battery  },
                        { label: 'Color',  value: selected.color || '—',                                                     icon: Truck    },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-white/40">
                            <Icon className="w-3 h-3" />{label}
                          </div>
                          <span className="font-semibold text-gray-700 dark:text-white/70">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-white/70 uppercase tracking-wide mb-3">Assignment</h3>
                    {selected.assigned_driver ? (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 text-sm font-bold text-blue-700 dark:text-blue-400">
                          {selected.assigned_driver_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white/80">{selected.assigned_driver_name}</p>
                          <p className="text-xs text-gray-400 dark:text-white/30">Assigned driver</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-4 gap-2">
                        <Truck className="w-6 h-6 text-gray-200 dark:text-white/15" />
                        <p className="text-xs text-gray-400 dark:text-white/30">No driver assigned</p>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/6 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 dark:text-white/30">Active Route</span>
                        <span className="font-semibold text-gray-600 dark:text-white/60">{selected.status === 'ACTIVE' ? 'On route' : '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 dark:text-white/30">Next Service KM</span>
                        <span className="font-semibold text-gray-600 dark:text-white/60">
                          {selected.next_service_km ? `${selected.next_service_km.toLocaleString()} km` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance log */}
                {(selected.maintenance_logs?.length ?? 0) > 0 && (
                  <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-white/6 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Maintenance History</h3>
                      <span className="ml-auto text-xs text-gray-400 dark:text-white/30">{selected.maintenance_logs.length} records</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-48 overflow-y-auto">
                      {selected.maintenance_logs.slice(0, 10).map((log) => (
                        <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-white/80">{log.log_type.replace('_', ' ')}</p>
                            {log.description && <p className="text-xs text-gray-400 dark:text-white/30 truncate mt-0.5">{log.description}</p>}
                            {log.performed_by && <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5">By {log.performed_by}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-gray-700 dark:text-white/70">
                              KES {Number(log.cost_kes || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-300 dark:text-white/20 mt-0.5">
                              {new Date(log.performed_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                            </p>
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
