import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RouteAnalytics } from '@/api/analytics'

interface Props {
  routes: RouteAnalytics[]
  className?: string
}

type SortKey = 'shipment_count' | 'on_time_rate' | 'avg_risk' | 'total_revenue' | 'avg_margin'

export default function RoutePerformanceTable({ routes, className }: Props) {
  const [sort, setSort] = useState<SortKey>('shipment_count')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    return [...routes].sort((a, b) => {
      const va = a[sort]
      const vb = b[sort]
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return dir === 'asc' ? cmp : -cmp
    })
  }, [routes, sort, dir])

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(key); setDir('desc') }
  }

  const headers: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'shipment_count', label: 'Volume' },
    { key: 'on_time_rate', label: 'On-Time %' },
    { key: 'avg_risk', label: 'Avg Risk %' },
    { key: 'total_revenue', label: 'Revenue (KES)' },
    { key: 'avg_margin', label: 'Avg Margin' },
  ]

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-white/5">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase">Route</th>
            {headers.map((h) => (
              <th key={h.key} onClick={() => toggleSort(h.key)}
                className={cn('py-2 px-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase cursor-pointer select-none hover:text-gray-600 dark:hover:text-white/60 transition-colors', h.align === 'right' ? 'text-right' : 'text-left')}>
                <span className="flex items-center gap-1">
                  {h.label}
                  {sort === h.key && (dir === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
          {sorted.map((r) => (
            <tr key={r.route} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <td className="py-2.5 px-3">
                <p className="text-xs font-medium text-gray-800 dark:text-white/80">{r.route}</p>
                <p className="text-[10px] text-gray-400 dark:text-white/25">{r.avg_distance}km avg</p>
              </td>
              <td className="py-2.5 px-3 text-xs tabular-nums text-gray-700 dark:text-white/60">{r.shipment_count}</td>
              <td className="py-2.5 px-3">
                <span className={cn('text-xs font-semibold tabular-nums', r.on_time_rate >= 85 ? 'text-emerald-600' : r.on_time_rate >= 70 ? 'text-amber-500' : 'text-red-500')}>
                  {r.on_time_rate}%
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className={cn('text-xs font-semibold tabular-nums', r.avg_risk < 30 ? 'text-emerald-600' : r.avg_risk < 50 ? 'text-amber-500' : 'text-red-500')}>
                  {r.avg_risk}%
                </span>
              </td>
              <td className="py-2.5 px-3 text-xs tabular-nums text-gray-700 dark:text-white/60">
                KES {r.total_revenue.toLocaleString()}
              </td>
              <td className={cn('py-2.5 px-3 text-xs font-semibold tabular-nums', r.avg_margin >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {r.avg_margin >= 0 ? '+' : ''}KES {r.avg_margin.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
