/**
 * ProbabilityChart.tsx — Kalshi-style binary outcome probability chart.
 *
 * Shows delivery on-time probability and customs clearance probability
 * as area charts with gradient fills (green above 50%, red below).
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Loader2, TrendingUp, ShieldCheck } from 'lucide-react'
import apiClient from '@/api/client'

interface ProbabilityPoint {
  date: string
  delivery_probability: number
  customs_probability: number
}

export default function ProbabilityChart() {
  const [data, setData] = useState<ProbabilityPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient.get<ProbabilityPoint[]>('/api/v1/analytics/probability/')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load probability data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error) return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
  if (!data.length) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No probability data yet</div>

  const latest = data[data.length - 1]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Delivery On-Time Probability
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {(latest.delivery_probability * 100).toFixed(1)}%
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              latest.delivery_probability >= 0.7
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : latest.delivery_probability >= 0.5
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {latest.delivery_probability >= 0.7 ? 'High Confidence' : latest.delivery_probability >= 0.5 ? 'Moderate' : 'At Risk'}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Customs Clearance Probability
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {(latest.customs_probability * 100).toFixed(1)}%
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              latest.customs_probability >= 0.7
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : latest.customs_probability >= 0.5
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {latest.customs_probability >= 0.7 ? 'Smooth' : latest.customs_probability >= 0.5 ? 'Some Hurdles' : 'Delays Expected'}
            </span>
          </div>
        </div>
      </div>

      {/* Delivery probability chart */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Delivery On-Time Probability</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="probGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="probRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} stroke="#9ca3af" />
            <Tooltip formatter={(v: any) => `${(Number(v ?? 0) * 100).toFixed(1)}%`} />
            <ReferenceLine y={0.5} stroke="#6b7280" strokeDasharray="5 5" label={{ value: '50%', position: 'right', fontSize: 10, fill: '#9ca3af' }} />
            <Area type="monotone" dataKey="delivery_probability" stroke="#22c55e" fill="url(#probGreen)" strokeWidth={2} name="On-Time Probability" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Customs probability chart */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Customs Clearance Probability</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="custBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} stroke="#9ca3af" />
            <Tooltip formatter={(v: any) => `${(Number(v ?? 0) * 100).toFixed(1)}%`} />
            <ReferenceLine y={0.5} stroke="#6b7280" strokeDasharray="5 5" />
            <Area type="monotone" dataKey="customs_probability" stroke="#3b82f6" fill="url(#custBlue)" strokeWidth={2} name="Clearance Probability" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
