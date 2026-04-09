import { useState, type FormEvent } from 'react'
import { Search, MapPin, Clock } from 'lucide-react'
import { trackingApi } from '@/api/tracking'
import type { TrackingEvent, ShipmentStatus } from '@/types'

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  pending:    'bg-gray-100 text-gray-600',
  in_transit: 'bg-blue-100 text-blue-700',
  at_customs: 'bg-purple-100 text-purple-700',
  delayed:    'bg-amber-100 text-amber-700',
  delivered:  'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-red-100 text-red-600',
}

interface TrackResult {
  tracking_number: string
  status: ShipmentStatus
  description: string
  origin_port: string
  destination_port: string
  estimated_arrival: string
  events: TrackingEvent[]
}

export default function Tracking() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<TrackResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await trackingApi.publicTrack(query.trim())
      setResult(res.data)
    } catch {
      setError('Tracking number not found. Please check and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Live Tracking</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track any shipment by its tracking number</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter tracking number (e.g. CT-2024-00123)"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-navy)' }}
        >
          <Search className="w-4 h-4" />
          {loading ? 'Searching…' : 'Track'}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
            <div>
              <p className="font-mono font-bold text-gray-900">{result.tracking_number}</p>
              <p className="text-sm text-gray-500 mt-0.5">{result.description}</p>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                {result.origin_port} → {result.destination_port}
              </div>
            </div>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[result.status]}`}>
              {result.status.replace('_', ' ')}
            </span>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Clock className="w-3.5 h-3.5" />
              ETA: {new Date(result.estimated_arrival).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>

            {result.events.length > 0 ? (
              <ol className="relative border-l border-gray-200 space-y-4 pl-6">
                {result.events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <div className="absolute -left-[1.65rem] w-3 h-3 rounded-full border-2 border-white bg-blue-400 shadow" />
                    <p className="text-xs text-gray-400 mb-0.5">
                      {new Date(ev.timestamp).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-800">{ev.location}</span>
                    </div>
                    {ev.notes && <p className="text-xs text-gray-500 mt-0.5">{ev.notes}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">No tracking events yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
