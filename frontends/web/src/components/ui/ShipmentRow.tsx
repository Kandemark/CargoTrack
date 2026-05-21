import { ArrowRight, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import StatusBadge, { type ShipmentStatus } from './StatusBadge'

export interface ShipmentRowData {
  id: number | string
  tracking_number?: string
  status: ShipmentStatus | string
  origin?: string
  destination?: string
  eta?: string | null
  delay_risk_score?: number | null
  carrier?: string
  linkPrefix?: string
}

interface ShipmentRowProps {
  shipment: ShipmentRowData
  className?: string
}

function RiskPip({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-red-400'
    : score >= 40 ? 'text-amber-400'
    : 'text-emerald-400'
  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium tabular-nums', color)}>
      <AlertTriangle className="w-3 h-3" />
      {score}%
    </span>
  )
}

export default function ShipmentRow({ shipment, className }: ShipmentRowProps) {
  const prefix = shipment.linkPrefix ?? ''
  const href   = `${prefix}/shipments/${shipment.id}`
  const ref    = shipment.tracking_number ?? `#${shipment.id}`

  return (
    <Link
      to={href}
      className={cn(
        'group grid grid-cols-[auto_1fr_auto] md:grid-cols-[6rem_1fr_9rem_7rem_5rem] items-center gap-3 md:gap-4',
        'px-4 py-3 rounded-xl border border-border bg-card',
        'hover:border-ct-green/40 hover:shadow-card transition-all duration-[var(--duration-fast)]',
        className,
      )}
    >
      {/* Tracking ref */}
      <span className="font-mono text-xs font-semibold text-muted-foreground truncate">
        {ref}
      </span>

      {/* Route */}
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">
          {shipment.origin ?? '—'}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">
          {shipment.destination ?? '—'}
        </span>
      </span>

      {/* Status */}
      <StatusBadge status={shipment.status} size="sm" />

      {/* ETA */}
      <span className="hidden md:block text-xs text-muted-foreground tabular-nums">
        {shipment.eta
          ? new Date(shipment.eta).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          : '—'}
      </span>

      {/* Risk */}
      <div className="hidden md:flex justify-end">
        {shipment.delay_risk_score != null
          ? <RiskPip score={Math.round(shipment.delay_risk_score)} />
          : <span className="text-xs text-muted-foreground">—</span>
        }
      </div>
    </Link>
  )
}
