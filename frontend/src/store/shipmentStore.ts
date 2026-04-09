import { create } from 'zustand'
import type { ShipmentListItem } from '@/types'

interface ShipmentState {
  shipments: ShipmentListItem[]
  totalCount: number
  currentPage: number
  isLoading: boolean
  error: string | null
  setShipments: (shipments: ShipmentListItem[], total: number) => void
  setPage: (page: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useShipmentStore = create<ShipmentState>()((set) => ({
  shipments: [],
  totalCount: 0,
  currentPage: 1,
  isLoading: false,
  error: null,
  setShipments: (shipments, totalCount) => set({ shipments, totalCount }),
  setPage: (currentPage) => set({ currentPage }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
