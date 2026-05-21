import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, AlertTriangle } from 'lucide-react'
import axios from 'axios'
import { shipmentsApi } from '@/api/shipments'
import type { Shipment } from '@/types'

type FieldErrors = Record<string, string>

function parseApiErrors(err: unknown): { fields: FieldErrors; general: string | null } {
  if (axios.isAxiosError(err) && err.response?.status === 400) {
    const raw = err.response.data as Record<string, string | string[]>
    const fields: FieldErrors = {}
    let general: string | null = null
    for (const [key, val] of Object.entries(raw)) {
      const msg = Array.isArray(val) ? val[0] : val
      if (key === 'non_field_errors' || key === 'detail') general = msg
      else fields[key] = msg
    }
    return { fields, general }
  }
  return { fields: {}, general: 'An unexpected error occurred. Please try again.' }
}

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'DEPARTURE',     label: 'Departure' },
  { value: 'CHECKPOINT',    label: 'Checkpoint' },
  { value: 'CUSTOMS_ENTRY', label: 'Customs Entry' },
  { value: 'CUSTOMS_CLEAR', label: 'Customs Clear' },
  { value: 'ARRIVAL',       label: 'Arrival' },
  { value: 'DELAY',         label: 'Delay Reported' },
  { value: 'NOTE',          label: 'Note' },
]

export default function LogEvent() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const shipmentId = Number(id)

  const [shipment, setShipment]     = useState<Shipment | null>(null)
  const [loadError, setLoadError]   = useState<string | null>(null)

  const [eventType, setEventType]   = useState('')
  const [location, setLocation]     = useState('')
  const [notes, setNotes]           = useState('')

  const [fieldErrors, setFE]        = useState<FieldErrors>({})
  const [generalError, setGE]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    shipmentsApi.getShipment(shipmentId)
      .then((res) => setShipment(res.data))
      .catch(() => setLoadError('Shipment not found or you do not have access.'))
  }, [shipmentId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFE({})
    setGE(null)
    setSubmitting(true)
    try {
      await shipmentsApi.createTrackingEvent(shipmentId, {
        event_type: eventType,
        location:   location.trim(),
        notes:      notes.trim(),
      })
      navigate(`/shipments/${shipmentId}`, { replace: true })
    } catch (err) {
      const { fields, general } = parseApiErrors(err)
      setFE(fields)
      setGE(general)
    } finally {
      setSubmitting(false)
    }
  }

  function inputClass(name: string) {
    return [
      'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors',
      fieldErrors[name]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-gray-300 focus:ring-blue-500',
    ].join(' ')
  }

  if (loadError) {
    return (
      <div className="max-w-lg space-y-4">
        <Link
          to={`/shipments/${shipmentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">

      {/* Header */}
      <div>
        <Link
          to={`/shipments/${shipmentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {shipment ? (
            <span className="font-mono font-semibold">{shipment.tracking_number}</span>
          ) : (
            'Back to shipment'
          )}
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ct-navy)' }}
          >
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Log Tracking Event</h1>
            {shipment ? (
              <p className="text-sm text-gray-500 mt-0.5">
                {shipment.route.origin} → {shipment.route.destination}
              </p>
            ) : (
              <div className="h-4 w-40 rounded bg-gray-100 animate-pulse mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* Shipment identity chip */}
      {shipment && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-500">Shipment</span>
          <span className="font-mono font-semibold text-gray-800">{shipment.tracking_number}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{shipment.carrier_name}</span>
        </div>
      )}

      {/* General error */}
      {generalError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {generalError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Event details</h2>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Event type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value)
                  setFE((p) => ({ ...p, event_type: '' }))
                }}
                className={inputClass('event_type')}
              >
                <option value="">Select event type…</option>
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {fieldErrors.event_type && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.event_type}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mombasa Port Gate 3"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  setFE((p) => ({ ...p, location: '' }))
                }}
                className={inputClass('location')}
              />
              {fieldErrors.location && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.location}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Additional context about this event…"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setFE((p) => ({ ...p, notes: '' }))
                }}
                className={[inputClass('notes'), 'resize-none'].join(' ')}
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.notes}</p>
              )}
            </div>

          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            <Link
              to={`/shipments/${shipmentId}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !shipment}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: 'var(--ct-navy)' }}
            >
              {submitting ? 'Logging…' : 'Log event'}
            </button>
          </div>
        </div>
      </form>

    </div>
  )
}
