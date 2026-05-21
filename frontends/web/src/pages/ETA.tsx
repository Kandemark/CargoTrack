/**
 * ETA.tsx — Real-time ETA tracking with batch fleet overview.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, MapPin, Truck, Search, RefreshCw, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { etaApi, type ETAResult, type BatchETAResult } from '@/api/eta'

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

export default function ETA() {
  const [tracking, setTracking] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [speed, setSpeed] = useState('')
  const [result, setResult] = useState<ETAResult | null>(null)
  const [batchResult, setBatchResult] = useState<BatchETAResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'single' | 'batch'>('single')

  async function lookupETA(e: React.FormEvent) {
    e.preventDefault()
    if (!tracking || !lat || !lon) return
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await etaApi.get({
        tracking, lat: parseFloat(lat), lon: parseFloat(lon),
        ...(speed ? { speed: parseFloat(speed) } : {}),
      })
      setResult(data)
    } catch {
      setError('Failed to fetch ETA.')
    } finally {
      setLoading(false)
    }
  }

  async function batchETA() {
    setLoading(true); setError(null)
    try {
      // Use demo positions — in production these come from live fleet tracking
      const { data } = await etaApi.batch([
        { tracking: 'CT-001', lat: -1.2921, lon: 36.8219, speed: 60 },  // Nairobi
        { tracking: 'CT-002', lat: -4.0435, lon: 39.6682, speed: 45 },  // Mombasa
        { tracking: 'CT-003', lat: -6.7924, lon: 39.2083, speed: 55 },  // Dar es Salaam
        { tracking: 'CT-004', lat: 0.3136, lon: 32.5811, speed: 40 },    // Kampala
        { tracking: 'CT-005', lat: -1.9441, lon: 30.0619, speed: 50 },   // Kigali
      ])
      setBatchResult(data)
    } catch {
      setError('Batch ETA failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">ETA Tracker</h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">Real-time arrival estimates with border crossing awareness</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg bg-gray-100 dark:bg-white/5 p-0.5">
          {(['single', 'batch'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                tab === t ? 'bg-white dark:bg-white/15 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/40')}>
              {t === 'single' ? 'Single Shipment' : 'Fleet Batch'}
            </button>
          ))}
        </div>
      </div>

      {/* Single ETA form */}
      {tab === 'single' && (
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
          <form onSubmit={lookupETA} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <input value={tracking} onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking # (e.g. CT-12345)"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input value={lat} onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input value={lon} onChange={(e) => setLon(e.target.value)}
              placeholder="Longitude"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="submit" disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--ct-orange)' }}>
              {loading ? 'Calculating…' : 'Get ETA'}
            </button>
          </form>
          {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-3 mt-4 border-t border-gray-100 dark:border-white/8 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{result.origin} <ArrowRight className="inline w-3 h-3" /> {result.destination}</p>
                  <span className="text-xs text-gray-400">{result.tracking_number}</span>
                </div>
                <ProgressBar pct={result.progress_pct} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">ETA</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {result.estimated_arrival ? new Date(result.estimated_arrival).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Remaining</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{result.estimated_remaining_hours.toFixed(1)} hrs</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Distance</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{result.distance_remaining_km} / {result.total_distance_km} km</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Speed</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{result.current_speed_kmh} km/h</p>
                  </div>
                </div>
                {result.upcoming_border && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Upcoming border: {result.upcoming_border} (est. {result.border_wait_minutes} min wait)
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  Confidence range: {result.confidence_low ? new Date(result.confidence_low).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} — {result.confidence_high ? new Date(result.confidence_high).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Batch ETA */}
      {tab === 'batch' && (
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600 dark:text-white/60">Fleet-wide ETA calculation for active shipments</p>
            <button onClick={batchETA} disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--ct-navy)' }}>
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Calculate All
            </button>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-3">{error}</p>}
          {batchResult ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/8">
                    <th className="px-4 py-2 text-left font-medium">Shipment</th>
                    <th className="px-4 py-2 text-left font-medium">ETA</th>
                    <th className="px-4 py-2 text-left font-medium">Remaining</th>
                    <th className="px-4 py-2 text-left font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {batchResult.results.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      {'error' in r ? (
                        <td colSpan={4} className="px-4 py-3 text-xs text-red-500">{r.error}</td>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 dark:text-white">{r.tracking_number}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 dark:text-white/70">
                            {r.estimated_arrival ? new Date(r.estimated_arrival).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{r.estimated_remaining_hours.toFixed(1)} hrs</td>
                          <td className="px-4 py-3">
                            <ProgressBar pct={r.progress_pct} />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 gap-3">
              <Truck className="w-10 h-10 text-gray-200 dark:text-white/15" />
              <p className="text-sm text-gray-400">Click "Calculate All" to fetch fleet ETAs</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
