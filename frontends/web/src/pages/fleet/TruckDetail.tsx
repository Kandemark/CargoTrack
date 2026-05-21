import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Truck, Edit, MessageCircle, Phone, MapPin,
  Gauge, Package, Wrench, Calendar, Fuel, Clock, TrendingUp,
  Activity, AlertTriangle,
} from 'lucide-react'
import { fleetApi, type Truck as TruckType } from '@/api/fleet'
import { useAuthStore } from '@/store/authStore'

// ─── Truck Load Visual ──────────────────────────────────────────────────────────

function TruckLoadVisual({ pct }: { pct: number }) {
  const fill = Math.max(0, Math.min(100, pct))
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Load Capacity</h3>
      <div className="flex items-end gap-3">
        {/* SVG truck silhouette */}
        <svg viewBox="0 0 120 60" className="w-32 h-16">
          {/* Cargo bed */}
          <rect x="10" y="10" width="70" height="35" rx="2" fill="#e5e7eb" />
          <rect x="10" y={10 + (35 * (1 - fill / 100))} width="70" height={35 * fill / 100} rx="2" fill="#f5801e" opacity="0.8" />
          {/* Cab */}
          <rect x="80" y="5" width="30" height="40" rx="2" fill="#d1d5db" />
          <rect x="85" y="10" width="12" height="12" rx="1" fill="#9ca3af" />
          <rect x="100" y="10" width="12" height="12" rx="1" fill="#9ca3af" />
          {/* Wheels */}
          <circle cx="30" cy="52" r="8" fill="#374151" />
          <circle cx="30" cy="52" r="3" fill="#6b7280" />
          <circle cx="90" cy="52" r="8" fill="#374151" />
          <circle cx="90" cy="52" r="3" fill="#6b7280" />
        </svg>
        <div>
          <span className="text-3xl font-bold text-gray-900">{fill.toFixed(0)}%</span>
          <span className="text-sm text-gray-400 ml-1">loaded</span>
          <div className="mt-1 h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#f5801e] transition-all duration-500" style={{ width: `${fill}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Driver Info Card ───────────────────────────────────────────────────────────

function DriverInfoCard({
  name, phone, rating, truckInfo, onChat,
}: {
  name: string | null
  phone: string | null
  rating: number | null
  truckInfo: { fleet_id: string; plate: string } | null
  onChat: () => void
}) {
  if (!name) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 flex flex-col items-center gap-2">
        <Truck className="w-6 h-6 text-gray-200" />
        <p className="text-sm text-gray-400">No driver assigned</p>
      </div>
    )
  }

  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Driver</h3>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-[#0f2d5e] flex items-center justify-center text-white font-bold text-lg">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{name}</p>
          {rating != null && (
            <p className="text-sm text-amber-500">
              {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))} {rating.toFixed(1)}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {phone && (
          <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <Phone className="w-3.5 h-3.5" /> {phone}
          </a>
        )}
        {truckInfo && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Truck className="w-3.5 h-3.5" /> {truckInfo.fleet_id} · {truckInfo.plate}
          </p>
        )}
        <button
          onClick={onChat}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--ct-navy)' }}
        >
          <MessageCircle className="w-4 h-4" />
          Chat with driver
        </button>
      </div>
    </div>
  )
}

// ─── Metrics Card ───────────────────────────────────────────────────────────────

function TruckMetricsCard({ truck }: { truck: TruckType }) {
  const metrics = [
    { label: 'Odometer', value: `${(truck.odometer_km || 0).toLocaleString()} km`, icon: Gauge, color: '#0f2d5e' },
    { label: 'Payload', value: `${truck.payload_tonnes} t`, icon: Package, color: '#f5801e' },
    { label: 'Last Service', value: truck.last_service_date ? new Date(truck.last_service_date).toLocaleDateString() : '—', icon: Wrench, color: '#22c55e' },
    { label: 'Next Service', value: truck.next_service_date ? new Date(truck.next_service_date).toLocaleDateString() : '—', icon: Calendar, color: '#8b5cf6' },
    { label: 'Fuel', value: truck.fuel_type, icon: Fuel, color: '#ef4444' },
    { label: 'Engine', value: truck.engine_cc ? `${(truck.engine_cc / 1000).toFixed(1)}L` : '—', icon: Activity, color: '#3b82f6' },
  ]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {metrics.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col items-center text-center">
          <Icon className="w-5 h-5 mb-1.5" style={{ color }} />
          <span className="text-sm font-bold text-gray-800">{value}</span>
          <span className="text-[10px] text-gray-400 mt-1">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Maintenance Timeline ───────────────────────────────────────────────────────

function MaintenanceTimeline({ logs }: { logs: TruckType['maintenance_logs'] }) {
  if (logs.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-800">Maintenance History</h3>
        <span className="ml-auto text-xs text-gray-400">{logs.length} records</span>
      </div>
      <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
        {logs.slice(0, 15).map((log, i) => (
          <div key={log.id || i} className="px-5 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${log.log_type === 'REPAIR' ? 'bg-red-400' : log.log_type === 'INSPECTION' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                <span className="text-xs font-semibold text-gray-800">{log.log_type.replace(/_/g, ' ')}</span>
              </div>
              {log.description && <p className="text-xs text-gray-400 truncate mt-0.5 ml-4">{log.description}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-gray-700">KES {Number(log.cost_kes).toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">{new Date(log.performed_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function TruckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [truck, setTruck] = useState<TruckType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fleetApi.getTruck(Number(id))
      .then(({ data }) => { setTruck(data); setLoading(false) })
      .catch(() => { setError('Failed to load truck.'); setLoading(false) })
  }, [id])

  function handleChatWithDriver() {
    if (truck?.assigned_driver) {
      navigate(`/messages?driver=${truck.assigned_driver}`, { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-[#0f2d5e] rounded-full" />
      </div>
    )
  }

  if (error || !truck) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error ?? 'Truck not found.'}</p>
        <Link to="/fleet/trucks" className="text-blue-600 text-sm hover:underline">Back to fleet</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      {/* Nav */}
      <button onClick={() => navigate('/fleet/trucks')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to fleet
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{truck.fleet_id}</h1>
          <p className="text-sm text-gray-500">{truck.year} {truck.make} {truck.model} · {truck.plate}</p>
          {truck.current_location && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {truck.current_location}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/fleet/trucks/${truck.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Edit className="w-4 h-4" /> Edit
          </Link>
        </div>
      </div>

      {/* Load visual + Driver side by side */}
      <div className="grid sm:grid-cols-2 gap-4">
        <TruckLoadVisual pct={truck.load_pct || 0} />
        <DriverInfoCard
          name={truck.assigned_driver_name ?? null}
          phone={null} // fleet API can be extended to include driver phone
          rating={null}
          truckInfo={null}
          onChat={handleChatWithDriver}
        />
      </div>

      {/* Metrics */}
      <TruckMetricsCard truck={truck} />

      {/* Maintenance Timeline + placeholder for job history */}
      <div className="grid lg:grid-cols-2 gap-4">
        <MaintenanceTimeline logs={truck.maintenance_logs} />

        {/* Job History stub */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-800">Job History</h3>
          </div>
          <div className="p-6 flex flex-col items-center justify-center text-gray-400 gap-2">
            <TrendingUp className="w-8 h-8 opacity-20" />
            <p className="text-sm">Job history will populate as the truck completes shipments.</p>
          </div>
        </div>
      </div>

      {/* Fuel consumption chart stub */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Fuel Consumption</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          Fuel consumption chart will be available once mileage data is collected.
        </div>
      </div>
    </div>
  )
}
