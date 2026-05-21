/**
 * DriverInfoCard.tsx — Uber-style floating info card that appears above
 * a selected shipment marker on the map.
 *
 * Displays: carrier name, status, ETA countdown, route progress, actions.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Truck, Clock, MapPin, Navigation, ChevronRight, X, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ShipmentListItem } from '@/types'

interface Props {
  shipment: ShipmentListItem & { progress?: number }
  mapContainer?: HTMLElement | null
  onClose: () => void
  onNavigate: () => void
}

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  IN_TRANSIT: { color: '#3b82f6', label: 'In Transit' },
  CUSTOMS:    { color: '#f59e0b', label: 'At Customs' },
  DELAYED:    { color: '#ef4444', label: 'Delayed' },
  PENDING:    { color: '#94a3b8', label: 'Pending' },
  DELIVERED:  { color: '#22c55e', label: 'Delivered' },
}

export default function DriverInfoCard({ shipment, onClose, onNavigate }: Props) {
  const cfg = STATUS_CFG[shipment.status] ?? { color: '#94a3b8', label: shipment.status }
  const progress = shipment.progress ?? 0

  // Live ETA countdown
  const [etaText, setEtaText] = useState('')
  useEffect(() => {
    function tick() {
      if (!shipment.scheduled_arrival) { setEtaText('Unknown'); return }
      const diff = new Date(shipment.scheduled_arrival).getTime() - Date.now()
      if (diff < 0) { setEtaText('Overdue'); return }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      if (days > 1) setEtaText(`${days}d ${hours}h`)
      else if (days === 1) setEtaText(`1d ${hours}h`)
      else if (hours > 0) setEtaText(`${hours}h ${mins}m`)
      else setEtaText(`${mins}m`)
    }
    tick()
    const interval = setInterval(tick, 10_000)
    return () => clearInterval(interval)
  }, [shipment.scheduled_arrival])

  const etaColor = shipment.status === 'DELAYED' ? '#ef4444'
    : progress > 80 ? '#22c55e'
    : progress > 40 ? '#f59e0b'
    : '#3b82f6'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      className="absolute z-[600] w-[320px] rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: 'rgba(10,25,41,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      {/* Header strip */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: `${cfg.color}18` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}30` }}>
            <Truck className="w-4.5 h-4.5" style={{ color: cfg.color }} />
          </div>
          <div>
            <p className="text-white text-sm font-bold font-mono tracking-tight">{shipment.tracking_number}</p>
            <p className="text-white/40 text-[11px]">{shipment.carrier_name}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/8 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* ETA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>ETA</span>
          </div>
          <span className="text-lg font-bold font-mono" style={{ color: etaColor }}>{etaText}</span>
        </div>

        {/* Route */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-white/50 flex-1">{shipment.route.origin}</span>
          </div>
          <div className="relative ml-[3px]">
            <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500/60 to-white/10 ml-px" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span className="text-white/50 flex-1">{shipment.route.destination}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ background: `linear-gradient(90deg, ${cfg.color}, ${etaColor})` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/25">
            <span>0%</span>
            <span className="text-white/45 font-semibold">{progress}% complete</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex gap-2">
        <Link to={`/ops/shipments/${shipment.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-orange)' }}>
          View Details <ChevronRight className="w-3.5 h-3.5" />
        </Link>
        <button onClick={onNavigate}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white bg-white/8 hover:bg-white/12 transition-colors"
          title="Navigate to marker">
          <Navigation className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}
