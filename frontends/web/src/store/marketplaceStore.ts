import { create } from 'zustand'
import { marketplaceApi } from '@/api/marketplace'
import type { FreightListing, Bid, FreightListingCreatePayload } from '@/types'

interface MarketplaceState {
  listings: FreightListing[]
  myListings: FreightListing[]
  myBids: Bid[]
  selectedListing: FreightListing | null
  loading: boolean
  error: string | null
  fetchListings: (params?: Record<string, string>) => Promise<void>
  fetchMyListings: (params?: Record<string, string>) => Promise<void>
  fetchMyBids: (params?: Record<string, string>) => Promise<void>
  fetchListing: (id: number) => Promise<void>
  createListing: (data: FreightListingCreatePayload) => Promise<FreightListing>
  placeBid: (listingId: number, data: { amount: string; truck?: number; driver?: number; notes?: string; estimated_days?: number }) => Promise<Bid>
  acceptBid: (bidId: number) => Promise<{ shipment_id: number }>
  clearError: () => void
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  listings: [],
  myListings: [],
  myBids: [],
  selectedListing: null,
  loading: false,
  error: null,

  fetchListings: async (params) => {
    set({ loading: true, error: null })
    try {
      const res = await marketplaceApi.listListings(params)
      set({ listings: res.data.results ?? res.data, loading: false })
    } catch (e: any) {
      set({ error: e?.response?.data?.detail ?? 'Failed to load listings.', loading: false })
    }
  },

  fetchMyListings: async (params) => {
    set({ loading: true, error: null })
    try {
      const res = await marketplaceApi.myListings(params)
      set({ myListings: res.data, loading: false })
    } catch (e: any) {
      set({ error: e?.response?.data?.detail ?? 'Failed to load your listings.', loading: false })
    }
  },

  fetchMyBids: async (params) => {
    set({ loading: true, error: null })
    try {
      const res = await marketplaceApi.myBids(params)
      set({ myBids: res.data, loading: false })
    } catch (e: any) {
      set({ error: e?.response?.data?.detail ?? 'Failed to load your bids.', loading: false })
    }
  },

  fetchListing: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await marketplaceApi.getListing(id)
      set({ selectedListing: res.data, loading: false })
    } catch (e: any) {
      set({ error: e?.response?.data?.detail ?? 'Failed to load listing.', loading: false })
    }
  },

  createListing: async (data) => {
    set({ error: null })
    const res = await marketplaceApi.createListing(data)
    set((s) => ({ listings: [res.data, ...s.listings] }))
    return res.data
  },

  placeBid: async (listingId, data) => {
    set({ error: null })
    const res = await marketplaceApi.placeBid(listingId, data)
    return res.data
  },

  acceptBid: async (bidId) => {
    set({ error: null })
    const res = await marketplaceApi.acceptBid(bidId)
    get().fetchListings()
    get().fetchMyListings()
    return res.data
  },

  clearError: () => set({ error: null }),
}))
