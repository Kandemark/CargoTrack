import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Trophy, TrendingUp, Gavel, Route, Target, Star } from 'lucide-react'
import { analyticsApi, type PerformanceData, type DriverLeaderboardEntry, type BidAnalyticsData } from '@/api/analytics'
import Skeleton from '@/components/ui/Skeleton'

interface StatCardProps {
  label: string; value: string | number; icon: React.ElementType; accent: string; sub?: string
}

function StatCard({ label, value, icon: Icon, accent, sub }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4
      flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}18` } as React.CSSProperties}>
        <Icon className="w-5 h-5" style={{ color: accent } as React.CSSProperties} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
        {sub && <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function PerformanceMetrics() {
  const [perf, setPerf] = useState<PerformanceData | null>(null)
  const [leaderboard, setLeaderboard] = useState<DriverLeaderboardEntry[]>([])
  const [bidData, setBidData] = useState<BidAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, l, b] = await Promise.all([
        analyticsApi.performance({ days: 30 }),
        analyticsApi.driverLeaderboard(),
        analyticsApi.bidAnalytics({ days: 30 }),
      ])
      setPerf(p.data)
      setLeaderboard(l.data)
      setBidData(b.data)
    } catch {
      setError('Failed to load performance data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Skeleton variant="text" width="40%" height="2rem" className="mb-2" />
        <Skeleton variant="text" width="25%" height="1rem" className="mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="card" height="5rem" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Skeleton variant="chart" height="14rem" />
          <Skeleton variant="chart" height="14rem" />
        </div>
        <Skeleton variant="card" height="20rem" className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton variant="card" height="16rem" />
          <Skeleton variant="card" height="16rem" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-6 text-red-600 dark:text-red-400">
        <AlertCircle className="w-5 h-5" /> {error}
        <button onClick={load} className="underline text-sm ml-2">Retry</button>
      </div>
    )
  }

  const onTimeColor = (perf?.on_time_rate ?? 0) >= 80 ? '#10b981' : (perf?.on_time_rate ?? 0) >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Metrics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">On-time delivery, driver rankings, and bid analytics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="On-Time Rate" value={`${perf?.on_time_rate ?? 0}%`} icon={Target} accent={onTimeColor}
          sub={`${perf?.completed_shipments ?? 0} of ${perf?.total_shipments ?? 0} completed`} />
        <StatCard label="Avg Distance" value={`${perf?.avg_distance_km ?? 0} km`} icon={Route} accent="#3b82f6"
          sub="Per shipment" />
        <StatCard label="Bid Success" value={`${perf?.bid_success_rate ?? 0}%`} icon={Gavel} accent="#8b5cf6"
          sub={`${perf?.accepted_bids ?? 0} accepted of ${perf?.total_bids ?? 0}`} />
        <StatCard label="Top Drivers" value={leaderboard.length} icon={Trophy} accent="#f59e0b"
          sub="In leaderboard rankings" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* On-Time Trend Chart */}
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ct-orange" /> On-Time Trend (30 days)
          </h3>
          <div className="h-48 flex items-end gap-1">
            {perf?.on_time_trend.map((point, i) => {
              const h = point.rate > 0 ? Math.max(point.rate * 1.5, 4) : 0
              const color = point.rate >= 80 ? '#10b981' : point.rate >= 60 ? '#f59e0b' : '#ef4444'
              return (
                <div key={i} className="flex-1 flex flex-col items-center" title={`${point.date}: ${point.rate}%`}>
                  <span className="text-[9px] text-gray-400 mb-0.5">{point.rate > 0 ? `${point.rate}%` : ''}</span>
                  <div className="w-full rounded-t transition-all duration-300" style={{ height: `${h}%` || 0, background: color, minHeight: 0 }} />
                  {i % 5 === 0 && <span className="text-[8px] text-gray-400 mt-1 -rotate-45 origin-top-left">{point.date.slice(5)}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bid Daily Trend */}
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-purple-500" /> Bid Volume (30 days)
          </h3>
          <div className="h-48 flex items-end gap-1">
            {bidData?.daily_trend.map((point, i) => {
              const max = Math.max(...(bidData.daily_trend.map(p => p.total)), 1)
              const h = (point.total / max) * 100
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center" title={`${point.date}: ${point.total} bids, ${point.accepted} accepted`}>
                  <span className="text-[9px] text-gray-400 mb-0.5">{point.total > 0 ? point.total : ''}</span>
                  <div className="w-full relative" style={{ height: `${h}%`, minHeight: 0 }}>
                    <div className="absolute inset-0 rounded-t bg-purple-200 dark:bg-purple-900/30" />
                    <div className="absolute bottom-0 inset-x-0 rounded-t bg-purple-500" style={{ height: `${point.total > 0 ? (point.accepted / point.total) * 100 : 0}%` }} />
                  </div>
                  {i % 5 === 0 && <span className="text-[8px] text-gray-400 mt-1 -rotate-45 origin-top-left">{point.date.slice(5)}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Driver Leaderboard */}
      <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5 mb-6">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" /> Driver Leaderboard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
                <th className="pb-2 font-semibold">Rank</th>
                <th className="pb-2 font-semibold">Driver</th>
                <th className="pb-2 font-semibold text-right">Rating</th>
                <th className="pb-2 font-semibold text-right">On-Time</th>
                <th className="pb-2 font-semibold text-right">Jobs</th>
                <th className="pb-2 font-semibold text-right">KM</th>
                <th className="pb-2 font-semibold text-right">Earnings MTD</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((d) => (
                <tr key={d.rank} className="border-b border-gray-50 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="py-2.5">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                      ${d.rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : d.rank === 2 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      : d.rank === 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'text-gray-500'
                    }`}>
                      {d.rank}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="font-semibold text-gray-900 dark:text-white">{d.name}</span>
                    <span className="ml-2 text-[10px] text-gray-400">{d.driver_id}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <Star className="w-3 h-3 text-yellow-500" /> {d.rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={d.on_time_rate >= 80 ? 'text-green-600 dark:text-green-400' : d.on_time_rate >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                      {d.on_time_rate}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{d.total_jobs}</td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{d.total_km.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">${d.earnings_mtd.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carrier Bid Scorecards + Miles Per Route */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carrier Scorecards */}
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-ct-orange" /> Carrier Bid Scorecards
          </h3>
          <div className="space-y-3">
            {bidData?.carrier_performance.map((c) => (
              <div key={c.carrier} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{c.carrier}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.total_bids} bids · Avg ${c.avg_amount.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${c.success_rate >= 50 ? 'text-green-600 dark:text-green-400' : c.success_rate >= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                    {c.success_rate}%
                  </p>
                  <p className="text-[10px] text-gray-400">{c.accepted}/{c.total_bids} accepted</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Miles Per Route */}
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-blue-500" /> Top Routes by Volume
          </h3>
          <div className="space-y-3">
            {perf?.miles_per_route.map((r) => {
              const maxKm = Math.max(...(perf.miles_per_route.map(p => p.avg_km)), 1)
              const w = (r.avg_km / maxKm) * 100
              return (
                <div key={r.route}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 truncate">{r.route}</span>
                    <span className="text-gray-500 dark:text-gray-400">{r.avg_km} km · {r.count} shipments</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${w}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-blue-500"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
