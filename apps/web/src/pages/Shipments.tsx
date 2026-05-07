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
import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, ChevronRight, ChevronLeft, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShipmentStore } from '@/store/shipmentStore'
import { useAuthStore } from '@/store/authStore'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import type { ShipmentStatus, ShipmentListItem } from '@/types'

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
  const navigate = useNavigate()
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const loadedPageRef = useRef<number | null>(null)
  useEffect(() => {
    if (loadedPageRef.current === currentPage) return
    loadedPageRef.current = currentPage
    fetchShipments(currentPage, PAGE_SIZE)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

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
            <DataTable<ShipmentListItem & Record<string, unknown>>
              columns={[
                { key: 'tracking_number', header: 'Tracking #', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  return <Link to={`/shipments/${s.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">{s.tracking_number}</Link>
                }},
                { key: 'route', header: 'Route', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  return <span className="text-xs text-gray-600 whitespace-nowrap"><span className="font-medium">{s.route.origin}</span><span className="text-gray-300 mx-1">→</span>{s.route.destination}</span>
                }},
                { key: 'carrier_name', header: 'Carrier', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  return <span className="text-xs text-gray-600 max-w-[160px] truncate block">{s.carrier_name}</span>
                }},
                { key: 'weight_kg', header: 'Weight', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  return <span className="text-xs text-gray-500 whitespace-nowrap">{s.weight_kg.toLocaleString()} kg</span>
                }},
                { key: 'scheduled_arrival', header: 'ETA', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  return <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(s.scheduled_arrival).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                }},
                { key: 'status', header: 'Status', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.PENDING
                  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>{cfg.label}</span>
                }},
                { key: 'delay_risk_score', header: 'Delay Risk', render: (row) => {
                  const s = row as unknown as ShipmentListItem
                  const riskPct = Math.round(s.delay_risk_score * 100)
                  const riskColor = riskPct >= 70 ? 'text-red-600' : riskPct >= 40 ? 'text-amber-600' : 'text-emerald-600'
                  return <span className={cn('text-xs font-semibold tabular-nums', riskColor)}>{riskPct}%</span>
                }},
              ] as ColumnDef<Record<string, unknown>>[]}
              data={shipments as unknown as Record<string, unknown>[]}
              searchable
              searchPlaceholder="Search by tracking #, carrier, or route…"
              onRowClick={(row) => { const s = row as unknown as ShipmentListItem; navigate(`/shipments/${s.id}`) }}
              emptyTitle="No shipments found"
              pageSize={PAGE_SIZE}
            />

            {/* Server-side pagination */}
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
