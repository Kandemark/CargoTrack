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
  TrendingUp, Activity, MapPin, CalendarDays, Calculator,
} from 'lucide-react'
import { demurrageApi, type DemurrageResult, type PortStatus } from '@/api/demurrage'
import { Link, useLocation } from 'react-router-dom'
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
  const loc = useLocation()
  function tabFromPath(): 'vessels' | 'containers' | 'clearance' | 'demurrage' {
    const p = loc.pathname
    if (p.includes('/port/containers')) return 'containers'
    if (p.includes('/port/manifest')) return 'clearance'
    return 'vessels'
  }
  const [activeTab, setTab] = useState<'vessels' | 'containers' | 'clearance' | 'demurrage'>(tabFromPath)

  // Demurrage state
  const [demPort, setDemPort] = useState('Mombasa')
  const [demContainerType, setDemContainerType] = useState('20FT')
  const [demType, setDemType] = useState('IMPORT')
  const [demArrival, setDemArrival] = useState('')
  const [demReturn, setDemReturn] = useState('')
  const [demResult, setDemResult] = useState<DemurrageResult | null>(null)
  const [portStatus, setPortStatus] = useState<PortStatus | null>(null)
  const [demLoading, setDemLoading] = useState(false)
  const [demError, setDemError] = useState<string | null>(null)

  async function calcDemurrage(e: React.FormEvent) {
    e.preventDefault()
    if (!demArrival || !demReturn) return
    setDemLoading(true); setDemError(null)
    try {
      const { data } = await demurrageApi.calculate({
        port: demPort, container_type: demContainerType,
        type: demType, arrival: demArrival, return: demReturn,
      })
      setDemResult(data)
    } catch {
      setDemError('Failed to calculate demurrage.')
    } finally { setDemLoading(false) }
  }

  async function loadPortStatus() {
    setDemLoading(true)
    try {
      const { data } = await demurrageApi.portStatus(demPort)
      setPortStatus(data)
    } catch { /* silent */ } finally { setDemLoading(false) }
  }

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
  useEffect(() => { setTab(tabFromPath()) }, [loc.pathname])

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
            { key: 'clearance',  label: 'Gate Clearance',  icon: FileText,    count: atCustoms.length },
            { key: 'demurrage',  label: 'Demurrage',        icon: Calculator, count: 0 },
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

            {activeTab === 'demurrage' && (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Calculator form */}
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3">Demurrage Calculator</p>
                    <form onSubmit={calcDemurrage} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Port</label>
                          <select value={demPort} onChange={(e) => setDemPort(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                            <option value="Mombasa">Mombasa</option>
                            <option value="Dar es Salaam">Dar es Salaam</option>
                            <option value="Lamu">Lamu</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Container</label>
                          <select value={demContainerType} onChange={(e) => setDemContainerType(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                            <option value="20FT">20FT</option>
                            <option value="40FT">40FT</option>
                            <option value="40FT_HC">40FT HC</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Shipment Type</label>
                        <select value={demType} onChange={(e) => setDemType(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                          <option value="IMPORT">Import</option>
                          <option value="EXPORT">Export</option>
                          <option value="TRANSSHIPMENT">Transshipment</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Arrival Date</label>
                          <input type="date" value={demArrival} onChange={(e) => setDemArrival(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Return Date</label>
                          <input type="date" value={demReturn} onChange={(e) => setDemReturn(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={demLoading}
                          className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 bg-teal-600 hover:bg-teal-700 transition-colors">
                          {demLoading ? 'Calculating…' : 'Calculate'}
                        </button>
                        <button type="button" onClick={loadPortStatus} disabled={demLoading}
                          className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          Port Status
                        </button>
                      </div>
                    </form>
                    {demError && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mt-3">{demError}</p>}
                  </div>

                  {/* Results */}
                  <div>
                    {demResult && (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-gray-700 dark:text-white/80">Calculation Result</p>
                        <div className="rounded-xl border border-gray-100 dark:border-white/6 p-4 bg-gray-50 dark:bg-white/3 space-y-2">
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Free Days</span><span className="font-semibold text-gray-900 dark:text-white">{demResult.free_days} days</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Free Until</span><span className="font-semibold text-gray-900 dark:text-white">{new Date(demResult.free_days_expiry).toLocaleDateString()}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Chargeable Days</span><span className="font-semibold text-gray-900 dark:text-white">{demResult.chargeable_days}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Demurrage</span><span className="font-semibold text-amber-600">${demResult.total_demurrage_usd}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Detention</span><span className="font-semibold text-red-600">${demResult.total_detention_usd}</span></div>
                          <div className="border-t border-gray-200 dark:border-white/8 pt-2 flex justify-between text-xs">
                            <span className="font-bold text-gray-700 dark:text-white/80">Grand Total</span>
                            <span className="font-bold text-gray-900 dark:text-white">${demResult.grand_total_usd}</span>
                          </div>
                          <div className="pt-1">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                              demResult.status === 'WITHIN_FREE_PERIOD' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' :
                              demResult.status === 'ACCRUING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' :
                              'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300')}>
                              {demResult.status === 'WITHIN_FREE_PERIOD' ? 'Within Free Period' : demResult.status === 'ACCRUING' ? 'Accruing' : 'Final'}
                            </span>
                          </div>
                        </div>
                        {demResult.daily_breakdown.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Daily Breakdown</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {demResult.daily_breakdown.map((d) => (
                                <div key={d.day} className="flex justify-between text-xs px-2 py-1 rounded bg-gray-50 dark:bg-white/5">
                                  <span className="text-gray-500">Day {d.day} — {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                  <span className="font-mono text-gray-700 dark:text-white/70">${d.daily_rate_usd}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {portStatus && (
                      <div className="space-y-3 mt-4">
                        <p className="text-sm font-bold text-gray-700 dark:text-white/80">Port Status: {portStatus.port}</p>
                        <div className="rounded-xl border border-gray-100 dark:border-white/6 p-4 bg-gray-50 dark:bg-white/3 space-y-2">
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Total Containers</span><span className="font-semibold text-gray-900 dark:text-white">{portStatus.total_containers}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">Accruing Demurrage</span><span className="font-semibold text-red-600">${portStatus.total_demurrage_accruing_usd}</span></div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Free Days Config</p>
                            {Object.entries(portStatus.free_days_config).map(([type, days]) => (
                              <div key={type} className="flex justify-between text-xs px-2 py-0.5"><span className="text-gray-500">{type}</span><span className="font-mono text-gray-700 dark:text-white/70">{days} days</span></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {!demResult && !portStatus && (
                      <div className="flex flex-col items-center justify-center h-full py-8 gap-3 text-gray-400 dark:text-white/30">
                        <Calculator className="w-10 h-10" />
                        <p className="text-sm">Calculate demurrage or load port status</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
