/**
 * @file ShipmentDetail.tsx
 * @description Full shipment detail page showing cargo info, tracking event
 * timeline, and ML delay prediction trigger.
 *
 * Data flow:
 *   - Reads `id` from the URL params via `useParams()`.
 *   - Fetches `GET /api/v1/shipments/<id>/` and
 *     `GET /api/v1/shipments/<id>/tracking-events/` in parallel on mount.
 *   - "Run Prediction" button posts to `/api/v1/shipments/<id>/predict/`
 *     and updates the displayed `delay_risk_score`.
 *   - Status update PATCH is sent inline from the status dropdown.
 *
 * @route /shipments/:id
 * @auth IsAuthenticated (read / predict); IsAuthenticatedOrReadOnly (PATCH status)
 */
import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, Truck, AlertTriangle, RefreshCw, CheckCircle, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import type { Shipment, TrackingEvent, DelayPrediction, ShipmentStatus } from '@/types'

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string; border: string }> = {
  PENDING:    { label: 'Pending',    bg: 'bg-gray-100',   text: 'text-gray-700',    border: 'border-gray-200'   },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'   },
  CUSTOMS:    { label: 'At Customs', bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  DELAYED:    { label: 'Delayed',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'    },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200'},
}

const EVENT_DOT: Record<string, string> = {
  DEPARTURE:     'bg-blue-500',
  CHECKPOINT:    'bg-gray-400',
  CUSTOMS_ENTRY: 'bg-purple-500',
  CUSTOMS_CLEAR: 'bg-purple-400',
  ARRIVAL:       'bg-emerald-500',
  DELAY:         'bg-red-500',
  NOTE:          'bg-gray-300',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const canLogEvents = usePermission(Permission.SHIPMENTS_UPDATE)
  const [shipment, setShipment]   = useState<Shipment | null>(null)
  const [events, setEvents]       = useState<TrackingEvent[]>([])
  const [prediction, setPrediction] = useState<DelayPrediction | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [predicting, setPredicting] = useState(false)

  async function load() {
    if (!id) return
    const numId = parseInt(id, 10)
    setLoading(true)
    setError(null)
    try {
      const [shipRes, eventsRes] = await Promise.all([
        shipmentsApi.getShipment(numId),
        shipmentsApi.getShipmentTrackingEvents(numId),
      ])
      setShipment(shipRes.data)
      setEvents(eventsRes.data.results)
    } catch {
      setError('Shipment not found or unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function runPrediction() {
    if (!shipment) return
    setPredicting(true)
    try {
      const { data } = await shipmentsApi.predictDelay(shipment.id)
      setPrediction(data)
      // Refresh shipment to pick up the updated delay_risk_score
      const { data: updated } = await shipmentsApi.getShipment(shipment.id)
      setShipment(updated)
    } catch {
      // Model may not be trained; show nothing
    } finally {
      setPredicting(false)
    }
  }

  const loadedIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (loadedIdRef.current === id) return
    loadedIdRef.current = id
    void load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading shipment…</p>
        </div>
      </div>
    )
  }

  if (error || !shipment) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error ?? 'Shipment not found.'}</p>
        <div className="flex gap-3">
          <Link
            to="/shipments"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Back to shipments
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--ct-navy)' }}
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    )
  }

  const status = STATUS_CONFIG[shipment.status] ?? STATUS_CONFIG.PENDING
  const riskPct = Math.round(shipment.delay_risk_score * 100)
  const riskColor = riskPct >= 70 ? 'text-red-600 bg-red-50 border-red-200'
    : riskPct >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-emerald-600 bg-emerald-50 border-emerald-200'

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to="/shipments" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 font-mono tracking-tight">
            {shipment.tracking_number}
          </h1>
          <p className="text-sm text-gray-400">
            {shipment.route.origin} → {shipment.route.destination}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border', status.bg, status.text, status.border)}>
            {status.label}
          </span>
          {canLogEvents && (
            <Link
              to={`/shipments/${shipment.id}/log-event`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--ct-navy)' }}
            >
              <PlusCircle className="w-3.5 h-3.5" /> Log event
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Shipment details */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400" /> Shipment Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Carrier',         shipment.carrier_name],
              ['Weight',          `${shipment.weight_kg.toLocaleString()} kg`],
              ['Origin',          shipment.route.origin],
              ['Destination',     shipment.route.destination],
              ['Distance',        `${shipment.route.distance_km.toLocaleString()} km`],
              ['Est. Duration',   `${shipment.route.estimated_hours} h`],
              ['Scheduled Dep.',  fmt(shipment.scheduled_departure)],
              ['Scheduled Arr.',  fmt(shipment.scheduled_arrival)],
              ['Actual Dep.',     shipment.actual_departure ? fmt(shipment.actual_departure) : '—'],
              ['Actual Arr.',     shipment.actual_arrival  ? fmt(shipment.actual_arrival)   : 'Pending'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{k}</dt>
                <dd className="text-sm text-gray-800 mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Risk panel */}
        <div className={cn('rounded-xl border p-5 space-y-4', riskColor)}>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Delay Risk
          </h2>
          <div>
            <p className="text-5xl font-bold tabular-nums">{riskPct}%</p>
            <p className="text-sm font-medium mt-1">
              {riskPct >= 70 ? 'High risk' : riskPct >= 40 ? 'Medium risk' : 'Low risk'}
            </p>
          </div>

          {prediction && (
            <div className="pt-3 border-t border-current/10 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {prediction.predicted_delayed ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {prediction.predicted_delayed ? 'Delay predicted' : 'On-time predicted'}
                </span>
              </div>
              <p className="text-xs opacity-70">
                Confidence: {(prediction.confidence * 100).toFixed(0)}%
              </p>
            </div>
          )}

          <button
            onClick={runPrediction}
            disabled={predicting}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white/60 hover:bg-white/80 transition-colors border border-current/20 disabled:opacity-60"
          >
            {predicting ? 'Running model…' : prediction ? 'Re-run prediction' : 'Run ML prediction'}
          </button>
        </div>
      </div>

      {/* Tracking timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-gray-400" /> Tracking History
          <span className="ml-auto text-xs font-normal text-gray-400">{events.length} events</span>
        </h2>

        {events.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <MapPin className="w-7 h-7 text-gray-200" />
            <p className="text-sm text-gray-400">No tracking events recorded yet.</p>
          </div>
        ) : (
          <ol className="relative border-l border-gray-100 space-y-5 pl-6">
            {events.map((ev, idx) => (
              <li key={ev.id} className="relative">
                <div
                  className={cn(
                    'absolute -left-[1.55rem] w-3 h-3 rounded-full border-2 border-white shadow-sm',
                    idx === 0 ? (EVENT_DOT[ev.event_type] ?? 'bg-gray-400') : 'bg-gray-300',
                  )}
                />
                <p className="text-xs text-gray-400 mb-0.5">{fmtDatetime(ev.timestamp)}</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{ev.location}</span>
                  <span className="text-xs text-gray-400 ml-auto">{ev.event_type_display}</span>
                </div>
                {ev.notes && <p className="text-xs text-gray-500 mt-1 ml-5">{ev.notes}</p>}
                {ev.recorded_by_name && (
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">Logged by {ev.recorded_by_name}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
