/**
 * DispatcherPortal.tsx — Command center for CargoTrack dispatchers.
 *
 * Responsibilities:
 *  - Assign available drivers to pending shipments (dispatch queue)
 *  - Monitor active fleet position vs planned routes
 *  - Surface high-risk and delayed shipments for immediate action
 *  - View driver and truck availability boards
 *
 * Data sources:
 *  - GET /api/v1/shipments/?status=PENDING  — dispatch queue
 *  - GET /api/v1/fleet/drivers/             — driver roster
 *  - GET /api/v1/fleet/trucks/              — truck inventory
 *  - GET /api/v1/fleet/stats/               — utilisation summary
 */
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, UserCheck, Package, AlertTriangle, MapPin, Clock,
  ChevronRight, RefreshCw, CheckCircle2, Radio, Route,
  ClipboardList, TrendingUp, Zap, Eye,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { fleetApi } from '@/api/fleet'
import type { Truck as TruckType, Driver, FleetStats } from '@/api/fleet'
import type { ShipmentListItem } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function riskColor(score: number): string {
  if (score >= 0.7) return '#ef4444'
  if (score >= 0.4) return '#f59e0b'
  return '#22c55e'
}

function RiskPill({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
      style={{ background: `${riskColor(score)}20`, color: riskColor(score) }}>
      {pct}%
    </span>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-white dark:bg-[#1a2235] rounded-xl p-4 border border-gray-100 dark:border-white/6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

type DriverStatus = 'AVAILABLE' | 'ON_ROUTE' | 'OFF_DUTY' | 'ON_LEAVE' | 'SUSPENDED'

const DRIVER_STATUS_CFG: Record<DriverStatus, { label: string; color: string; dot: string }> = {
  AVAILABLE:  { label: 'Available',  color: '#22c55e', dot: 'bg-emerald-500' },
  ON_ROUTE:   { label: 'On Route',   color: '#3b82f6', dot: 'bg-blue-500'    },
  OFF_DUTY:   { label: 'Off Duty',   color: '#94a3b8', dot: 'bg-slate-400'   },
  ON_LEAVE:   { label: 'On Leave',   color: '#f59e0b', dot: 'bg-amber-500'   },
  SUSPENDED:  { label: 'Suspended',  color: '#ef4444', dot: 'bg-red-500'     },
}

type TruckStatus = 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'OFF_DUTY' | 'DECOMMISSIONED'

const TRUCK_STATUS_CFG: Record<TruckStatus, { color: string; label: string }> = {
  ACTIVE:         { color: '#22c55e', label: 'Active'        },
  IDLE:           { color: '#94a3b8', label: 'Idle'          },
  MAINTENANCE:    { color: '#f59e0b', label: 'Maintenance'   },
  OFF_DUTY:       { color: '#ef4444', label: 'Off Duty'      },
  DECOMMISSIONED: { color: '#6b7280', label: 'Decommissioned'},
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DispatcherPortal() {
  const [queue,    setQueue]   = useState<ShipmentListItem[]>([])
  const [delayed,  setDelayed] = useState<ShipmentListItem[]>([])
  const [drivers,  setDrivers] = useState<Driver[]>([])
  const [trucks,   setTrucks]  = useState<TruckType[]>([])
  const [stats,    setStats]   = useState<FleetStats | null>(null)
  const [loading,  setLoading] = useState(true)
  const loc = useLocation()
  function tabFromPath(): 'queue' | 'drivers' | 'trucks' {
    if (loc.pathname.includes('/dispatch/queue')) return 'queue'
    return 'drivers'
  }
  const [activeTab, setTab] = useState<'queue' | 'drivers' | 'trucks'>(tabFromPath)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, dRes, drvRes, tRes, stRes] = await Promise.all([
        shipmentsApi.getShipments({ status: 'PENDING',    page_size: 50 }),
        shipmentsApi.getShipments({ status: 'DELAYED',    page_size: 20 }),
        fleetApi.listDrivers({ page_size: 100 }),
        fleetApi.listTrucks({ page_size: 100 }),
        fleetApi.fleetStats(),
      ])
      setQueue(qRes.data.results   ?? [])
      setDelayed(dRes.data.results ?? [])
      setDrivers(drvRes.data.results ?? [])
      setTrucks(tRes.data.results   ?? [])
      setStats(stRes.data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setTab(tabFromPath()) }, [loc.pathname])

  const availableDrivers = drivers.filter((d) => d.status === 'AVAILABLE')
  const availableTrucks  = trucks.filter((t)  => t.status === 'IDLE')
  const onRouteDrivers   = drivers.filter((d) => d.status === 'ON_ROUTE')
  const activeShipments  = drivers.filter((d) => d.status === 'ON_ROUTE').length

  return (
    <div className="space-y-6">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a1929 0%, #0f2d5e 60%, #1a4080 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-ct-orange" />
              <span className="text-white/50 text-sm font-medium">Dispatch Operations</span>
            </div>
            <h1 className="text-2xl font-bold font-heading tracking-tight mb-1">Dispatch Hub</h1>
            <p className="text-white/50 text-sm">
              {availableDrivers.length} drivers available · {availableTrucks.length} trucks idle · {queue.length} jobs queued
            </p>
          </div>
          <button onClick={() => void load()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Active Routes',  value: onRouteDrivers.length, color: '#3b82f6' },
            { label: 'Queued Jobs',    value: queue.length,           color: '#f97316' },
            { label: 'Delayed',        value: delayed.length,         color: '#ef4444' },
            { label: 'Utilisation',    value: `${stats?.fleet_utilisation ?? 0}%`, color: '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-white/8 px-3 py-2.5 text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={UserCheck}    label="Available Drivers" value={availableDrivers.length} sub={`${drivers.length} total`}       color="#22c55e" />
        <StatCard icon={Truck}        label="Idle Trucks"        value={availableTrucks.length}  sub={`${trucks.length} total`}        color="#3b82f6" />
        <StatCard icon={ClipboardList}label="Dispatch Queue"     value={queue.length}             sub="Awaiting assignment"            color="#f97316" />
        <StatCard icon={AlertTriangle}label="Delayed Shipments"  value={delayed.length}           sub="Needs immediate action"         color="#ef4444" />
      </div>

      {/* ── Delayed alerts banner ────────────────────────────────────────── */}
      {delayed.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{delayed.length} delayed shipment{delayed.length !== 1 ? 's' : ''} require attention</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {delayed.slice(0, 5).map((s) => (
                <Link key={s.id} to={`/ops/shipments/${s.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-mono hover:bg-red-200 transition-colors">
                  {s.tracking_number}
                </Link>
              ))}
              {delayed.length > 5 && <span className="text-xs text-red-500">+{delayed.length - 5} more</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Main tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100 dark:border-white/6 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 dark:border-white/8">
          {[
            { key: 'queue',   label: 'Dispatch Queue',    icon: ClipboardList, count: queue.length  },
            { key: 'drivers', label: 'Driver Board',      icon: UserCheck,     count: availableDrivers.length },
            { key: 'trucks',  label: 'Truck Board',       icon: Truck,         count: availableTrucks.length  },
          ].map(({ key, label, icon: Icon, count }) => (
            <button key={key}
              onClick={() => setTab(key as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors relative',
                activeTab === key
                  ? 'text-ct-navy dark:text-white border-b-2 border-ct-orange -mb-px'
                  : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  activeTab === key ? 'bg-ct-orange text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* ── Dispatch Queue ──────────────────────────────────────── */}
            {activeTab === 'queue' && (
              <div>
                {queue.length === 0 ? (
                  <div className="py-16 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500 dark:text-white/40">All shipments dispatched</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/6">
                        {['Tracking #', 'Route', 'Weight', 'Scheduled Dep.', 'Risk', 'Action'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((s, i) => (
                        <motion.tr key={s.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-gray-50 dark:border-white/4 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-gray-800 dark:text-white">{s.tracking_number}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
                              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                              {s.route.origin} → {s.route.destination}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/40 tabular-nums">
                            {Number(s.weight_kg).toLocaleString()} kg
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/40">
                            {s.scheduled_departure ? fmtDate(s.scheduled_departure) : '—'}
                          </td>
                          <td className="px-4 py-3"><RiskPill score={s.delay_risk_score} /></td>
                          <td className="px-4 py-3">
                            <Link to={`/ops/shipments/${s.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
                              style={{ background: 'var(--ct-navy)' }}>
                              <Zap className="w-3 h-3" /> Dispatch
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Driver Board ─────────────────────────────────────── */}
            {activeTab === 'drivers' && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {drivers.length === 0 && (
                  <p className="col-span-3 py-10 text-center text-sm text-gray-400 dark:text-white/30">No driver data</p>
                )}
                {drivers.map((d) => {
                  const cfg = DRIVER_STATUS_CFG[d.status as DriverStatus] ?? DRIVER_STATUS_CFG.OFF_DUTY
                  return (
                    <div key={d.id} className="rounded-xl border border-gray-100 dark:border-white/6 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-ct-navy flex items-center justify-center text-xs font-bold text-white">
                            {d.first_name.charAt(0)}{d.last_name.charAt(0)}
                          </div>
                          <span className={cn('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1a2235]', cfg.dot)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{d.first_name} {d.last_name}</p>
                          <p className="text-xs text-gray-400 dark:text-white/30 truncate">{d.driver_id}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400 dark:text-white/25">Rating</p>
                          <p className="font-semibold text-gray-700 dark:text-white/80">{d.rating} ★</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-white/25">On-Time</p>
                          <p className="font-semibold text-gray-700 dark:text-white/80">{Math.round(Number(d.on_time_rate) * 100)}%</p>
                        </div>
                      </div>
                      {d.status === 'AVAILABLE' && (
                        <button className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
                          style={{ background: 'var(--ct-orange)' }}>
                          Assign to Job
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Truck Board ──────────────────────────────────────── */}
            {activeTab === 'trucks' && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {trucks.length === 0 && (
                  <p className="col-span-3 py-10 text-center text-sm text-gray-400 dark:text-white/30">No truck data</p>
                )}
                {trucks.map((t) => {
                  const cfg = TRUCK_STATUS_CFG[t.status as TruckStatus] ?? TRUCK_STATUS_CFG.OFF_DUTY
                  return (
                    <div key={t.id} className="rounded-xl border border-gray-100 dark:border-white/6 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{t.fleet_id}</p>
                          <p className="text-xs text-gray-400 dark:text-white/30">{t.year} {t.make} {t.model}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div>
                          <p className="text-gray-400 dark:text-white/25">Payload</p>
                          <p className="font-semibold text-gray-700 dark:text-white/80">{t.payload_tonnes}t</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-white/25">Odometer</p>
                          <p className="font-semibold text-gray-700 dark:text-white/80">{Number(t.odometer_km).toLocaleString()} km</p>
                        </div>
                      </div>
                      {/* Load bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/25 mb-1">
                          <span>Load</span>
                          <span>{t.load_pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${t.load_pct}%`, background: t.load_pct > 80 ? '#ef4444' : t.load_pct > 50 ? '#f59e0b' : '#22c55e' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
