/**
 * @file Tracking.tsx
 * @description Public-style tracking lookup page — allows any authenticated
 * user to search for a shipment by tracking number and view its event history.
 *
 * Data flow:
 *   - User enters a tracking number (e.g. CT-20240415-ABCD) and submits.
 *   - Calls `shipmentsApi.getShipments({ tracking_number })` to locate the
 *     shipment, then `shipmentsApi.getShipmentTrackingEvents(id)` for events.
 *   - Events are rendered as a vertical timeline ordered newest-first.
 *
 * @route /tracking
 * @auth IsAuthenticated
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, MapPin, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import type { Shipment, TrackingEvent, ShipmentStatus } from '@/types'

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string }> = {
  PENDING:    { label: 'Pending',    bg: 'bg-gray-100',   text: 'text-gray-600'    },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  CUSTOMS:    { label: 'At Customs', bg: 'bg-purple-50',  text: 'text-purple-700'  },
  DELAYED:    { label: 'Delayed',    bg: 'bg-red-50',     text: 'text-red-700'     },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const EVENT_DOT: Record<string, string> = {
  DEPARTURE:     'bg-blue-500',
  CHECKPOINT:    'bg-gray-400',
  CUSTOMS_ENTRY: 'bg-purple-500',
  CUSTOMS_CLEAR: 'bg-purple-300',
  ARRIVAL:       'bg-emerald-500',
  DELAY:         'bg-red-500',
  NOTE:          'bg-gray-300',
}

interface TrackResult {
  shipment: Shipment
  events: TrackingEvent[]
}

export default function Tracking() {
  const [query, setQuery]   = useState('')
  const [result, setResult] = useState<TrackResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().toUpperCase()
    if (!q) return
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      // Load the first page (up to 100 results) and find an exact match.
      // For datasets with more shipments, a server-side filter would be added.
      const listRes = await shipmentsApi.getShipments({ page_size: 100 })
      const shipment = listRes.data.results.find(
        (s) => s.tracking_number.toUpperCase() === q,
      ) as Shipment | undefined

      if (!shipment) {
        setError(`No shipment found with tracking number "${q}". Please check and try again.`)
        return
      }

      // Fetch the full detail and tracking events in parallel
      const [detailRes, eventsRes] = await Promise.all([
        shipmentsApi.getShipment(shipment.id),
        shipmentsApi.getShipmentTrackingEvents(shipment.id),
      ])
      setResult({ shipment: detailRes.data, events: eventsRes.data.results })
    } catch {
      setError('An error occurred while searching. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const status = result ? (STATUS_CONFIG[result.shipment.status] ?? STATUS_CONFIG.PENDING) : null

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Live Tracking</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track any shipment on the Northern Corridor by tracking number
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter tracking number — e.g. CT-20240408-A7B2"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:font-sans placeholder:text-gray-400 text-gray-800"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-navy)' }}
        >
          <Search className="w-4 h-4" />
          {loading ? 'Searching…' : 'Track'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && status && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Shipment header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono font-bold text-gray-900 text-base tracking-tight">
                {result.shipment.tracking_number}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">{result.shipment.route.origin}</span>
                <span className="text-gray-300">→</span>
                <span>{result.shipment.route.destination}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ETA: {new Date(result.shipment.scheduled_arrival).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
                <span>{result.shipment.carrier_name}</span>
                <span>{result.shipment.weight_kg.toLocaleString()} kg</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold', status.bg, status.text)}>
                {status.label}
              </span>
              <Link
                to={`/shipments/${result.shipment.id}`}
                className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
              >
                Full details <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Timeline */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
              Tracking history · {result.events.length} events
            </p>
            {result.events.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <MapPin className="w-6 h-6 text-gray-200" />
                <p className="text-sm text-gray-400">No tracking events recorded yet.</p>
              </div>
            ) : (
              <ol className="relative border-l border-gray-100 space-y-4 pl-6">
                {result.events.map((ev, idx) => (
                  <li key={ev.id} className="relative">
                    <div
                      className={cn(
                        'absolute -left-[1.55rem] w-3 h-3 rounded-full border-2 border-white shadow-sm',
                        idx === 0
                          ? (EVENT_DOT[ev.event_type] ?? 'bg-gray-400')
                          : 'bg-gray-300',
                      )}
                    />
                    <p className="text-xs text-gray-400 mb-0.5">
                      {new Date(ev.timestamp).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-800">{ev.location}</span>
                      <span className="ml-auto text-xs text-gray-400">{ev.event_type_display}</span>
                    </div>
                    {ev.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 ml-5">{ev.notes}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
