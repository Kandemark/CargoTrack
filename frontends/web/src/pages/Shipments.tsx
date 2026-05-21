/**
 * Shipments.tsx — Paginated shipment list with bulk operations.
 *
 * Bulk actions: status update, generate documents, assign carrier.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Package, ChevronRight, ChevronLeft, AlertTriangle, RefreshCw,
  Flag, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShipmentStore } from '@/store/shipmentStore'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { shipmentsApi } from '@/api/shipments'
import BulkActionBar from '@/components/ui/BulkActionBar'
import type { ShipmentStatus } from '@/types'

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string }> = {
  PENDING:    { label: 'Pending',    bg: 'bg-gray-100',   text: 'text-gray-600'    },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  CUSTOMS:    { label: 'At Customs', bg: 'bg-purple-50',  text: 'text-purple-700'  },
  DELAYED:    { label: 'Delayed',    bg: 'bg-red-50',     text: 'text-red-700'     },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const PAGE_SIZE = 20

const NEXT_STATUS: Record<string, ShipmentStatus[]> = {
  PENDING:    ['IN_TRANSIT'],
  IN_TRANSIT: ['CUSTOMS', 'DELIVERED', 'DELAYED'],
  CUSTOMS:    ['IN_TRANSIT', 'DELAYED', 'DELIVERED'],
  DELAYED:    ['IN_TRANSIT', 'CUSTOMS', 'DELIVERED'],
}

export default function Shipments() {
  const {
    shipments, totalCount, currentPage, isLoading, error,
    fetchShipments, setPage,
  } = useShipmentStore()

  const canCreate = usePermission(Permission.SHIPMENTS_CREATE)
  void useNavigate() /* navigate — available for future row-click navigation */
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectAll, setSelectAll] = useState(false)

  const loadedPageRef = useRef<number | null>(null)
  useEffect(() => {
    if (loadedPageRef.current === currentPage) return
    loadedPageRef.current = currentPage
    fetchShipments(currentPage, PAGE_SIZE)
  }, [currentPage])

  function handlePageChange(p: number) {
    setPage(p)
    setSelected(new Set())
    setSelectAll(false)
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSelectAll(false)
  }

  function handleSelectAll() {
    if (selectAll) { setSelected(new Set()); setSelectAll(false) }
    else { setSelected(new Set(shipments.map(s => s.id))); setSelectAll(true) }
  }

  // Bulk status update
  const handleBulkStatus = useCallback(async (newStatus: ShipmentStatus) => {
    if (selected.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.allSettled(
        Array.from(selected).map(id => shipmentsApi.updateShipment(id, { status: newStatus } as any)),
      )
      setSelected(new Set())
      setSelectAll(false)
      fetchShipments(currentPage, PAGE_SIZE)
    } catch { /* silent */ }
    finally { setBulkLoading(false) }
  }, [selected, currentPage])

  // Bulk document generation
  const handleBulkDocs = useCallback(async () => {
    if (selected.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.allSettled(
        Array.from(selected).map(id => shipmentsApi.generateWaybill(id)),
      )
      alert(`Generated documents for ${selected.size} shipment(s).`)
    } catch { alert('Some documents failed to generate.') }
    finally { setBulkLoading(false) }
  }, [selected])

  // Determine available next statuses for selected shipments
  const commonStatuses = (() => {
    const selectedShipments = shipments.filter(s => selected.has(s.id))
    if (selectedShipments.length === 0) return []
    const first = NEXT_STATUS[selectedShipments[0].status] ?? []
    for (let i = 1; i < selectedShipments.length; i++) {
      const next = NEXT_STATUS[selectedShipments[i].status] ?? []
      if (first.length !== next.length || !first.every(s => next.includes(s))) return []
    }
    return first
  })()

  const bulkActions = [
    ...commonStatuses.map(status => ({
      label: `Mark ${STATUS_CONFIG[status]?.label ?? status}`,
      icon: Flag,
      onClick: () => handleBulkStatus(status),
      variant: 'default' as const,
    })),
    { label: 'Generate Docs', icon: Download, onClick: handleBulkDocs, variant: 'primary' as const },
  ]

  return (
    <div className="space-y-5">
      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        actions={bulkActions}
        onClear={() => { setSelected(new Set()); setSelectAll(false) }}
        loading={bulkLoading}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Shipments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{totalCount.toLocaleString()} total shipments</p>
        </div>
        {canCreate && (
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
      <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-white/5">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-ct-orange focus:ring-ct-orange"
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Tracking #</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Route</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Carrier</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Weight</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">ETA</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {shipments.map((s) => {
                    const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.PENDING
                    const riskPct = Math.round(s.delay_risk_score * 100)
                    const riskColor = riskPct >= 70 ? 'text-red-600' : riskPct >= 40 ? 'text-amber-600' : 'text-emerald-600'
                    const isSel = selected.has(s.id)
                    return (
                      <tr
                        key={s.id}
                        className={cn(
                          'transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                          isSel && 'bg-blue-50/50 dark:bg-blue-900/10',
                        )}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleSelect(s.id)}
                            className="w-4 h-4 rounded border-gray-300 text-ct-orange focus:ring-ct-orange"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/shipments/${s.id}`} className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
                            {s.tracking_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            <span className="font-medium">{s.route.origin}</span>
                            <span className="text-gray-300 dark:text-gray-600 mx-1">→</span>
                            {s.route.destination}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 dark:text-gray-300 max-w-[160px] truncate block">{s.carrier_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{s.weight_kg.toLocaleString()} kg</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {new Date(s.scheduled_arrival).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-semibold tabular-nums', riskColor)}>{riskPct}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Server-side pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Page {currentPage} of {totalPages} · {totalCount.toLocaleString()} shipments
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
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
