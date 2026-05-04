import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { cn } from '@/lib/utils'
import type { CorridorAnalytics } from '@/api/analytics'

interface Props {
  corridors: CorridorAnalytics[]
  className?: string
}

const CORRIDOR_COLORS = {
  'Northern Corridor': '#f97316',
  'Central Corridor':  '#60a5fa',
  'LAPSSET Corridor':  '#34d399',
}

export default function CorridorComparison({ corridors, className }: Props) {
  const chartData = corridors.map((c) => ({
    name: c.corridor_name.replace(' Corridor', ''),
    'On-Time %': c.on_time_rate,
    'Delay Risk %': c.avg_risk,
    'Volume (tonnes)': Math.round(c.total_volume_kg / 1000),
    congestion: Math.round(c.congestion_index * 100),
  }))

  const metrics = [
    { key: 'on_time_rate', label: 'On-Time Rate', suffix: '%', good: true },
    { key: 'avg_risk', label: 'Avg Risk', suffix: '%', good: false },
    { key: 'shipment_count', label: 'Shipments', suffix: '', good: true },
    { key: 'total_volume_kg', label: 'Volume', suffix: 't', good: true, fmt: (v: number) => `${Math.round(v / 1000).toLocaleString()}` },
    { key: 'congestion_index', label: 'Congestion', suffix: 'x', good: false, fmt: (v: number) => v.toFixed(2) },
  ] as const

  return (
    <div className={cn('space-y-4', className)}>
      {/* Bar chart comparing key metrics */}
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={24} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32 / 30%)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 286)' }} />
            <Tooltip
              contentStyle={{
                background: '#111c2d', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, fontSize: 12, color: '#fff',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Volume (tonnes)" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="On-Time %" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Delay Risk %" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric cards per corridor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {corridors.map((c) => {
          const color = CORRIDOR_COLORS[c.corridor_name] ?? '#94a3b8'
          return (
            <div key={c.corridor_name} className="rounded-xl border border-gray-200 dark:border-white/8 p-4"
              style={{ borderTopColor: color, borderTopWidth: 3 }}>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white font-heading mb-2">{c.corridor_name}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 uppercase">On-Time</p>
                  <p className={cn('text-sm font-bold tabular-nums', c.on_time_rate >= 85 ? 'text-emerald-600' : c.on_time_rate >= 70 ? 'text-amber-500' : 'text-red-500')}>
                    {c.on_time_rate}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 uppercase">Risk</p>
                  <p className={cn('text-sm font-bold tabular-nums', c.avg_risk < 30 ? 'text-emerald-600' : c.avg_risk < 50 ? 'text-amber-500' : 'text-red-500')}>
                    {c.avg_risk}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 uppercase">Volume</p>
                  <p className="text-sm font-bold tabular-nums text-gray-700 dark:text-white/80">{Math.round(c.total_volume_kg / 1000).toLocaleString()}t</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 uppercase">Congestion</p>
                  <p className={cn('text-sm font-bold tabular-nums', c.congestion_index < 1.1 ? 'text-emerald-600' : c.congestion_index < 1.3 ? 'text-amber-500' : 'text-red-500')}>
                    {c.congestion_index.toFixed(2)}x
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
