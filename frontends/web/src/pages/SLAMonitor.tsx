import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Loader2, ArrowUpDown } from 'lucide-react'
import { analyticsApi, type SLAData, type SLAItem } from '@/api/analytics'

const SLA_COLORS: Record<string, string> = {
  ON_TIME: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  AT_RISK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BREACHED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

type SortField = 'breach_hours' | 'carrier' | 'route' | 'scheduled_arrival'
type SortDir = 'asc' | 'desc'

export default function SLAMonitor() {
  const [data, setData] = useState<SLAData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortField, setSortField] = useState<SortField>('breach_hours')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const load = () => {
    setLoading(true)
    analyticsApi.sla({ status: statusFilter === 'ALL' ? undefined : statusFilter })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sorted = [...(data?.items ?? [])].sort((a, b) => {
    const va = a[sortField as keyof SLAItem]
    const vb = b[sortField as keyof SLAItem]
    const cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Carrier SLA breakdown for bar chart
  const carrierMap: Record<string, { name: string; total: number; on_time: number }> = {}
  for (const item of data?.items ?? []) {
    if (!carrierMap[item.carrier]) carrierMap[item.carrier] = { name: item.carrier, total: 0, on_time: 0 }
    carrierMap[item.carrier].total++
    if (item.sla_status === 'ON_TIME') carrierMap[item.carrier].on_time++
  }
  const carrierChart = Object.values(carrierMap).map(c => ({
    name: c.name.split(' ')[0],
    compliance: Math.round(c.on_time / c.total * 100),
  })).slice(0, 8)

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-64 text-gray-400">No SLA data available</div>
  )

  const gaugeColor = data.compliance_pct >= 90 ? '#22c55e' : data.compliance_pct >= 75 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SLA Monitor</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track service level agreement compliance across all shipments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Overall Compliance</h2>
          <div className="relative w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="60%" outerRadius="90%" data={[{ value: data.compliance_pct, fill: gaugeColor }]} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: gaugeColor }}>{data.compliance_pct}%</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">SLA Met</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 w-full text-center text-sm">
            <div><div className="font-bold text-green-600">{data.on_time}</div><div className="text-xs text-gray-500">On Time</div></div>
            <div><div className="font-bold text-amber-500">{data.at_risk}</div><div className="text-xs text-gray-500">At Risk</div></div>
            <div><div className="font-bold text-red-500">{data.breached}</div><div className="text-xs text-gray-500">Breached</div></div>
          </div>
        </motion.div>

        {/* Carrier compliance bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Carrier SLA Compliance (%)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={carrierChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Compliance']} />
              <Bar dataKey="compliance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Filter + Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap">
          {['ALL', 'ON_TIME', 'AT_RISK', 'BREACHED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 self-center">{sorted.length} shipments</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {[
                  ['Tracking #', null],
                  ['Carrier', 'carrier'],
                  ['Route', 'route'],
                  ['Scheduled Arrival', 'scheduled_arrival'],
                  ['Breach (hrs)', 'breach_hours'],
                  ['Status', null],
                ].map(([label, field]) => (
                  <th
                    key={label as string}
                    onClick={() => field && toggleSort(field as SortField)}
                    className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap ${field ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {field && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">{item.tracking_number}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.carrier}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{item.route}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                    {new Date(item.scheduled_arrival).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                    {item.breach_hours > 0 ? `+${item.breach_hours}h` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SLA_COLORS[item.sla_status]}`}>
                      {item.sla_status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No records match the current filter</div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
