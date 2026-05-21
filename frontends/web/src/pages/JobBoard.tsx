import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Filter, AlertCircle, RefreshCw,
  Gavel, Package, ClipboardList, X,
} from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { marketplaceApi } from '@/api/marketplace'
import ListingCard from '@/components/marketplace/ListingCard'
import BidModal from '@/components/marketplace/BidModal'
import BidList from '@/components/marketplace/BidList'
import FreightListingForm from '@/components/marketplace/FreightListingForm'
import Skeleton from '@/components/ui/Skeleton'
import type { FreightListing, Bid } from '@/types'

type Tab = 'browse' | 'my-listings' | 'my-bids'

const CARGO_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'GENERAL', label: 'General' },
  { value: 'PERISHABLE', label: 'Perishable' },
  { value: 'HAZARDOUS', label: 'Hazmat' },
  { value: 'FRAGILE', label: 'Fragile' },
  { value: 'BULK', label: 'Bulk' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'LIQUID', label: 'Liquid' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'LIVESTOCK', label: 'Livestock' },
  { value: 'OTHER', label: 'Other' },
]

export default function JobBoard() {
  const [tab, setTab] = useState<Tab>('browse')
  const [listings, setListings] = useState<FreightListing[]>([])
  const [myListings, setMyListings] = useState<FreightListing[]>([])
  const [myBids, setMyBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [cargoFilter, setCargoFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [bidListing, setBidListing] = useState<FreightListing | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [detailListing, setDetailListing] = useState<FreightListing | null>(null)
  const canManageMarketplace = usePermission(Permission.MARKETPLACE_MANAGE)
  const [acceptingBid, setAcceptingBid] = useState<number | null>(null)

  const loadListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (search) params.origin = search
      if (cargoFilter) params.cargo_type = cargoFilter
      const res = await marketplaceApi.listListings(params)
      setListings(res.data.results ?? (res.data as unknown as FreightListing[]))
    } catch {
      setError('Failed to load listings.')
    } finally {
      setLoading(false)
    }
  }, [search, cargoFilter])

  const loadMyListings = useCallback(async () => {
    try {
      const res = await marketplaceApi.myListings()
      setMyListings(res.data)
    } catch { /* silent */ }
  }, [])

  const loadMyBids = useCallback(async () => {
    try {
      const res = await marketplaceApi.myBids()
      setMyBids(res.data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (tab === 'browse') loadListings()
    else if (tab === 'my-listings') loadMyListings()
    else if (tab === 'my-bids') loadMyBids()
  }, [tab, loadListings, loadMyListings, loadMyBids])

  const handleBid = async (data: { amount: string; truck?: number; driver?: number; notes?: string; estimated_days?: number }) => {
    if (!bidListing) return
    const res = await marketplaceApi.placeBid(bidListing.id, data)
    setListings((prev) => prev.map((l) =>
      l.id === bidListing.id ? { ...l, bid_count: l.bid_count + 1 } : l))
    loadMyBids()
    return res.data
  }

  const handleAcceptBid = async (bidId: number) => {
    setAcceptingBid(bidId)
    try {
      await marketplaceApi.acceptBid(bidId)
      loadMyListings()
      loadListings()
      setDetailListing(null)
    } catch {
      alert('Failed to accept bid.')
    } finally {
      setAcceptingBid(null)
    }
  }

  const handleCreateListing = async (data: any) => {
    const res = await marketplaceApi.createListing(data)
    loadListings()
    loadMyListings()
    return res.data
  }

  const displayedListings = tab === 'browse' ? listings
    : tab === 'my-listings' ? myListings
    : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Freight Marketplace</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Browse, bid, and manage freight listings
          </p>
        </div>
        {canManageMarketplace && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2.5 rounded-xl bg-ct-orange text-white font-semibold text-sm hover:bg-orange-600
              transition-colors flex items-center gap-2 shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" /> Post Listing
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl w-fit">
        {([
          ['browse', Gavel, 'Browse'],
          ['my-listings', ClipboardList, 'My Listings'],
          ['my-bids', Package, 'My Bids'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors
              ${tab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      {tab === 'browse' && (
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by origin city..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
                text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors
              ${showFilters
                ? 'bg-ct-orange/10 border-ct-orange text-ct-orange'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      )}

      {showFilters && tab === 'browse' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="overflow-hidden mb-6"
        >
          <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
            {CARGO_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setCargoFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${cargoFilter === f.value
                    ? 'bg-ct-orange text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* My Bids Tab Content */}
      {tab === 'my-bids' && (
        <div className="space-y-3">
          {myBids.length === 0 && !loading && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
              You haven't placed any bids yet.
            </p>
          )}
          {myBids.map((bid) => (
            <motion.div
              key={bid.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    Bid #{bid.id}
                  </span>
                  <span className={`ml-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full
                    ${bid.status === 'ACCEPTED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : bid.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                    {bid.status}
                  </span>
                </div>
                <span className="font-bold text-sm text-green-600 dark:text-green-400">
                  ${Number(bid.amount).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {bid.carrier_name} · Listing #{bid.listing}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm mb-4">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={loadListings} className="ml-auto text-red-700 dark:text-red-300 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="card" height="10rem" />)}
        </div>
      )}

      {/* Listing Grid */}
      {!loading && tab !== 'my-bids' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSelect={setDetailListing}
              onBid={setBidListing}
              showBidButton={tab === 'browse'}
            />
          ))}
          {displayedListings.length === 0 && (
            <p className="col-span-full text-sm text-gray-500 dark:text-gray-400 text-center py-12">
              {tab === 'my-listings'
                ? "You haven't posted any listings yet."
                : 'No listings found.'}
            </p>
          )}
        </div>
      )}

      {/* Detail Side Panel */}
      <AnimatePresence>
        {detailListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm"
            onClick={() => setDetailListing(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-800 h-full overflow-y-auto shadow-2xl border-l border-gray-200 dark:border-gray-700"
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate">
                  {detailListing.origin} → {detailListing.destination}
                </h3>
                <button
                  onClick={() => setDetailListing(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cargo</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{detailListing.cargo_type_display}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Weight</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{detailListing.weight_kg.toLocaleString()} kg</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Pickup</span>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {new Date(detailListing.pickup_date).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Delivery</span>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {new Date(detailListing.delivery_date).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                </div>

                {detailListing.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detailListing.description}</p>
                )}

                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">
                    Bids ({detailListing.bids.length})
                  </h4>
                  <BidList
                    bids={detailListing.bids}
                    isOwner={tab === 'my-listings'}
                    onAccept={handleAcceptBid}
                    acceptingBid={acceptingBid}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bid Modal */}
      <AnimatePresence>
        {bidListing && (
          <BidModal
            listingTitle={`${bidListing.origin} → ${bidListing.destination}`}
            budgetMin={bidListing.budget_min}
            budgetMax={bidListing.budget_max}
            onBid={handleBid}
            onClose={() => setBidListing(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Listing Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <FreightListingForm
            onSubmit={handleCreateListing}
            onClose={() => setShowCreateForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
