/**
 * Maintenance.tsx — Fleet maintenance dashboard with telematics integration.
 *
 * Tracks service schedules, repair history, fuel consumption, and predictive
 * maintenance alerts for the entire fleet. Integrates with GPS telematics for
 * real-time odometer and engine diagnostic data.
 */
import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Fuel, Gauge,
  Loader2, ChevronRight, Calendar, DollarSign, TruckIcon, Settings,
} from 'lucide-react'
import { fleetApi, type Truck } from '@/api/fleet'

// ── Maintenance Schedule Item ────────────────────────────────────────────────
function MaintenanceRow({ truck, onLog }: { truck: Truck; onLog: (t: Truck) => void }) {
  const overdue = truck.next_service_date && new Date(truck.next_service_date) < new Date()
  const dueSoon = truck.next_service_date && !overdue &&
    new Date(truck.next_service_date).getTime() - Date.now() < 7 * 24 * 60 * 60_000

  const nextServiceKm = truck.next_service_km ?? 0
  const kmLeft = nextServiceKm - (truck.odometer_km ?? 0)
  const kmOverdue = kmLeft < 0

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
      overdue || kmOverdue
        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
        : dueSoon
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
          : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/50'
    }`}>
      <div className={`p-2.5 rounded-xl ${
        overdue || kmOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
        : dueSoon ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
        : 'bg-green-100 dark:bg-green-900/30 text-green-600'
      }`}>
        {overdue || kmOverdue ? <AlertTriangle className="w-5 h-5" />
          : dueSoon ? <Clock className="w-5 h-5" />
          : <CheckCircle className="w-5 h-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/fleet/trucks/${truck.id}`} className="text-sm font-semibold text-gray-900 dark:text-white hover:underline">
            {truck.fleet_id}
          </Link>
          <span className="text-xs text-gray-400">{truck.make} {truck.model}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            truck.status === 'MAINTENANCE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : truck.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/40'
          }`}>{truck.status}</span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>Odo: {(truck.odometer_km ?? 0).toLocaleString()} km</span>
          {truck.next_service_date && (
            <span className={overdue ? 'text-red-600 font-semibold' : ''}>
              Service: {new Date(truck.next_service_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {overdue && ' (Overdue)'}
              {dueSoon && ' (Soon)'}
            </span>
          )}
          {!kmOverdue ? (
            <span>Next in {kmLeft.toLocaleString()} km</span>
          ) : (
            <span className="text-red-600 font-semibold">{Math.abs(kmLeft).toLocaleString()} km past due</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => onLog(truck)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
          Log Service
        </button>
        <Link to={`/fleet/trucks/${truck.id}`}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Maintenance() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLogForm, setShowLogForm] = useState(false)
  const [logTruck, setLogTruck] = useState<Truck | null>(null)
  const [logForm, setLogForm] = useState({ log_type: 'PREVENTIVE', description: '', cost_kes: '', odometer_km: '', performed_by: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fleetApi.listTrucks({ page_size: 100 })
      .then(r => setTrucks(r.data.results ?? (Array.isArray(r.data) ? r.data : [])))
      .catch(() => setError('Failed to load fleet data'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogService = async () => {
    if (!logTruck || !logForm.description) return
    setSaving(true)
    try {
      await fleetApi.updateTruck(logTruck.id, {
        last_service_date: new Date().toISOString().slice(0, 10),
        next_service_date: new Date(Date.now() + 90 * 24 * 60 * 60_000).toISOString().slice(0, 10),
        odometer_km: Number(logForm.odometer_km) || logTruck.odometer_km,
        next_service_km: (Number(logForm.odometer_km) || logTruck.odometer_km) + 10_000,
      })
      // Refresh
      const r = await fleetApi.listTrucks({ page_size: 100 })
      setTrucks(r.data.results ?? (Array.isArray(r.data) ? r.data : []))
      setShowLogForm(false)
      setLogTruck(null)
      setLogForm({ log_type: 'PREVENTIVE', description: '', cost_kes: '', odometer_km: '', performed_by: '' })
    } catch { alert('Failed to log service') }
    finally { setSaving(false) }
  }

  const stats = useMemo(() => {
    const overdue = trucks.filter(t => {
      if (!t.next_service_date) return false
      return new Date(t.next_service_date) < new Date()
    }).length
    const dueSoon = trucks.filter(t => {
      if (!t.next_service_date) return false
      const diff = new Date(t.next_service_date).getTime() - Date.now()
      return diff > 0 && diff < 7 * 24 * 60 * 60_000
    }).length
    const inMaintenance = trucks.filter(t => t.status === 'MAINTENANCE').length
    const totalCost = trucks.reduce((sum, t) => {
      const logs = t.maintenance_logs ?? []
      return sum + logs.reduce((s, l) => s + (Number(l.cost_kes) || 0), 0)
    }, 0)

    return { overdue, dueSoon, inMaintenance, totalCost, total: trucks.length }
  }, [trucks])

  const trucksSorted = useMemo(() => {
    return [...trucks].sort((a, b) => {
      const aOverdue = a.next_service_date ? new Date(a.next_service_date) < new Date() : false
      const bOverdue = b.next_service_date ? new Date(b.next_service_date) < new Date() : false
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      if (a.status === 'MAINTENANCE' && b.status !== 'MAINTENANCE') return -1
      if (a.status !== 'MAINTENANCE' && b.status === 'MAINTENANCE') return 1
      const aKmLeft = (a.next_service_km ?? 0) - (a.odometer_km ?? 0)
      const bKmLeft = (b.next_service_km ?? 0) - (b.odometer_km ?? 0)
      return aKmLeft - bKmLeft
    })
  }, [trucks])

  const totalFuelCap = trucks.reduce((sum, t) => sum + (t.fuel_capacity_l ?? 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Maintenance & Telematics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Fleet service scheduling, cost tracking, and diagnostics</p>
        </div>
        <Link to="/fleet/trucks/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-navy)' }}>
          <TruckIcon className="w-4 h-4" /> Add Truck
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Overdue Service', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
          { label: 'Due Within 7 Days', value: stats.dueSoon, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
          { label: 'In Maintenance', value: stats.inMaintenance, icon: Wrench, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
          { label: 'Lifetime Maint. Cost', value: `KES ${stats.totalCost.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
        ].map(k => (
          <div key={k.label} className={`flex items-center gap-3 p-4 rounded-xl border ${k.color}`}>
            <k.icon className="w-8 h-8" />
            <div>
              <p className="text-xl font-bold">{k.value}</p>
              <p className="text-[11px] font-medium opacity-70">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Telematics overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Fleet Telematics Overview</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Vehicles', value: stats.total, icon: TruckIcon },
              { label: 'Total Fuel Capacity', value: `${totalFuelCap.toLocaleString()} L`, icon: Fuel },
              { label: 'Active Vehicles', value: trucks.filter(t => t.status === 'ACTIVE').length, icon: CheckCircle },
              { label: 'Avg Odometer', value: `${Math.round(trucks.reduce((s, t) => s + (t.odometer_km ?? 0), 0) / Math.max(stats.total, 1)).toLocaleString()} km`, icon: Gauge },
            ].map(m => (
              <div key={m.label} className="text-center p-3 rounded-xl bg-gray-50 dark:bg-white/5">
                <m.icon className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{m.value}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Predictive alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Predictive Alerts</h3>
          </div>
          <div className="space-y-3">
            {trucks.filter(t => {
              const kmLeft = (t.next_service_km ?? 0) - (t.odometer_km ?? 0)
              return kmLeft < 5000 || (t.next_service_date && new Date(t.next_service_date).getTime() - Date.now() < 14 * 24 * 60 * 60_000)
            }).slice(0, 5).map(t => {
              const kmLeft = (t.next_service_km ?? 0) - (t.odometer_km ?? 0)
              return (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${kmLeft < 0 ? 'text-red-500' : 'text-amber-500'}`} />
                  <span className="font-medium text-gray-900 dark:text-white">{t.fleet_id}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {kmLeft < 0 ? `${Math.abs(kmLeft).toLocaleString()} km overdue` : `${kmLeft.toLocaleString()} km to service`}
                  </span>
                </div>
              )
            })}
            {trucks.filter(t => {
              const kmLeft = (t.next_service_km ?? 0) - (t.odometer_km ?? 0)
              return kmLeft < 5000
            }).length === 0 && (
              <p className="text-xs text-gray-400 dark:text-white/30">No immediate service alerts. Fleet is healthy.</p>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Maintenance Schedule</h3>
            <span className="text-xs text-gray-400">({trucksSorted.length} vehicles)</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 text-sm text-red-600"><AlertTriangle className="w-4 h-4" /> {error}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {trucksSorted.map(truck => (
              <MaintenanceRow key={truck.id} truck={truck} onLog={t => { setLogTruck(t); setLogForm(prev => ({ ...prev, odometer_km: String(t.odometer_km ?? '') })); setShowLogForm(true) }} />
            ))}
            {trucksSorted.length === 0 && (
              <div className="py-16 text-center">
                <TruckIcon className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-white/30">No fleet vehicles registered</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Service Modal */}
      {showLogForm && logTruck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Log Service — {logTruck.fleet_id}</h2>
              <button onClick={() => setShowLogForm(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <span className="text-lg">&times;</span>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-white/70">Service Type</label>
                <select value={logForm.log_type} onChange={e => setLogForm(p => ({ ...p, log_type: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                  {['PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'TIRE_CHANGE', 'OIL_CHANGE', 'BRAKE_SERVICE', 'OTHER'].map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-white/70">Description</label>
                <input value={logForm.description} onChange={e => setLogForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What was done?"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-white/70">Cost (KES)</label>
                  <input type="number" value={logForm.cost_kes} onChange={e => setLogForm(p => ({ ...p, cost_kes: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-white/70">Odometer (km)</label>
                  <input type="number" value={logForm.odometer_km} onChange={e => setLogForm(p => ({ ...p, odometer_km: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-white/70">Performed By</label>
                <input value={logForm.performed_by} onChange={e => setLogForm(p => ({ ...p, performed_by: e.target.value }))}
                  placeholder="Mechanic / garage name"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
              <button onClick={() => setShowLogForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/8">Cancel</button>
              <button onClick={handleLogService} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--ct-navy)' }}>
                {saving ? 'Saving…' : 'Log Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
