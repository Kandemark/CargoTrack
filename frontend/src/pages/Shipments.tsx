/**
 * @file Shipments.tsx
 * @description Paginated shipment list page with client-side search and
 * status filtering.
 *
 * Data flow:
 *   - Reads paginated `shipments`, `totalCount`, `currentPage`, `isLoading`,
 *     and `error` from `useShipmentStore`.
 *   - Calls `fetchShipments(page)` on mount and on page change.
 *   - Clicking a row navigates to `/shipments/<id>` (ShipmentDetail page).
 *
 * @route /shipments
 * @auth IsAuthenticated
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, ChevronRight, ChevronLeft, Search, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShipmentStore } from '@/store/shipmentStore'
import { useAuthStore } from '@/store/authStore'
import type { ShipmentStatus } from '@/types'

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string }> = {
  PENDING:    { label: 'Pending',    bg: 'bg-gray-100',   text: 'text-gray-600'    },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  CUSTOMS:    { label: 'At Customs', bg: 'bg-purple-50',  text: 'text-purple-700'  },
  DELAYED:    { label: 'Delayed',    bg: 'bg-red-50',     text: 'text-red-700'     },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const PAGE_SIZE = 20

const CAN_CREATE = ['ADMIN', 'LOGISTICS_MGR']

export default function Shipments() {
  const {
    shipments, totalCount, currentPage, isLoading, error,
    fetchShipments, setPage,
  } = useShipmentStore()

  const userRole = useAuthStore((s) => s.user?.role)
  const [search, setSearch] = useState('')
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  useEffect(() => {
    fetchShipments(currentPage, PAGE_SIZE)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side search within the current page
  const visible = search.trim()
    ? shipments.filter(
        (s) =>
          s.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
          s.carrier_name.toLowerCase().includes(search.toLowerCase()) ||
          s.route.origin.toLowerCase().includes(search.toLowerCase()) ||
          s.route.destination.toLowerCase().includes(search.toLowerCase()),
      )
    : shipments

  function handlePageChange(p: number) {
    setPage(p)
    fetchShipments(p, PAGE_SIZE)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalCount.toLocaleString()} total shipments</p>
        </div>
        {userRole && CAN_CREATE.includes(userRole) && (
          <Link
            to="/shipments/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--ct-orange)' }}
          >
            <Package className="w-4 h-4" /> New Shipment
          </Link>
        )}
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by tracking #, carrier, or route…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder:text-gray-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-gray-500">{error}</p>
            <button
              onClick={() => fetchShipments(currentPage, PAGE_SIZE)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--ct-navy)' }}
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading shipments…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-5 py-3.5 text-left font-medium">Tracking #</th>
                    <th className="px-5 py-3.5 text-left font-medium">Route</th>
                    <th className="px-5 py-3.5 text-left font-medium">Carrier</th>
                    <th className="px-5 py-3.5 text-left font-medium">Weight</th>
                    <th className="px-5 py-3.5 text-left font-medium">ETA</th>
                    <th className="px-5 py-3.5 text-left font-medium">Status</th>
                    <th className="px-5 py-3.5 text-left font-medium">Delay Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map((s) => {
                    const riskPct = Math.round(s.delay_risk_score * 100)
                    const riskColor = riskPct >= 70 ? 'text-red-600' : riskPct >= 40 ? 'text-amber-600' : 'text-emerald-600'
                    const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.PENDING
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/shipments/${s.id}`}
                            className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                          >
                            {s.tracking_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                          <span className="font-medium">{s.route.origin}</span>
                          <span className="text-gray-300 mx-1">→</span>
                          {s.route.destination}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 max-w-[160px] truncate">
                          {s.carrier_name}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                          {s.weight_kg.toLocaleString()} kg
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(s.scheduled_arrival).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn('text-xs font-semibold tabular-nums', riskColor)}>
                            {riskPct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-sm text-gray-400">
                        {search ? 'No shipments match your search.' : 'No shipments found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Page {currentPage} of {totalPages} · {totalCount.toLocaleString()} shipments
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
