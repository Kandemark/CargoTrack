import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Package, ChevronRight, ChevronLeft } from 'lucide-react'
import { shipmentsApi } from '@/api/shipments'
import { useShipmentStore } from '@/store/shipmentStore'
import type { ShipmentStatus } from '@/types'

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  pending:    'bg-gray-100 text-gray-600',
  in_transit: 'bg-blue-100 text-blue-700',
  at_customs: 'bg-purple-100 text-purple-700',
  delayed:    'bg-amber-100 text-amber-700',
  delivered:  'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending:    'Pending',
  in_transit: 'In Transit',
  at_customs: 'At Customs',
  delayed:    'Delayed',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
}

export default function Shipments() {
  const { shipments, totalCount, currentPage, isLoading, setShipments, setPage, setLoading, setError } =
    useShipmentStore()

  const pageSize = 20
  const totalPages = Math.ceil(totalCount / pageSize)

  useEffect(() => {
    setLoading(true)
    shipmentsApi
      .list(currentPage)
      .then((res) => setShipments(res.data.results, res.data.count))
      .catch(() => setError('Failed to load shipments.'))
      .finally(() => setLoading(false))
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalCount.toLocaleString()} total shipments</p>
        </div>
        <Link
          to="/shipments/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-orange)' }}
        >
          <Package className="w-4 h-4" />
          New Shipment
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3.5 text-left font-medium">Tracking #</th>
                <th className="px-5 py-3.5 text-left font-medium">Description</th>
                <th className="px-5 py-3.5 text-left font-medium">Route</th>
                <th className="px-5 py-3.5 text-left font-medium">Carrier</th>
                <th className="px-5 py-3.5 text-left font-medium">ETA</th>
                <th className="px-5 py-3.5 text-left font-medium">Status</th>
                <th className="px-5 py-3.5 text-left font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/shipments/${s.id}`}
                      className="font-mono font-semibold text-blue-600 hover:underline"
                    >
                      {s.tracking_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 max-w-[180px] truncate">{s.description}</td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                    {s.origin_port} → {s.destination_port}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.carrier}</td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                    {s.estimated_arrival ? new Date(s.estimated_arrival).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status]}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {s.delay_risk !== null ? (
                      <span className={`text-xs font-semibold ${s.delay_risk >= 0.7 ? 'text-red-600' : s.delay_risk >= 0.4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {(s.delay_risk * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">No shipments found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
