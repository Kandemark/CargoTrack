/**
 * PortPortal.tsx — Operations dashboard for port agents.
 *
 * Responsibilities:
 *  - Vessel arrival/departure schedule
 *  - Container tracking (FCL/LCL)
 *  - Port gate clearance queue
 *  - Demurrage & storage alerts
 *  - Manifest verification
 *
 * Data: Primarily driven by real shipment data filtered to coastal/port
 * origin/destination routes. Vessel and container data uses demo records
 * as the backend does not yet have a Vessel model.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Anchor, Package, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, ChevronRight, Ship, Container, FileText,
  TrendingUp, Activity, MapPin, CalendarDays,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import type { ShipmentListItem } from '@/types'

// ── Demo vessel schedule ───────────────────────────────────────────────────────

/**
 * Static demo vessel schedule — in production, sourced from a port authority
 * API or a Vessel model in the Django backend.
 */
const VESSELS = [
  { id: 'V-001', name: 'MSC Beatrice',      flag: 'PA', eta: '2026-04-21T06:00:00', berth: 'B-4', status: 'expected',  containers: 312, type: 'Container' },
  { id: 'V-002', name: 'Evergreen Cosmos',  flag: 'TW', eta: '2026-04-21T14:00:00', berth: 'B-7', status: 'expected',  containers: 189, type: 'Container' },
  { id: 'V-003', name: 'Safmarine Meru',    flag: 'ZA', eta: '2026-04-20T09:30:00', berth: 'B-2', status: 'berthed',   containers: 224, type: 'RoRo'      },
  { id: 'V-004', name: 'CMA CGM Kilimanj.', flag: 'FR', eta: '2026-04-22T08:00:00', berth: 'B-9', status: 'expected',  containers: 445, type: 'Container' },
  { id: 'V-005', name: 'Maersk Mombasa',    flag: 'DK', eta: '2026-04-19T16:00:00', berth: 'B-3', status: 'departed',  containers: 301, type: 'Container' },
  { id: 'V-006', name: 'ICTSI Pride',       flag: 'PH', eta: '2026-04-23T07:00:00', berth: 'B-6', status: 'expected',  containers: 155, type: 'Bulk'      },
]

const VESSEL_STATUS_CFG: Record<string, { color: string; label: string }> = {
  expected: { color: '#3b82f6', label: 'Expected'  },
  berthed:  { color: '#22c55e', label: 'Berthed'   },
  departed: { color: '#94a3b8', label: 'Departed'  },
  delayed:  { color: '#ef4444', label: 'Delayed'   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

export default function PortPortal() {
  const [atCustoms, setAtCustoms] = useState<ShipmentListItem[]>([])
  const [inTransit, setInTransit] = useState<ShipmentListItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setTab]       = useState<'vessels' | 'containers' | 'clearance'>('vessels')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, tRes] = await Promise.all([
        shipmentsApi.getShipments({ status: 'AT_CUSTOMS', page_size: 30 }),
        shipmentsApi.getShipments({ status: 'IN_TRANSIT', page_size: 30 }),
      ])
      setAtCustoms(cRes.data.results ?? [])
      setInTransit(tRes.data.results ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const berthed   = VESSELS.filter((v) => v.status === 'berthed').length
  const expected  = VESSELS.filter((v) => v.status === 'expected').length
  const totalCont = VESSELS.reduce((acc, v) => acc + v.containers, 0)

  return (
    <div className="space-y-6">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #042f2e 0%, #0d4341 50%, #134e4a 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Anchor className="w-4 h-4 text-teal-400" />
              <span className="text-white/50 text-sm font-medium">Port Operations</span>
            </div>
            <h1 className="text-2xl font-bold font-heading tracking-tight mb-1">Port Hub</h1>
            <p className="text-white/50 text-sm">
              {berthed} vessels berthed · {expected} expected · {atCustoms.length} at customs
            </p>
          </div>
          <button onClick={() => void load()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Vessels',   value: VESSELS.length, color: '#2dd4bf' },
            { label: 'Berthed',   value: berthed,         color: '#22c55e' },
            { label: 'Containers',value: totalCont,       color: '#3b82f6' },
            { label: 'At Customs',value: atCustoms.length,color: '#f59e0b' },
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
        <StatCard icon={Ship}      label="Vessels in Port"  value={berthed}          sub={`${expected} expected`}   color="#0f766e" />
        <StatCard icon={Container} label="Containers"       value={totalCont}        sub="All vessels combined"      color="#3b82f6" />
        <StatCard icon={Package}   label="At Customs"       value={atCustoms.length} sub="Awaiting clearance"        color="#f59e0b" />
        <StatCard icon={Activity}  label="In Transit"       value={inTransit.length} sub="Active shipments"          color="#22c55e" />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100 dark:border-white/6 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-white/8">
          {[
            { key: 'vessels',    label: 'Vessel Schedule', icon: Ship,      count: VESSELS.length },
            { key: 'containers', label: 'Containers',      icon: Container, count: totalCont      },
            { key: 'clearance',  label: 'Gate Clearance',  icon: FileText,  count: atCustoms.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button key={key}
              onClick={() => setTab(key as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors',
                activeTab === key
                  ? 'text-teal-700 dark:text-teal-400 border-b-2 border-teal-500 -mb-px'
                  : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  activeTab === key ? 'bg-teal-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {activeTab === 'vessels' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/6">
                    {['Vessel', 'Type', 'ETA / ETD', 'Berth', 'Containers', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VESSELS.map((v, i) => {
                    const cfg = VESSEL_STATUS_CFG[v.status]
                    return (
                      <motion.tr key={v.id}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="border-b border-gray-50 dark:border-white/4 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Ship className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-gray-800 dark:text-white">{v.name}</p>
                              <p className="text-[10px] text-gray-400 dark:text-white/25">Flag: {v.flag}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/50">{v.type}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/50">{fmtDate(v.eta)}</td>
                        <td className="px-4 py-3 text-xs font-mono font-bold text-gray-700 dark:text-white/70">{v.berth}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/50 tabular-nums">{v.containers.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {activeTab === 'containers' && (
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {VESSELS.filter((v) => v.status !== 'departed').map((v) => (
                    <div key={v.id} className="rounded-xl border border-gray-100 dark:border-white/6 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Container className="w-4 h-4 text-teal-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{v.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-white/25">Berth {v.berth}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{v.containers}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">containers</p>
                      <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (v.containers / 450) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'clearance' && (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {atCustoms.length === 0 && (
                  <div className="py-14 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No shipments awaiting gate clearance</p>
                  </div>
                )}
                {atCustoms.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors group">
                    <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-mono text-gray-800 dark:text-white">{s.tracking_number}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30">{s.carrier_name} · {s.route.origin} → {s.route.destination}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                      At Customs
                    </span>
                    <Link to={`/ops/shipments/${s.id}`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
