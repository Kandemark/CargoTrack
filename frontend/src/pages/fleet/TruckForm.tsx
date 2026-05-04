import { useState, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Truck } from 'lucide-react'
import { fleetApi, type Truck as TruckType } from '@/api/fleet'
import { useEffect } from 'react'

const INITIAL = {
  fleet_id: '', make: '', model: '', year: new Date().getFullYear(),
  plate: '', vin: '', color: 'White',
  payload_tonnes: 10, engine_cc: 8000, fuel_type: 'Diesel',
  fuel_capacity_l: 200, status: 'IDLE' as TruckType['status'],
  odometer_km: 0, load_pct: 0,
}

const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric']
const COLORS = ['White', 'Black', 'Silver', 'Blue', 'Red', 'Green', 'Yellow', 'Orange']
const STATUSES: TruckType['status'][] = ['ACTIVE', 'IDLE', 'MAINTENANCE', 'OFF_DUTY', 'DECOMMISSIONED']

export default function TruckForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isEdit && id) {
      fleetApi.getTruck(Number(id)).then(({ data }) => {
        setForm({
          fleet_id: data.fleet_id, make: data.make, model: data.model,
          year: data.year, plate: data.plate, vin: data.vin || '',
          color: data.color || 'White', payload_tonnes: data.payload_tonnes,
          engine_cc: data.engine_cc || 8000, fuel_type: data.fuel_type,
          fuel_capacity_l: data.fuel_capacity_l || 200, status: data.status,
          odometer_km: data.odometer_km, load_pct: data.load_pct,
        })
      }).catch(() => setError('Failed to load truck.'))
    }
  }, [id, isEdit])

  function onChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'year' || name === 'payload_tonnes' || name === 'engine_cc' ||
        name === 'fuel_capacity_l' || name === 'odometer_km' || name === 'load_pct'
        ? Number(value)
        : value,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isEdit && id) {
        await fleetApi.updateTruck(Number(id), form)
      } else {
        await fleetApi.createTruck(form)
      }
      navigate('/fleet/trucks', { replace: true })
    } catch {
      setError('Failed to save truck. Please check the form and try again.')
    } finally {
      setLoading(false)
    }
  }

  function input(name: string, label: string, opts?: { type?: string; placeholder?: string; col?: boolean }) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <input
          type={opts?.type ?? 'text'}
          name={name}
          value={(form as Record<string, unknown>)[name] as string | number}
          onChange={onChange}
          placeholder={opts?.placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <button
        onClick={() => navigate('/fleet/trucks')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to fleet
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#0f2d5e] flex items-center justify-center">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Truck' : 'Add New Truck'}</h1>
          <p className="text-sm text-gray-500">{isEdit ? `Editing ${form.fleet_id}` : 'Register a new vehicle in the fleet'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Identification */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 mb-3">Identification</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {input('fleet_id', 'Fleet ID', { placeholder: 'e.g. FT-001' })}
            {input('plate', 'License Plate', { placeholder: 'e.g. KCA 123X' })}
            {input('vin', 'VIN (optional)')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
              <select name="color" value={form.color} onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Vehicle details */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 mb-3">Vehicle Details</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {input('make', 'Make', { placeholder: 'e.g. Isuzu' })}
            {input('model', 'Model', { placeholder: 'e.g. FVR 900' })}
            {input('year', 'Year', { type: 'number' })}
            {input('payload_tonnes', 'Payload (tonnes)', { type: 'number' })}
          </div>
        </fieldset>

        {/* Engine + Fuel */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 mb-3">Engine & Fuel</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {input('engine_cc', 'Engine (cc)', { type: 'number' })}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fuel Type</label>
              <select name="fuel_type" value={form.fuel_type} onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {input('fuel_capacity_l', 'Fuel Capacity (L)', { type: 'number' })}
          </div>
        </fieldset>

        {/* Status + metrics */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 mb-3">Status & Metrics</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select name="status" value={form.status} onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            {input('odometer_km', 'Odometer (km)', { type: 'number' })}
            {input('load_pct', 'Load %', { type: 'number' })}
          </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => navigate('/fleet/trucks')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--ct-navy)' }}>
            <Save className="w-4 h-4" />
            {loading ? 'Saving…' : isEdit ? 'Update Truck' : 'Add Truck'}
          </button>
        </div>
      </form>
    </div>
  )
}
