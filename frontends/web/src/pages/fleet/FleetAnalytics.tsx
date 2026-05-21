import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Truck, TrendingUp, Gauge, Activity, Package,
  Fuel, BarChart3, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { fleetApi, type FleetStats, type Truck as TruckType } from '@/api/fleet'

export default function FleetAnalytics() {
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null)
  const [trucks, setTrucks] = useState<TruckType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [statsRes, trucksRes] = await Promise.all([
        fleetApi.fleetStats(),
        fleetApi.listTrucks({ page_size: 200 }),
      ])
      setFleetStats(statsRes.data)
      const td: any = trucksRes.data
      setTrucks(td.results ?? (Array.isArray(td) ? td : []))
    } catch {
      setError('Failed to load fleet analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  const activeTrucks = trucks.filter((t) => t.status === 'ACTIVE').length
  const avgLoad = trucks.length > 0
    ? trucks.reduce((s, t) => s + (t.load_pct || 0), 0) / trucks.length
    : 0
  const totalKM = trucks.reduce((s, t) => s + (t.odometer_km || 0), 0)

  const kpis = [
    { label: 'Total Vehicles', value: fleetStats?.trucks ?? trucks.length, icon: Truck, color: '#0f2d5e' },
    { label: 'Active on Road', value: activeTrucks, icon: Activity, color: '#22c55e' },
    { label: 'Fleet Utilisation', value: `${fleetStats?.fleet_utilisation != null ? (fleetStats.fleet_utilisation * 100).toFixed(0) : '—'}%`, icon: Gauge, color: '#f5801e' },
    { label: 'Avg Load', value: `${avgLoad.toFixed(0)}%`, icon: Package, color: '#3b82f6' },
    { label: 'Total KM', value: `${totalKM.toLocaleString()} km`, icon: TrendingUp, color: '#8b5cf6' },
    { label: 'Drivers on Route', value: fleetStats?.drivers_on_route ?? 0, icon: Fuel, color: '#ef4444' },
  ]

  return (
    <div className="space-y-5 pb-4 px-1">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Fleet Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
          Performance overview of the entire fleet
        </p>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${color}15` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">
              {loading ? '—' : value}
            </p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Fleet utilisation donut */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Fleet Utilisation</h3>
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-36 h-36">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="#f5801e" strokeWidth="12"
                strokeDasharray={`${((fleetStats?.fleet_utilisation ?? 0) * 314).toFixed(1)} 314`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="57" textAnchor="middle" className="text-xl font-bold" fill="currentColor">
                {fleetStats?.fleet_utilisation != null ? `${(fleetStats.fleet_utilisation * 100).toFixed(0)}%` : '—'}
              </text>
              <text x="60" y="75" textAnchor="middle" className="text-xs" fill="#9ca3af">utilised</text>
            </svg>
          </div>
          <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f5801e]" /> Active</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#e5e7eb]" /> Idle</span>
          </div>
        </div>

        {/* Vehicles on road by status */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Vehicles on Road</h3>
          <div className="space-y-3">
            {[
              { label: 'Active', count: trucks.filter((t) => t.status === 'ACTIVE').length, color: '#22c55e' },
              { label: 'Idle', count: trucks.filter((t) => t.status === 'IDLE').length, color: '#94a3b8' },
              { label: 'Maintenance', count: trucks.filter((t) => t.status === 'MAINTENANCE').length, color: '#f59e0b' },
              { label: 'Off Duty', count: trucks.filter((t) => t.status === 'OFF_DUTY').length, color: '#ef4444' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-500">{label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${trucks.length > 0 ? (count / trucks.length) * 100 : 0}%`, background: color }} />
                </div>
                <span className="w-8 text-xs font-semibold text-gray-700 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top trucks by distance */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Top Trucks by Distance</h3>
          <div className="space-y-2">
            {[...trucks]
              .sort((a, b) => (b.odometer_km || 0) - (a.odometer_km || 0))
              .slice(0, 5)
              .map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-gray-400 font-bold">#{i + 1}</span>
                  <span className="flex-1 font-semibold text-gray-700 truncate">{t.fleet_id}</span>
                  <span className="text-gray-500">{(t.odometer_km || 0).toLocaleString()} km</span>
                </div>
              ))}
            {trucks.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data.</p>}
          </div>
        </div>
      </div>

      {/* Shipment Overview (stub) */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/6 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">Shipment Overview</h3>
        </div>
        <div className="p-6 text-center text-sm text-gray-400">
          Shipment overview table will populate as trucks are dispatched and shipments progress.
          Track KPIs including on-time delivery rate, average route distance, and per-carrier performance.
        </div>
      </div>
    </div>
  )
}
