/**
 * TrackingPortal.tsx — Public shipment tracker. No login required.
 * Route: /track/:tracking_number
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Package, MapPin, Clock, CheckCircle, AlertTriangle, Truck, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import type { ShipmentStatus, EventType, TrackingEvent } from '@/types'

interface PublicShipment {
  tracking_number: string
  status: ShipmentStatus
  status_display: string
  origin: string
  destination: string
  carrier_name: string
  scheduled_arrival: string
  actual_arrival: string | null
  delay_risk_score: number
  events: TrackingEvent[]
}

const STATUS_CFG: Record<ShipmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:    { label: 'Awaiting Pickup',    color: 'text-gray-500',    icon: <Clock className="w-5 h-5" /> },
  IN_TRANSIT: { label: 'In Transit',         color: 'text-blue-600',    icon: <Truck className="w-5 h-5" /> },
  CUSTOMS:    { label: 'Customs Clearance',  color: 'text-amber-600',   icon: <Package className="w-5 h-5" /> },
  DELIVERED:  { label: 'Delivered',          color: 'text-emerald-600', icon: <CheckCircle className="w-5 h-5" /> },
  DELAYED:    { label: 'Delayed',            color: 'text-red-600',     icon: <AlertTriangle className="w-5 h-5" /> },
}

const EVENT_DOT: Record<EventType, string> = {
  DEPARTURE:     'bg-blue-500',
  CHECKPOINT:    'bg-gray-400',
  CUSTOMS_ENTRY: 'bg-amber-500',
  CUSTOMS_CLEAR: 'bg-emerald-500',
  ARRIVAL:       'bg-emerald-600',
  DELAY:         'bg-red-500',
  NOTE:          'bg-gray-300',
}

const STATUS_ORDER: ShipmentStatus[] = ['PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED']

function ProgressBar({ status }: { status: ShipmentStatus }) {
  const delayed = status === 'DELAYED'
  const step = delayed ? 2 : STATUS_ORDER.indexOf(status)
  const pct = Math.max(0, Math.min(100, (step / (STATUS_ORDER.length - 1)) * 100))

  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <motion.div
          className={cn('absolute left-0 top-0 h-full rounded-full', delayed ? 'bg-red-400' : 'bg-blue-500')}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-gray-400 dark:text-white/30">
        <span>Pickup</span>
        <span>Transit</span>
        <span>Customs</span>
        <span>Delivered</span>
      </div>
    </div>
  )
}

export default function TrackingPortal() {
  const { tracking_number } = useParams<{ tracking_number?: string }>()
  const [query,    setQuery]    = useState(tracking_number ?? '')
  const [searched, setSearched] = useState(tracking_number ?? '')
  const [shipment, setShipment] = useState<PublicShipment | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function search(tn: string) {
    if (!tn.trim()) return
    setLoading(true); setError(null); setShipment(null)
    try {
      const res = await apiClient.get<PublicShipment>(`/api/v1/shipments/track/${tn.trim()}/`)
      setShipment(res.data)
      setSearched(tn.trim())
    } catch {
      setError('Tracking number not found. Please check and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tracking_number) void search(tracking_number)
  }, [tracking_number])

  const cfg = shipment ? (STATUS_CFG[shipment.status] ?? STATUS_CFG.PENDING) : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d1117] py-12 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--ct-navy)' }}>
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white font-heading">CargoTrack</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-heading">Track Your Shipment</h1>
        <p className="text-gray-500 dark:text-white/50 mt-2 text-sm">Enter your tracking number to see real-time shipment status</p>
      </div>

      {/* Search bar */}
      <div className="max-w-xl mx-auto mb-8">
        <form onSubmit={(e) => { e.preventDefault(); void search(query) }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. CT-2024-ABC123"
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a2235] text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
            />
          </div>
          <button type="submit" disabled={loading}
            className="px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity shadow-sm"
            style={{ background: 'var(--ct-navy)' }}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track'}
          </button>
        </form>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="max-w-xl mx-auto mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {shipment && cfg && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto space-y-4">

            {/* Status card */}
            <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">Tracking number</p>
                  <p className="font-mono text-xl font-bold text-gray-900 dark:text-white">{shipment.tracking_number}</p>
                </div>
                <div className={cn('flex items-center gap-1.5', cfg.color)}>
                  {cfg.icon}
                  <span className="text-sm font-semibold">{cfg.label}</span>
                </div>
              </div>

              <ProgressBar status={shipment.status} />

              <div className="mt-5 grid grid-cols-2 gap-4 pt-5 border-t border-gray-100 dark:border-white/8 text-sm">
                <div>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Origin
                  </p>
                  <p className="font-medium text-gray-800 dark:text-white">{shipment.origin}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Destination
                  </p>
                  <p className="font-medium text-gray-800 dark:text-white">{shipment.destination}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Carrier</p>
                  <p className="font-medium text-gray-800 dark:text-white">{shipment.carrier_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">
                    {shipment.actual_arrival ? 'Delivered' : 'Est. Arrival'}
                  </p>
                  <p className={cn('font-medium', shipment.actual_arrival ? 'text-emerald-600' : 'text-gray-800 dark:text-white')}>
                    {new Date(shipment.actual_arrival ?? shipment.scheduled_arrival).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {shipment.delay_risk_score > 0.5 && shipment.status !== 'DELIVERED' && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/30">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Elevated delay risk ({Math.round(shipment.delay_risk_score * 100)}%). Our team is monitoring this shipment.
                  </p>
                </div>
              )}
            </div>

            {/* Tracking timeline */}
            {shipment.events.length > 0 && (
              <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/8">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Tracking History</h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {shipment.events.map((ev, i) => (
                    <motion.div key={ev.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn('w-2.5 h-2.5 rounded-full mt-0.5 shrink-0', EVENT_DOT[ev.event_type] ?? 'bg-gray-300')} />
                        {i < shipment.events.length - 1 && (
                          <div className="w-px flex-1 bg-gray-100 dark:bg-white/8 mt-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{ev.event_type_display}</p>
                          <p className="text-xs text-gray-400 dark:text-white/30 shrink-0">
                            {new Date(ev.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{ev.location}</p>
                        {ev.notes && <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 italic">{ev.notes}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 dark:text-white/20 pb-4">
              Powered by <Link to="/" className="hover:underline">CargoTrack</Link> · East Africa Logistics Intelligence
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !error && !shipment && (
        <div className="max-w-2xl mx-auto text-center py-16">
          <Package className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-white/30">Enter a tracking number above to get started</p>
        </div>
      )}
    </div>
  )
}
