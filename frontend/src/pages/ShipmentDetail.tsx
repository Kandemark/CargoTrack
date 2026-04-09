import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, Truck, AlertTriangle } from 'lucide-react'
import { shipmentsApi } from '@/api/shipments'
import { trackingApi } from '@/api/tracking'
import type { Shipment, TrackingEvent, DelayPrediction } from '@/types'

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [prediction, setPrediction] = useState<DelayPrediction | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const numId = parseInt(id)
    Promise.all([
      shipmentsApi.get(numId),
      trackingApi.getEvents(numId),
      shipmentsApi.predict(numId).catch(() => ({ data: null })),
    ])
      .then(([s, t, p]) => {
        setShipment(s.data)
        setEvents(t.data)
        setPrediction(p.data)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-400 text-sm py-16 text-center">Loading shipment…</div>
  if (!shipment) return <div className="text-gray-400 text-sm py-16 text-center">Shipment not found</div>

  const riskPct = prediction ? (prediction.delay_probability * 100).toFixed(1) : null
  const riskColor = prediction
    ? prediction.risk_level === 'high' ? 'text-red-600 bg-red-50 border-red-200'
    : prediction.risk_level === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : ''

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/shipments" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 font-mono">{shipment.tracking_number}</h1>
          <p className="text-sm text-gray-500">{shipment.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Shipment info */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400" /> Shipment Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Carrier', shipment.carrier],
              ['Status', shipment.status.replace('_', ' ')],
              ['Origin', shipment.origin_port],
              ['Destination', shipment.destination_port],
              ['Weight', `${shipment.weight_kg} kg`],
              ['Departure', new Date(shipment.departure_date).toLocaleDateString()],
              ['ETA', new Date(shipment.estimated_arrival).toLocaleDateString()],
              ['Actual Arrival', shipment.actual_arrival ? new Date(shipment.actual_arrival).toLocaleDateString() : 'Pending'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-400 font-medium">{k}</dt>
                <dd className="text-gray-800 capitalize mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Delay prediction */}
        {prediction && (
          <div className={`rounded-xl border p-5 ${riskColor}`}>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> Delay Risk
            </h2>
            <p className="text-4xl font-bold mb-1">{riskPct}%</p>
            <p className="text-sm font-medium capitalize mb-3">{prediction.risk_level} risk</p>
            {prediction.predicted_delay_days > 0 && (
              <p className="text-xs">Est. delay: {prediction.predicted_delay_days} day{prediction.predicted_delay_days !== 1 ? 's' : ''}</p>
            )}
            {prediction.factors.length > 0 && (
              <ul className="mt-3 space-y-1">
                {prediction.factors.map((f) => (
                  <li key={f} className="text-xs">• {f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Tracking timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-gray-400" /> Tracking History
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No tracking events recorded yet.</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-4 pl-6">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <div className="absolute -left-[1.65rem] w-3 h-3 rounded-full border-2 border-white bg-gray-300 shadow" />
                <p className="text-xs text-gray-400 mb-0.5">
                  {new Date(ev.timestamp).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{ev.location}</span>
                </div>
                {ev.notes && <p className="text-sm text-gray-500 mt-0.5">{ev.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
