/**
 * ColdChain.tsx — Cold chain monitoring: temperature tracking, excursions, compliance.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Thermometer, Droplets, AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock, Activity, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { coldchainApi, type ColdChainShipment, type TemperatureExcursion, type ComplianceReport } from '@/api/coldchain'

const SEVERITY_COLORS: Record<string, string> = {
  WARNING: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  BREACH: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  SPOILAGE_ALERT: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
}

function TempStatus({ current, min, max }: { current: number; min: number; max: number }) {
  const ok = current >= min && current <= max
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold',
      ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {current.toFixed(1)}&deg;C
    </span>
  )
}

export default function ColdChain() {
  const [shipments, setShipments] = useState<ColdChainShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const { data } = await coldchainApi.list()
      setShipments(data.results)
    } catch {
      setError('Failed to load cold chain data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function viewReport(id: number) {
    setLoadingReport(true)
    try {
      const { data } = await coldchainApi.complianceReport(id)
      setReport(data)
    } finally {
      setLoadingReport(false)
    }
  }

  const activeExcursions = shipments.reduce((sum, s) => sum + (s.active_excursion ? 1 : 0), 0)
  const compliantCount = shipments.filter((s) => s.certificate?.is_compliant).length

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-white/50">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Cold Chain</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            {shipments.length} monitored · {activeExcursions} active excursions · {compliantCount} compliant
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monitored', value: shipments.length, icon: Thermometer, color: 'text-blue-500' },
          { label: 'Compliant', value: compliantCount, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Excursions', value: activeExcursions, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Avg Temp', value: shipments.length > 0
            ? `${(shipments.reduce((s, x) => s + (x.recent_readings?.[0]?.temperature_c ?? 0), 0) / shipments.length).toFixed(1)}°C`
            : '—', icon: Activity, color: 'text-purple-500' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-4">
            <kpi.icon className={cn('w-5 h-5 mb-2', kpi.color)} />
            <p className="text-lg font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500 dark:text-white/40">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Shipment list */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Thermometer className="w-10 h-10 text-gray-200 dark:text-white/15" />
            <p className="text-sm text-gray-500 dark:text-white/40">No cold chain shipments</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/8">
                  <th className="px-5 py-3 text-left font-medium">Shipment</th>
                  <th className="px-5 py-3 text-left font-medium">Product</th>
                  <th className="px-5 py-3 text-left font-medium">Temp Range</th>
                  <th className="px-5 py-3 text-left font-medium">Latest Reading</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {shipments.map((s) => {
                  const latest = s.recent_readings?.[0]
                  const hasExcursion = !!s.active_excursion
                  return (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={cn('hover:bg-gray-50 dark:hover:bg-white/5 transition-colors', hasExcursion && 'bg-red-50/30 dark:bg-red-900/10')}>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Shipment #{s.shipment}</p>
                        <p className="text-xs text-gray-400 dark:text-white/30 font-mono">{s.monitoring_device_id}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-white/70">{s.product_type}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40 font-mono">
                        {s.temp_min_c}°C – {s.temp_max_c}°C
                      </td>
                      <td className="px-5 py-3.5">
                        {latest ? (
                          <div className="space-y-0.5">
                            <TempStatus current={latest.temperature_c} min={s.temp_min_c} max={s.temp_max_c} />
                            {latest.humidity_pct != null && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Droplets className="w-3 h-3" /> {latest.humidity_pct}%
                              </p>
                            )}
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No readings</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasExcursion ? (
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', SEVERITY_COLORS[s.active_excursion!.severity])}>
                            {s.active_excursion!.severity.replace(/_/g, ' ')}
                          </span>
                        ) : s.certificate?.is_compliant ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Compliant
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-white/40">
                            Monitoring
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => viewReport(s.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400">
                          <FileText className="w-3 h-3" /> Report
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compliance Report Modal */}
      {report && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setReport(null)}>
          <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-[#1a2235] flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Compliance Report — {report.tracking_number}</h2>
              <button onClick={() => setReport(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400">Product</p><p className="font-semibold text-gray-900 dark:text-white">{report.product_type}</p></div>
                <div><p className="text-xs text-gray-400">Compliance</p>
                  <p className={cn('font-semibold', report.certificate?.is_compliant ? 'text-emerald-600' : 'text-red-600')}>
                    {report.compliance_pct.toFixed(1)}%
                  </p>
                </div>
                <div><p className="text-xs text-gray-400">Temp Range</p><p className="font-semibold text-gray-900 dark:text-white">{report.temp_range.min_c}–{report.temp_range.max_c}°C</p></div>
                <div><p className="text-xs text-gray-400">Readings</p><p className="font-semibold text-gray-900 dark:text-white">{report.total_readings}</p></div>
                <div><p className="text-xs text-gray-400">Excursions</p><p className="font-semibold text-gray-900 dark:text-white">{report.excursions.total} ({report.excursions.total_minutes} min)</p></div>
                <div><p className="text-xs text-gray-400">Monitoring Period</p><p className="font-semibold text-gray-900 dark:text-white">{report.monitoring_period_hours.toFixed(1)} hrs</p></div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Temperature Stats</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2"><p className="text-gray-400">Min</p><p className="font-semibold text-gray-900 dark:text-white">{report.temperature_stats.min_c}°C</p></div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2"><p className="text-gray-400">Max</p><p className="font-semibold text-gray-900 dark:text-white">{report.temperature_stats.max_c}°C</p></div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2"><p className="text-gray-400">Avg</p><p className="font-semibold text-gray-900 dark:text-white">{report.temperature_stats.avg_c.toFixed(1)}°C</p></div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2"><p className="text-gray-400">StdDev</p><p className="font-semibold text-gray-900 dark:text-white">{report.temperature_stats.stddev_c.toFixed(1)}°C</p></div>
                </div>
              </div>
              {report.sla?.is_breached && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
                  SLA breached — max excursion: {report.sla.max_excursion_minutes} minutes
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
