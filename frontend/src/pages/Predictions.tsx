import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, TrendingUp } from 'lucide-react'
import client from '@/api/client'
import type { DelayPrediction, PaginatedResponse, ShipmentListItem } from '@/types'

export default function Predictions() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [predictions, setPredictions] = useState<Record<number, DelayPrediction>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client
      .get<PaginatedResponse<ShipmentListItem>>('/shipments/', { params: { status: 'in_transit', page_size: 50 } })
      .then(async (res) => {
        setShipments(res.data.results)
        const preds = await Promise.allSettled(
          res.data.results.map((s) =>
            client.get<DelayPrediction>(`/shipments/${s.id}/predict/`).then((r) => ({ id: s.id, data: r.data })),
          ),
        )
        const map: Record<number, DelayPrediction> = {}
        preds.forEach((p) => { if (p.status === 'fulfilled') map[p.value.id] = p.value.data })
        setPredictions(map)
      })
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...shipments].sort((a, b) => {
    const ra = predictions[a.id]?.delay_probability ?? 0
    const rb = predictions[b.id]?.delay_probability ?? 0
    return rb - ra
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6" style={{ color: 'var(--ct-orange)' }} />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Delay Predictions</h1>
          <p className="text-sm text-gray-500 mt-0.5">ML-powered risk assessment for active shipments</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Running predictions…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3.5 text-left font-medium">Tracking #</th>
                <th className="px-5 py-3.5 text-left font-medium">Route</th>
                <th className="px-5 py-3.5 text-left font-medium">Risk Level</th>
                <th className="px-5 py-3.5 text-left font-medium">Delay Prob.</th>
                <th className="px-5 py-3.5 text-left font-medium">Est. Delay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((s) => {
                const p = predictions[s.id]
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <Link to={`/shipments/${s.id}`} className="font-mono text-blue-600 hover:underline font-semibold">
                        {s.tracking_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{s.origin_port} → {s.destination_port}</td>
                    <td className="px-5 py-3.5">
                      {p ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${p.risk_level === 'high' ? 'bg-red-100 text-red-700'
                          : p.risk_level === 'medium' ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'}`}>
                          <TrendingUp className="w-3 h-3" />
                          {p.risk_level.charAt(0).toUpperCase() + p.risk_level.slice(1)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      {p ? (
                        <span className={p.delay_probability >= 0.7 ? 'text-red-600' : p.delay_probability >= 0.4 ? 'text-amber-600' : 'text-emerald-600'}>
                          {(p.delay_probability * 100).toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {p?.predicted_delay_days ? `${p.predicted_delay_days}d` : '—'}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No active shipments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
