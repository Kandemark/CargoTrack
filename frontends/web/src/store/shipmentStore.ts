/**
 * frontend/src/store/shipmentStore.ts
 *
 * Zustand store for shipment list and detail state.
 *
 * Responsibilities:
 *   - Holds the paginated `shipments` list, the currently viewed
 *     `currentShipment`, `totalCount`, `currentPage`, loading, and error state.
 *   - `fetchShipments(page?, pageSize?)` — loads a page from the API.
 *   - `fetchShipment(id)` — loads a single shipment by PK.
 *   - `setPage(page)` — updates `currentPage` without triggering a fetch.
 *   - `clearCurrentShipment()` — resets detail state on navigation away.
 *
 * This store is not persisted; shipment data is always fetched fresh from the
 * API on mount to avoid stale cache issues.
 */
import { create } from 'zustand'
import { shipmentsApi } from '@/api/shipments'
import type { Shipment, ShipmentListItem } from '@/types'

interface ShipmentState {
  shipments: ShipmentListItem[]
  currentShipment: Shipment | null
  totalCount: number
  currentPage: number
  isLoading: boolean
  error: string | null

  fetchShipments: (page?: number, pageSize?: number) => Promise<void>
  fetchShipment: (id: number) => Promise<void>
  setPage: (page: number) => void
  clearCurrentShipment: () => void
}

export const useShipmentStore = create<ShipmentState>()((set, get) => ({
  shipments: [],
  currentShipment: null,
  totalCount: 0,
  currentPage: 1,
  isLoading: false,
  error: null,

  fetchShipments: async (page?: number, pageSize = 20) => {
    const p = page ?? get().currentPage
    set({ isLoading: true, error: null, currentPage: p })
    try {
      const { data } = await shipmentsApi.getShipments({ page: p, page_size: pageSize })
      set({ shipments: data.results, totalCount: data.count })
    } catch {
      set({ error: 'Failed to load shipments. Please try again.' })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchShipment: async (id: number) => {
    set({ isLoading: true, error: null, currentShipment: null })
    try {
      const { data } = await shipmentsApi.getShipment(id)
      set({ currentShipment: data })
    } catch {
      set({ error: 'Shipment not found.' })
    } finally {
      set({ isLoading: false })
    }
  },

  setPage: (page) => set({ currentPage: page }),

  clearCurrentShipment: () => set({ currentShipment: null, error: null }),
}))
