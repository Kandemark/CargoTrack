import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { analyticsApi, type ProfitData } from '@/api/analytics'
import DateRangePicker from '@/components/analytics/DateRangePicker'
import RoutePerformanceTable from '@/components/analytics/RoutePerformanceTable'

const fade = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }

export default function AnalyticsProfit() {
  const [data, setData] = useState<ProfitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<{ date_from?: string; date_to?: string }>({})

  useEffect(() => {
    setLoading(true)
    analyticsApi.profit(range)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load profit analytics'))
      .finally(() => setLoading(false))
  }, [range])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )

  if (error || !data) return (
    <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
  )

  const fmtKES = (v: number) => v >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(2)}M` : `KES ${(v / 1_000).toFixed(0)}K`

  const kpis = [
    { label: 'Gross Margin', value: `${data.margin_pct}%`, icon: TrendingUp, color: data.margin_pct >= 20 ? 'text-emerald-600' : 'text-amber-500', bg: data.margin_pct >= 20 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Total Profit', value: fmtKES(data.profit_total), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Total Revenue', value: fmtKES(data.revenue_total), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'Total Cost', value: fmtKES(data.cost_total), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ]

  return (
    <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white font-heading">Profit & Margin</h2>
        <DateRangePicker onChange={setRange} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} variants={fade} transition={{ delay: i * 0.06 }}
            className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-4">
            <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
              <k.icon className={`w-4.5 h-4.5 ${k.color}`} />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{k.value}</div>
            <div className="text-xs text-gray-400 dark:text-white/30">{k.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Revenue vs Cost vs Profit area chart */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Monthly P&L</h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthly}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
              <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="cost" stroke="#ef4444" fill="url(#costGrad)" strokeWidth={2} name="Cost" />
              <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#profitGrad)" strokeWidth={2} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Carrier margins bar chart + Routes table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Margin by Carrier</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_carrier} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
                <YAxis type="category" dataKey="carrier_name" width={100} tick={{ fontSize: 10, fill: 'oklch(0.55 0.015 286)' }} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
                <Bar dataKey="margin_pct" name="Margin %" radius={[0, 4, 4, 0]}>
                  {data.by_carrier.map((_, i) => (
                    <rect key={i} fill={['#22c55e', '#3b82f6', '#f97316', '#a78bfa', '#ef4444'][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-3">Top Routes by Margin</h3>
          <RoutePerformanceTable routes={data.by_route} />
        </div>
      </div>
    </motion.div>
  )
}
