/**
 * WarehousePortal.tsx — Operations dashboard for warehouse managers.
 *
 * Responsibilities:
 *  - Inbound manifest: shipments arriving for storage
 *  - Outbound queue: shipments ready to depart from warehouse
 *  - Inventory overview: docks, bays, and occupancy
 *  - Loading dock schedule
 *  - Discrepancy reporting
 *
 * Data sources:
 *  - GET /api/v1/shipments/?status=PENDING     — inbound pipeline
 *  - GET /api/v1/shipments/?status=IN_TRANSIT  — outbound tracking
 *  - GET /api/v1/alerts/                       — warehouse alerts
 */
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Warehouse, Package, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Truck, RefreshCw, ChevronRight, ArrowDownToLine,
  ArrowUpFromLine, BarChart3, Grid3x3,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import type { ShipmentListItem } from '@/types'

// ── Warehouse dock data (demo) ─────────────────────────────────────────────────

/**
 * Demo dock configuration. In production this would come from a Warehouse
 * management API endpoint. Each dock has a status and optionally an assigned shipment.
 */
const DOCK_CONFIG = [
  { id: 'D-01', type: 'Inbound',  capacity: 3, occupied: 2 },
  { id: 'D-02', type: 'Inbound',  capacity: 3, occupied: 1 },
  { id: 'D-03', type: 'Outbound', capacity: 2, occupied: 2 },
  { id: 'D-04', type: 'Outbound', capacity: 2, occupied: 0 },
  { id: 'D-05', type: 'Cross',    capacity: 4, occupied: 3 },
  { id: 'D-06', type: 'Cross',    capacity: 4, occupied: 1 },
]

const BAY_ZONES = [
  { zone: 'A', label: 'Dry Goods',       bays: 24, occupied: 18, color: '#3b82f6' },
  { zone: 'B', label: 'Cold Storage',    bays: 8,  occupied: 5,  color: '#06b6d4' },
  { zone: 'C', label: 'Hazmat',          bays: 4,  occupied: 1,  color: '#ef4444' },
  { zone: 'D', label: 'Oversized',       bays: 6,  occupied: 3,  color: '#f59e0b' },
  { zone: 'E', label: 'High Value',      bays: 10, occupied: 7,  color: '#8b5cf6' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function OccupancyBar({ occupied, total, color }: { occupied: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/30 mb-1">
        <span>{occupied}/{total} bays</span>
        <span className="font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

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

// ── Main component ────────────────────────────────────────────────────────────

export default function WarehousePortal() {
  const [inbound,  setInbound]  = useState<ShipmentListItem[]>([])
  const [outbound, setOutbound] = useState<ShipmentListItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const loc = useLocation()
  function tabFromPath(): 'inbound' | 'outbound' | 'inventory' | 'docks' {
    const p = loc.pathname
    if (p.includes('/warehouse/inventory')) return 'inventory'
    if (p.includes('/warehouse/outbound')) return 'outbound'
    if (p.includes('/warehouse/inbound')) return 'inbound'
    return 'inbound'
  }
  const [activeTab, setTab] = useState<'inbound' | 'outbound' | 'inventory' | 'docks'>(tabFromPath)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, oRes] = await Promise.all([
        shipmentsApi.getShipments({ status: 'PENDING',    page_size: 30 }),
        shipmentsApi.getShipments({ status: 'IN_TRANSIT', page_size: 30 }),
      ])
      setInbound(iRes.data.results  ?? [])
      setOutbound(oRes.data.results ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setTab(tabFromPath()) }, [loc.pathname])

  const totalBays     = BAY_ZONES.reduce((acc, z) => acc + z.bays, 0)
  const occupiedBays  = BAY_ZONES.reduce((acc, z) => acc + z.occupied, 0)
  const occupancyPct  = Math.round((occupiedBays / totalBays) * 100)
  const availableDocks = DOCK_CONFIG.filter((d) => d.occupied < d.capacity).length

  return (
    <div className="space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Warehouse className="w-4 h-4 text-emerald-400" />
              <span className="text-white/50 text-sm font-medium">Warehouse Operations</span>
            </div>
            <h1 className="text-2xl font-bold font-heading tracking-tight mb-1">Warehouse Hub</h1>
            <p className="text-white/50 text-sm">
              {occupancyPct}% occupancy · {availableDocks} docks available · {inbound.length} inbound
            </p>
          </div>
          <button onClick={() => void load()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Occupancy',    value: `${occupancyPct}%`,       color: occupancyPct > 80 ? '#ef4444' : '#22c55e' },
            { label: 'Inbound',      value: inbound.length,           color: '#3b82f6' },
            { label: 'Outbound',     value: outbound.length,          color: '#f59e0b' },
            { label: 'Avail. Docks', value: availableDocks,           color: '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-white/8 px-3 py-2.5 text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Warehouse}        label="Occupancy"       value={`${occupancyPct}%`}     sub={`${occupiedBays}/${totalBays} bays`} color="#16a34a" />
        <StatCard icon={ArrowDownToLine}  label="Inbound Today"   value={inbound.length}          sub="Awaiting receipt"                    color="#3b82f6" />
        <StatCard icon={ArrowUpFromLine}  label="Outbound Today"  value={outbound.length}         sub="Ready to dispatch"                   color="#f59e0b" />
        <StatCard icon={Grid3x3}          label="Available Docks" value={availableDocks}          sub={`of ${DOCK_CONFIG.length} total`}    color="#22c55e" />
      </div>

      {/* ── Tab panel ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100 dark:border-white/6 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-white/8 overflow-x-auto">
          {[
            { key: 'inbound',   label: 'Inbound',   icon: ArrowDownToLine, count: inbound.length  },
            { key: 'outbound',  label: 'Outbound',  icon: ArrowUpFromLine, count: outbound.length  },
            { key: 'inventory', label: 'Inventory', icon: BarChart3,       count: null             },
            { key: 'docks',     label: 'Docks',     icon: Grid3x3,         count: availableDocks   },
          ].map(({ key, label, icon: Icon, count }) => (
            <button key={key}
              onClick={() => setTab(key as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors whitespace-nowrap',
                activeTab === key
                  ? 'text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-500 -mb-px'
                  : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count !== null && count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  activeTab === key ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {/* Inbound manifest */}
            {activeTab === 'inbound' && (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {inbound.length === 0 && (
                  <div className="py-14 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No inbound shipments</p>
                  </div>
                )}
                {inbound.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors group">
                    <ArrowDownToLine className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-mono text-gray-800 dark:text-white">{s.tracking_number}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{s.carrier_name} · {s.route.origin} → {s.route.destination}</p>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <p className="font-semibold text-gray-600 dark:text-white/60 tabular-nums">{Number(s.weight_kg).toLocaleString()} kg</p>
                      {s.scheduled_arrival && <p className="text-gray-400 dark:text-white/25">{fmtDate(s.scheduled_arrival)}</p>}
                    </div>
                    <Link to={`/ops/shipments/${s.id}`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Outbound */}
            {activeTab === 'outbound' && (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {outbound.length === 0 && (
                  <div className="py-14 text-center">
                    <Truck className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No outbound shipments</p>
                  </div>
                )}
                {outbound.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors group">
                    <ArrowUpFromLine className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-mono text-gray-800 dark:text-white">{s.tracking_number}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{s.carrier_name} · {s.route.origin} → {s.route.destination}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">In Transit</span>
                    <Link to={`/ops/shipments/${s.id}`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Inventory zones */}
            {activeTab === 'inventory' && (
              <div className="p-5 space-y-4">
                {BAY_ZONES.map((zone) => (
                  <div key={zone.zone} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: zone.color }}>
                      {zone.zone}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-700 dark:text-white/80">{zone.label}</span>
                        <span className="text-xs text-gray-400 dark:text-white/30">{zone.occupied}/{zone.bays} bays</span>
                      </div>
                      <OccupancyBar occupied={zone.occupied} total={zone.bays} color={zone.color} />
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 dark:border-white/8 pt-3 mt-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-600 dark:text-white/60">Total Occupancy</span>
                    <span className={cn('font-bold', occupancyPct > 80 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                      {occupancyPct}% ({occupiedBays}/{totalBays} bays)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Dock schedule */}
            {activeTab === 'docks' && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DOCK_CONFIG.map((dock) => {
                  const pct = Math.round((dock.occupied / dock.capacity) * 100)
                  const color = pct >= 100 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#22c55e'
                  return (
                    <div key={dock.id} className="rounded-xl border border-gray-100 dark:border-white/6 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{dock.id}</p>
                          <p className="text-xs text-gray-400 dark:text-white/30">{dock.type} dock</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                          {pct === 100 ? 'Full' : `${pct}%`}
                        </span>
                      </div>
                      <OccupancyBar occupied={dock.occupied} total={dock.capacity} color={color} />
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
