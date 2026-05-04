import apiClient from './client'
import type {
  Bid, FreightListing, FreightListingCreatePayload,
  BidCreatePayload, PaginatedResponse,
} from '@/types'

export const marketplaceApi = {
  listListings: (params?: {
    status?: string; cargo_type?: string; origin?: string;
    destination?: string; page?: number; page_size?: number;
  }) =>
    apiClient.get<PaginatedResponse<FreightListing>>('/api/v1/marketplace/listings/', { params }),

  getListing: (id: number) =>
    apiClient.get<FreightListing>(`/api/v1/marketplace/listings/${id}/`),

  createListing: (data: FreightListingCreatePayload) =>
    apiClient.post<FreightListing>('/api/v1/marketplace/listings/', data),

  placeBid: (listingId: number, data: Omit<BidCreatePayload, 'listing'>) =>
    apiClient.post<Bid>(`/api/v1/marketplace/listings/${listingId}/bid/`, data),

  acceptBid: (bidId: number) =>
    apiClient.post<{ detail: string; bid: Bid; shipment_id: number }>(
      `/api/v1/marketplace/bids/${bidId}/accept/`),

  myBids: (params?: { status?: string }) =>
    apiClient.get<Bid[]>('/api/v1/marketplace/my-bids/', { params }),

  myListings: (params?: { status?: string }) =>
    apiClient.get<FreightListing[]>('/api/v1/marketplace/my-listings/', { params }),
}
