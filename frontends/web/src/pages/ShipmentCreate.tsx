import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Package, AlertTriangle } from 'lucide-react'
import axios from 'axios'
import { shipmentsApi } from '@/api/shipments'
import type { Route } from '@/types'

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

/** Convert a datetime-local string ("YYYY-MM-DDTHH:MM") to an ISO 8601 string. */
function toISO(localStr: string): string {
  return localStr ? `${localStr}:00` : ''
}

interface FormState {
  route:                string
  carrier_name:         string
  weight_kg:            string
  scheduled_departure:  string
  scheduled_arrival:    string
}

const EMPTY: FormState = {
  route:               '',
  carrier_name:        '',
  weight_kg:           '',
  scheduled_departure: '',
  scheduled_arrival:   '',
}

export default function ShipmentCreate() {
  const navigate = useNavigate()

  const [routes, setRoutes]         = useState<Route[]>([])
  const [routesLoading, setRL]      = useState(true)
  const [routesError, setRE]        = useState<string | null>(null)

  const [form, setForm]             = useState<FormState>(EMPTY)
  const [fieldErrors, setFE]        = useState<FieldErrors>({})
  const [generalError, setGE]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    shipmentsApi.getRoutes()
      .then((res) => setRoutes(res.data))
      .catch(() => setRE('Failed to load routes. Refresh the page to retry.'))
      .finally(() => setRL(false))
  }, [])

  function onChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFE((prev) => ({ ...prev, [name]: '' }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFE({})
    setGE(null)
    setSubmitting(true)
    try {
      const { data: shipment } = await shipmentsApi.createShipment({
        route:               Number(form.route),
        carrier_name:        form.carrier_name.trim(),
        weight_kg:           Number(form.weight_kg),
        scheduled_departure: toISO(form.scheduled_departure),
        scheduled_arrival:   toISO(form.scheduled_arrival),
      })
      navigate(`/shipments/${shipment.id}`, { replace: true })
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

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <Link
          to="/shipments"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Shipments
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ct-navy)' }}
          >
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">New Shipment</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create a new cargo shipment on the Northern Corridor</p>
          </div>
        </div>
      </div>

      {/* Route load error */}
      {routesError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {routesError}
        </div>
      )}

      {/* General submit error */}
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
            <h2 className="text-sm font-semibold text-gray-700">Shipment details</h2>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Route */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Route <span className="text-red-500">*</span>
              </label>
              {routesLoading ? (
                <div className="h-9 rounded-lg bg-gray-100 animate-pulse" />
              ) : (
                <select
                  name="route"
                  required
                  value={form.route}
                  onChange={onChange}
                  className={inputClass('route')}
                >
                  <option value="">Select a route…</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.origin} → {r.destination}
                      {' '}({r.distance_km.toLocaleString()} km)
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.route && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.route}</p>
              )}
            </div>

            {/* Carrier + Weight row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Carrier name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="carrier_name"
                  required
                  placeholder="e.g. Kenya Express Logistics"
                  value={form.carrier_name}
                  onChange={onChange}
                  className={inputClass('carrier_name')}
                />
                {fieldErrors.carrier_name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.carrier_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="weight_kg"
                  required
                  min="1"
                  max="150000"
                  step="0.1"
                  placeholder="e.g. 12500"
                  value={form.weight_kg}
                  onChange={onChange}
                  className={inputClass('weight_kg')}
                />
                {fieldErrors.weight_kg && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.weight_kg}</p>
                )}
              </div>
            </div>

            {/* Departure + Arrival row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Scheduled departure <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="scheduled_departure"
                  required
                  value={form.scheduled_departure}
                  onChange={onChange}
                  className={inputClass('scheduled_departure')}
                />
                {fieldErrors.scheduled_departure && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.scheduled_departure}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Scheduled arrival <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="scheduled_arrival"
                  required
                  value={form.scheduled_arrival}
                  onChange={onChange}
                  className={inputClass('scheduled_arrival')}
                />
                {fieldErrors.scheduled_arrival && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.scheduled_arrival}</p>
                )}
              </div>
            </div>

          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            <Link
              to="/shipments"
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || routesLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: 'var(--ct-navy)' }}
            >
              {submitting ? 'Creating…' : 'Create shipment'}
            </button>
          </div>
        </div>
      </form>

    </div>
  )
}
