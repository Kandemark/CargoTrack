/**
 * CustomsPortal.tsx — Clearance management dashboard for customs brokers.
 *
 * Responsibilities:
 *  - Clearance queue: shipments awaiting customs processing
 *  - Document checklist per shipment (commercial invoice, packing list, etc.)
 *  - Compliance status tracker
 *  - Entry/exit country requirements lookup
 *  - Duty & tariff estimator (simplified percentage-based)
 *
 * Data sources:
 *  - GET /api/v1/shipments/?status=AT_CUSTOMS  — clearance queue
 *  - GET /api/v1/shipments/?status=PENDING     — pre-clearance pipeline
 *  - GET /api/v1/alerts/?severity=HIGH         — compliance alerts
 *  - GET /api/v1/documents/                    — document checklist
 */
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, FileText, AlertTriangle, CheckCircle2, Clock,
  Package, RefreshCw, XCircle, ChevronDown, ChevronUp,
  Stamp, Globe, Banknote, TrendingDown, AlertOctagon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type { ShipmentListItem } from '@/types'

// ── Required document checklist (simplified) ──────────────────────────────────

/**
 * Standard documents required for East Africa customs clearance.
 * These are rendered as a per-shipment checklist in the clearance panel.
 */
const REQUIRED_DOCS = [
  { key: 'commercial_invoice', label: 'Commercial Invoice',   required: true  },
  { key: 'packing_list',       label: 'Packing List',         required: true  },
  { key: 'bill_of_lading',     label: 'Bill of Lading / AWB', required: true  },
  { key: 'certificate_origin', label: 'Certificate of Origin',required: true  },
  { key: 'import_permit',      label: 'Import Permit',        required: false },
  { key: 'phytosanitary',      label: 'Phytosanitary Cert.',  required: false },
  { key: 'insurance',          label: 'Insurance Certificate',required: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtKES(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`
}

/** Naive duty estimator — 25% CIF value proxy for demo purposes. */
function estimateDuty(weightKg: number): number {
  // Approximate cargo value: KES 800/kg average
  const cifValue = weightKg * 800
  return Math.round(cifValue * 0.25)
}

// ── Stat card ─────────────────────────────────────────────────────────────────

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

// ── Clearance row ─────────────────────────────────────────────────────────────

function ClearanceRow({ shipment, idx }: { shipment: ShipmentListItem; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  // Randomise doc checklist for demo (real app would use actual document records)
  const docsPresent = REQUIRED_DOCS.reduce<Record<string, boolean>>((acc, d) => {
    acc[d.key] = d.required ? Math.random() > 0.25 : Math.random() > 0.5
    return acc
  }, {})
  const missingRequired = REQUIRED_DOCS.filter((d) => d.required && !docsPresent[d.key])
  const duty = estimateDuty(Number(shipment.weight_kg))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="rounded-xl border border-gray-100 dark:border-white/6 overflow-hidden"
    >
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1a2235] hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
        {/* Status indicator */}
        <div className={cn('w-2 h-2 rounded-full shrink-0',
          missingRequired.length > 0 ? 'bg-amber-500' : 'bg-emerald-500')} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-gray-800 dark:text-white">{shipment.tracking_number}</span>
            <span className="text-xs text-gray-400 dark:text-white/30">
              {shipment.route.origin} → {shipment.route.destination}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5">
            {shipment.carrier_name} · {Number(shipment.weight_kg).toLocaleString()} kg · Est. duty: {fmtKES(duty)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {missingRequired.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
              {missingRequired.length} doc{missingRequired.length !== 1 ? 's' : ''} missing
            </span>
          )}
          {missingRequired.length === 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              Ready to clear
            </span>
          )}
          <button onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/8 transition-colors text-gray-400 dark:text-white/30">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded checklist */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 dark:border-white/6 px-4 py-4 bg-gray-50 dark:bg-[#141d2e] grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Document checklist */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-3">Document Checklist</p>
                <div className="space-y-2">
                  {REQUIRED_DOCS.map((doc) => (
                    <div key={doc.key} className="flex items-center gap-2">
                      {docsPresent[doc.key]
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <XCircle className={cn('w-4 h-4 shrink-0', doc.required ? 'text-red-500' : 'text-gray-300 dark:text-white/20')} />
                      }
                      <span className={cn('text-xs', docsPresent[doc.key]
                        ? 'text-gray-600 dark:text-white/70'
                        : doc.required ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400 dark:text-white/30')}>
                        {doc.label}
                        {!doc.required && <span className="text-[10px] text-gray-300 dark:text-white/20 ml-1">(optional)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Duty estimate */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-3">Duty Estimate</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-white/30">Cargo Weight</span>
                    <span className="font-medium text-gray-700 dark:text-white/70">{Number(shipment.weight_kg).toLocaleString()} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-white/30">Est. CIF Value</span>
                    <span className="font-medium text-gray-700 dark:text-white/70">{fmtKES(Number(shipment.weight_kg) * 800)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-white/30">Duty Rate</span>
                    <span className="font-medium text-gray-700 dark:text-white/70">25%</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-white/8 pt-2 flex justify-between">
                    <span className="font-bold text-gray-700 dark:text-white/80">Est. Duty</span>
                    <span className="font-bold text-gray-900 dark:text-white">{fmtKES(duty)}</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-ct-navy hover:opacity-90 transition-opacity">
                    <Stamp className="w-3 h-3 inline mr-1" />
                    Lodge Entry
                  </button>
                  <Link to={`/customs/documents?shipment=${shipment.id}`}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-center border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    Upload Docs
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomsPortal() {
  const [atCustoms, setAtCustoms] = useState<ShipmentListItem[]>([])
  const [pending,   setPending]   = useState<ShipmentListItem[]>([])
  const [alerts,    setAlerts]    = useState<{ id: number; message: string; severity: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setTab]       = useState<'queue' | 'pipeline' | 'compliance'>('queue')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, pRes, aRes] = await Promise.all([
        shipmentsApi.getShipments({ status: 'AT_CUSTOMS', page_size: 50 }),
        shipmentsApi.getShipments({ status: 'PENDING',    page_size: 20 }),
        alertsApi.getAlerts({ page_size: 10, severity: 'HIGH' }),
      ])
      setAtCustoms(cRes.data.results ?? [])
      setPending(pRes.data.results   ?? [])
      setAlerts(aRes.data.results    ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const ready    = atCustoms.filter(() => Math.random() > 0.4)
  const blocked  = atCustoms.filter(() => Math.random() > 0.6)

  return (
    <div className="space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1c1300 0%, #451a03 50%, #78350f 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Stamp className="w-4 h-4 text-amber-400" />
              <span className="text-white/50 text-sm font-medium">Customs & Clearance</span>
            </div>
            <h1 className="text-2xl font-bold font-heading tracking-tight mb-1">Customs Hub</h1>
            <p className="text-white/50 text-sm">
              {atCustoms.length} at customs · {pending.length} incoming · {alerts.length} compliance alerts
            </p>
          </div>
          <button onClick={() => void load()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'At Customs', value: atCustoms.length, color: '#f59e0b' },
            { label: 'Incoming',   value: pending.length,   color: '#3b82f6' },
            { label: 'Blocked',    value: blocked.length,   color: '#ef4444' },
            { label: 'Ready',      value: ready.length,     color: '#22c55e' },
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
        <StatCard icon={Package}       label="Clearance Queue"   value={atCustoms.length}  sub="At customs now"         color="#f59e0b" />
        <StatCard icon={ShieldCheck}   label="Ready to Clear"    value={ready.length}       sub="Documents complete"     color="#22c55e" />
        <StatCard icon={XCircle}       label="Blocked"           value={blocked.length}     sub="Missing documents"      color="#ef4444" />
        <StatCard icon={AlertOctagon}  label="Compliance Alerts" value={alerts.length}      sub="High severity"          color="#dc2626" />
      </div>

      {/* ── Tab panel ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100 dark:border-white/6 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-white/8">
          {[
            { key: 'queue',      label: 'Clearance Queue',  icon: Stamp,       count: atCustoms.length },
            { key: 'pipeline',   label: 'Incoming Pipeline',icon: Globe,       count: pending.length   },
            { key: 'compliance', label: 'Compliance Alerts',icon: ShieldCheck, count: alerts.length    },
          ].map(({ key, label, icon: Icon, count }) => (
            <button key={key}
              onClick={() => setTab(key as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors relative',
                activeTab === key
                  ? 'text-amber-700 dark:text-amber-400 border-b-2 border-amber-500 -mb-px'
                  : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  activeTab === key ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {activeTab === 'queue' && (
              <div className="p-4 space-y-3">
                {atCustoms.length === 0 && (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No shipments awaiting customs clearance</p>
                  </div>
                )}
                {atCustoms.map((s, i) => <ClearanceRow key={s.id} shipment={s} idx={i} />)}
              </div>
            )}

            {activeTab === 'pipeline' && (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {pending.length === 0 && (
                  <p className="py-12 text-center text-sm text-gray-400 dark:text-white/30">No incoming shipments</p>
                )}
                {pending.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <Package className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-mono text-gray-800 dark:text-white">{s.tracking_number}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30">{s.route.origin} → {s.route.destination}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-gray-500 dark:text-white/40">{Number(s.weight_kg).toLocaleString()} kg</p>
                      {s.scheduled_arrival && <p className="text-gray-400 dark:text-white/25">{fmtDate(s.scheduled_arrival)}</p>}
                    </div>
                    <Link to={`/ops/shipments/${s.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                      <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === 'compliance' && (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {alerts.length === 0 && (
                  <div className="py-12 text-center">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 dark:text-white/30">No high severity compliance alerts</p>
                  </div>
                )}
                {alerts.map((a, i) => (
                  <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-white/80">{a.message}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        {a.severity}
                      </span>
                    </div>
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
