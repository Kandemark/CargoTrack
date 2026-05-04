import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Leaf, TrendingDown, TrendingUp, Loader2 } from 'lucide-react'
import { analyticsApi, type CarbonData } from '@/api/analytics'

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-green-500', A: 'bg-green-400', B: 'bg-yellow-400', C: 'bg-orange-400', D: 'bg-red-500',
}

export default function CarbonTracker() {
  const [data, setData] = useState<CarbonData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsApi.carbon()
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-64 text-gray-400">No carbon data available</div>
  )

  const vsLastMonth = data.monthly[data.monthly.length - 1]?.emissions ?? 0
  const prevMonth = data.monthly[data.monthly.length - 2]?.emissions ?? 0
  const trend = prevMonth > 0 ? ((vsLastMonth - prevMonth) / prevMonth * 100) : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Leaf className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Carbon Tracker</h1>
            <p className="text-green-100 text-sm">Fleet CO₂ emissions and sustainability metrics</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Emissions', value: `${(data.total_kg / 1000).toFixed(1)}t CO₂` },
            { label: 'Carbon Offset', value: `${(data.offset_kg / 1000).toFixed(1)}t CO₂` },
            { label: 'Net Footprint', value: `${(data.net_kg / 1000).toFixed(1)}t CO₂` },
            {
              label: 'vs Last Month',
              value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
              icon: trend >= 0 ? TrendingUp : TrendingDown,
              iconClass: trend >= 0 ? 'text-red-200' : 'text-green-200',
            },
          ].map(m => (
            <div key={m.label} className="bg-white/15 rounded-xl p-4">
              <div className="flex items-center gap-2">
                {m.icon && <m.icon className={`w-4 h-4 ${m.iconClass}`} />}
                <span className="text-green-100 text-xs">{m.label}</span>
              </div>
              <div className="text-xl font-bold mt-1">{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Monthly Emissions vs Offset (kg CO₂)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.monthly}>
            <defs>
              <linearGradient id="em" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="off" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="emissions" name="Emissions" stroke="#ef4444" fill="url(#em)" strokeWidth={2} />
            <Area type="monotone" dataKey="offset" name="Offset" stroke="#22c55e" fill="url(#off)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Carrier emissions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Carrier Emission Score</h2>
        <div className="space-y-3">
          {data.by_carrier.map((c, i) => {
            const maxKg = data.by_carrier[0]?.total_kg || 1
            const pct = Math.round(c.total_kg / maxKg * 100)
            return (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4"
              >
                <span className={`w-8 h-6 rounded text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${GRADE_COLORS[c.grade]}`}>
                  {c.grade}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{c.name}</span>
                    <span className="text-gray-500">{c.total_kg.toLocaleString()} kg CO₂</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div className={`h-2 rounded-full ${GRADE_COLORS[c.grade]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-16 text-right">{c.shipments} trips</span>
              </motion.div>
            )
          })}
          {data.by_carrier.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No emission data yet — run some shipments first</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
