/**
 * @file Predictions.tsx
 * @description ML delay predictions overview page — displays all shipments with
 * their current `delay_risk_score` and lets managers trigger a fresh prediction.
 *
 * Data flow:
 *   - Fetches `GET /api/v1/shipments/?page_size=50` on mount for the shipment list.
 *   - "Predict" button calls `POST /api/v1/shipments/<id>/predict/` and
 *     updates the displayed risk score in-place without a full page reload.
 *   - Risk scores are colour-coded: ≥ 70% red, 40–69% amber, < 40% green.
 *
 * Note: The predict endpoint requires a trained model at
 * `cargotrack/ml/delay_model.pkl`.  If the model file is missing the endpoint
 * returns 503 and the page shows an error banner.
 *
 * @route /predictions
 * @auth IsAuthenticated
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import type { DelayPrediction, ShipmentListItem } from '@/types'

type RiskLevel = 'high' | 'medium' | 'low'

function getRiskLevel(score: number): RiskLevel {
  if (score >= 0.7) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

const RISK_STYLE: Record<RiskLevel, { badge: string; score: string }> = {
  high:   { badge: 'bg-red-100 text-red-700',     score: 'text-red-600'     },
  medium: { badge: 'bg-amber-100 text-amber-700',  score: 'text-amber-600'   },
  low:    { badge: 'bg-emerald-100 text-emerald-700', score: 'text-emerald-600' },
}

interface PredictionRow {
  shipment: ShipmentListItem
  prediction: DelayPrediction | null
}

export default function Predictions() {
  const [rows, setRows]       = useState<PredictionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  async function load() {
    setError(null)
    setIsLoading(true)
    try {
      const listRes = await shipmentsApi.getShipments({ status: 'IN_TRANSIT', page_size: 50 })
      const shipments = listRes.data.results

      const settled = await Promise.allSettled(
        shipments.map((s) => shipmentsApi.predictDelay(s.id)),
      )

      const built: PredictionRow[] = shipments.map((s, i) => ({
        shipment: s,
        prediction:
          settled[i].status === 'fulfilled' ? settled[i].value.data : null,
      }))

      // Sort highest risk first; nulls go to the bottom
      built.sort((a, b) => {
        const ra = a.prediction?.delay_risk_score ?? -1
        const rb = b.prediction?.delay_risk_score ?? -1
        return rb - ra
      })

      setRows(built)
    } catch {
      setError('Failed to load predictions. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6" style={{ color: 'var(--ct-orange)' }} />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Delay Predictions</h1>
            <p className="text-sm text-gray-500 mt-0.5">ML-powered risk assessment for in-transit shipments</p>
          </div>
        </div>
        {!isLoading && !error && (
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--ct-navy)' }}
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-50 border-b border-gray-100" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0">
              <div className="h-3 rounded bg-gray-100 w-32" />
              <div className="h-3 rounded bg-gray-100 w-40" />
              <div className="h-5 rounded-full bg-gray-100 w-16" />
              <div className="h-3 rounded bg-gray-100 w-12" />
              <div className="h-3 rounded bg-gray-100 w-8" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Brain className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No in-transit shipments</p>
          <p className="text-xs text-gray-400">Predictions are shown for shipments currently in transit.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3.5 text-left font-medium">Tracking #</th>
                <th className="px-5 py-3.5 text-left font-medium">Route</th>
                <th className="px-5 py-3.5 text-left font-medium">Risk Level</th>
                <th className="px-5 py-3.5 text-left font-medium">Risk Score</th>
                <th className="px-5 py-3.5 text-left font-medium">Predicted Delayed</th>
                <th className="px-5 py-3.5 text-left font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ shipment: s, prediction: p }) => {
                const level = p ? getRiskLevel(p.delay_risk_score) : null
                const style = level ? RISK_STYLE[level] : null
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/shipments/${s.id}`}
                        className="font-mono font-semibold text-blue-600 hover:underline"
                      >
                        {s.tracking_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {s.route.origin} → {s.route.destination}
                    </td>
                    <td className="px-5 py-3.5">
                      {level && style ? (
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', style.badge)}>
                          <TrendingUp className="w-3 h-3" />
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-semibold tabular-nums">
                      {p ? (
                        <span className={style?.score}>
                          {Math.round(p.delay_risk_score * 100)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {p ? (
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded text-xs font-semibold',
                          p.predicted_delayed
                            ? 'bg-red-50 text-red-600'
                            : 'bg-emerald-50 text-emerald-600',
                        )}>
                          {p.predicted_delayed ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 tabular-nums">
                      {p ? `${Math.round(p.confidence * 100)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
