import { useEffect, useState } from 'react'
import { dashboardApi } from '@/api/dashboard'
import type { PublicLandingStats } from '@/types'

interface LiveCounterProps {
  onStats?: (stats: PublicLandingStats) => void
}

export default function LiveCounter({ onStats }: LiveCounterProps) {
  const [stats, setStats] = useState<PublicLandingStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetch = () => {
      dashboardApi.getPublicStats()
        .then(({ data }) => {
          if (mounted) { setStats(data); setLoading(false); onStats?.(data) }
        })
        .catch(() => { if (mounted) setLoading(false) })
    }
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 py-8">
      <Stat value={loading ? '—' : format(stats?.total_shipments ?? 0)} label="Shipments" />
      <div className="w-px h-10 bg-white/20 hidden sm:block" />
      <Stat value={loading ? '—' : `${stats?.on_time_rate ?? 100}%`} label="On-Time Rate" />
      <div className="w-px h-10 bg-white/20 hidden sm:block" />
      <Stat value={loading ? '—' : String(stats?.active_carriers ?? 0)} label="Carriers" />
      <div className="w-px h-10 bg-white/20 hidden sm:block" />
      <Stat value={loading ? '—' : `${stats?.active_trucks ?? 0}`} label="Active Trucks" />
    </div>
  )
}

function format(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`
  return `${n.toLocaleString()}+`
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
        {value}
        {value !== '—' && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse align-middle mb-1" />}
      </div>
      <div className="text-sm text-white/60 mt-0.5">{label}</div>
    </div>
  )
}
