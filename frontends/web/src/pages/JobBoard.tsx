/**
 * JobBoard.tsx — Freight marketplace with rate negotiation.
 *
 * Shippers post listings; carriers bid. Both parties can counter-offer
 * to negotiate rates in a threaded deal room before acceptance.
 */
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Filter, AlertCircle, Gavel, Package, ClipboardList,
  X, TrendingUp, TrendingDown, MessageSquare, Clock,
} from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { marketplaceApi } from '@/api/marketplace'
import ListingCard from '@/components/marketplace/ListingCard'
import BidModal from '@/components/marketplace/BidModal'

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

// Simulated market rates by corridor (USD per km per ton)
const MARKET_RATES: Record<string, { avg: number; low: number; high: number }> = {
  'KE-TZ':  { avg: 0.12, low: 0.08, high: 0.18 },
  'KE-UG':  { avg: 0.10, low: 0.07, high: 0.15 },
  'KE-RW':  { avg: 0.14, low: 0.10, high: 0.20 },
  'TZ-KE':  { avg: 0.13, low: 0.09, high: 0.19 },
  'UG-KE':  { avg: 0.11, low: 0.08, high: 0.16 },
}

// ── Counter Offer Modal ──────────────────────────────────────────────────────
function CounterOfferModal({
  bid, onCounter, onClose,
}: {
  bid: Bid; onCounter: (amount: string, notes: string) => void; onClose: () => void
}) {
  const [amount, setAmount] = useState(bid.amount?.toString() ?? '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const suggestedLow = Math.round(Number(bid.amount) * 0.85)
  const suggestedMid = Number(bid.amount)
  const suggestedHigh = Math.round(Number(bid.amount) * 1.1)

  async function handleSubmit() {
    if (!amount) return
    setSubmitting(true)
    try { await onCounter(amount, notes); onClose() } catch { /* modal stays */ }
    setSubmitting(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
        className="w-full max-w-sm bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Counter Offer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">Current Bid</label>
            <p className="text-lg font-bold text-gray-900 dark:text-white">${Number(bid.amount).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">Your Counter (USD)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-2 mt-2">
              {[suggestedLow, suggestedMid, suggestedHigh].map((v, i) => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    i === 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-100'
                    : i === 1 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 hover:bg-amber-100'
                  }`}>
                  ${v.toLocaleString()}{i === 0 ? ' (Low)' : i === 1 ? ' (Match)' : ' (High)'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">Note (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="e.g. Can you do this rate for a 3-shipment contract?"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/8">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !amount}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--ct-orange)' }}>
            {submitting ? 'Sending...' : 'Send Counter'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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
  const [counterBid, setCounterBid] = useState<Bid | null>(null)
  const canManageMarketplace = usePermission(Permission.MARKETPLACE_MANAGE)
  const [acceptingBid, setAcceptingBid] = useState<number | null>(null)

  const loadListings = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params: Record<string, string> = {}
      if (search) params.origin = search
      if (cargoFilter) params.cargo_type = cargoFilter
      const res = await marketplaceApi.listListings(params)
      setListings(res.data.results ?? (Array.isArray(res.data) ? res.data : []))
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load listings.')
    } finally { setLoading(false) }
  }, [search, cargoFilter])

  const loadMyListings = useCallback(async () => {
    try { const res = await marketplaceApi.myListings(); setMyListings(res.data) } catch { /* silent */ }
  }, [])

  const loadMyBids = useCallback(async () => {
    try { const res = await marketplaceApi.myBids(); setMyBids(res.data) } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (tab === 'browse') loadListings()
    else if (tab === 'my-listings') loadMyListings()
    else if (tab === 'my-bids') loadMyBids()
  }, [tab, loadListings, loadMyListings, loadMyBids])

  const handleBid = async (data: { amount: string; truck?: number; driver?: number; notes?: string; estimated_days?: number }) => {
    if (!bidListing) return
    const res = await marketplaceApi.placeBid(bidListing.id, data)
    setListings(prev => prev.map(l => l.id === bidListing.id ? { ...l, bid_count: l.bid_count + 1 } : l))
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
    } catch { alert('Failed to accept bid.') }
    finally { setAcceptingBid(null) }
  }

  const handleCounter = async (amount: string, notes: string) => {
    if (!counterBid) return
    await marketplaceApi.counterBid(counterBid.id, { amount, notes })
    loadMyListings()
    loadListings()
    // Refresh detail panel
    if (detailListing) {
      const r = await marketplaceApi.getListing(detailListing.id)
      setDetailListing(r.data)
    }
  }

  const handleCreateListing = async (data: any) => {
    const res = await marketplaceApi.createListing(data)
    loadListings()
    loadMyListings()
    return res.data
  }

  const displayedListings = tab === 'browse' ? listings : tab === 'my-listings' ? myListings : []

  // Estimate a market rate for a listing
  function getMarketRate(listing: FreightListing) {
    const corridor = `${(listing.origin ?? '').slice(0, 2).toUpperCase()}-${(listing.destination ?? '').slice(0, 2).toUpperCase()}`
    return MARKET_RATES[corridor] ?? { avg: 0.12, low: 0.08, high: 0.18 }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Freight Marketplace</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Browse, bid, negotiate, and close freight deals
          </p>
        </div>
        {canManageMarketplace && (
          <button onClick={() => setShowCreateForm(true)}
            className="px-4 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-colors flex items-center gap-2"
            style={{ background: 'var(--ct-orange)' }}>
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
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              tab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      {tab === 'browse' && (
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by origin city..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors ${
              showFilters ? 'bg-ct-orange/10 border-ct-orange text-ct-orange'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <Filter className="w-4 h-4" />
          </button>
        </div>
      )}

      {showFilters && tab === 'browse' && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden mb-6">
          <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
            {CARGO_FILTERS.map(f => (
              <button key={f.value} onClick={() => setCargoFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  cargoFilter === f.value ? 'bg-ct-orange text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* My Bids Tab */}
      {tab === 'my-bids' && (
        <div className="space-y-3">
          {myBids.length === 0 && !loading && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">You haven't placed any bids yet.</p>
          )}
          {myBids.map(bid => (
            <motion.div key={bid.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">Bid #{bid.id}</span>
                  <span className={`ml-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    bid.status === 'ACCEPTED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : bid.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : bid.status === 'COUNTERED' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
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
          <button onClick={loadListings} className="ml-auto text-red-700 dark:text-red-300 underline text-xs">Retry</button>
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
          {displayedListings.map(listing => (
            <ListingCard key={listing.id} listing={listing} onSelect={setDetailListing} onBid={setBidListing} showBidButton={tab === 'browse'} />
          ))}
          {displayedListings.length === 0 && (
            <p className="col-span-full text-sm text-gray-500 dark:text-gray-400 text-center py-12">
              {tab === 'my-listings' ? "You haven't posted any listings yet." : 'No listings found.'}
            </p>
          )}
        </div>
      )}

      {/* ── Detail Side Panel (with negotiation history) ──────────────────── */}
      <AnimatePresence>
        {detailListing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm"
            onClick={() => setDetailListing(null)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-800 h-full overflow-y-auto shadow-2xl border-l border-gray-200 dark:border-gray-700">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate">
                  {detailListing.origin} → {detailListing.destination}
                </h3>
                <button onClick={() => setDetailListing(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-6">
                {/* Market rate comparison */}
                {(() => {
                  const mr = getMarketRate(detailListing)
                  const bids = detailListing.bids ?? []
                  const lowestBid = bids.length > 0 ? Math.min(...bids.map(b => Number(b.amount))) : null
                  return (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Market Rate Guide</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Range</span>
                        <span className="font-semibold text-gray-900 dark:text-white">${mr.low.toFixed(2)} – ${mr.high.toFixed(2)} /ton·km</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-gray-600 dark:text-gray-400">Average</span>
                        <span className="font-semibold text-gray-900 dark:text-white">${mr.avg.toFixed(2)} /ton·km</span>
                      </div>
                      {lowestBid && (
                        <div className="flex items-center justify-between text-xs mt-1 pt-2 border-t border-blue-200 dark:border-blue-800">
                          <span className="text-gray-600 dark:text-gray-400">Lowest Bid</span>
                          <span className={`font-semibold ${lowestBid <= Number(detailListing.budget_max ?? Infinity) ? 'text-green-600' : 'text-amber-600'}`}>
                            ${lowestBid.toLocaleString()}
                            {lowestBid <= Number(detailListing.budget_max ?? Infinity)
                              ? <TrendingDown className="w-3 h-3 inline ml-1" />
                              : <TrendingUp className="w-3 h-3 inline ml-1" />}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cargo</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{detailListing.cargo_type_display}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Weight</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{(detailListing.weight_kg ?? 0).toLocaleString()} kg</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Pickup</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{new Date(detailListing.pickup_date).toLocaleDateString('en-KE')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Delivery</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{new Date(detailListing.delivery_date).toLocaleDateString('en-KE')}</p>
                  </div>
                  {detailListing.budget_min != null && detailListing.budget_max != null && (
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Budget Range</span>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${Number(detailListing.budget_min).toLocaleString()} – ${Number(detailListing.budget_max).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {detailListing.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detailListing.description}</p>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                      Negotiation History ({(detailListing.bids ?? []).length})
                    </h4>
                  </div>
                  {/* Negotiation timeline */}
                  <div className="space-y-3">
                    {(detailListing.bids ?? []).sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()).map(bid => (
                      <div key={bid.id}
                        className={`p-3 rounded-xl border ${
                          bid.status === 'ACCEPTED' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                          : bid.status === 'REJECTED' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                          : bid.status === 'COUNTERED' ? 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{bid.carrier_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              bid.status === 'ACCEPTED' ? 'bg-green-100 text-green-700'
                              : bid.status === 'REJECTED' ? 'bg-red-100 text-red-700'
                              : bid.status === 'COUNTERED' ? 'bg-purple-100 text-purple-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>{bid.status}</span>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-white/30">
                            {bid.created_at ? new Date(bid.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-green-600 dark:text-green-400">${Number(bid.amount).toLocaleString()}</span>
                          {bid.estimated_days && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {bid.estimated_days}d transit
                            </span>
                          )}
                        </div>
                        {bid.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic">"{bid.notes}"</p>
                        )}
                        {/* Accept / Counter buttons */}
                        {tab === 'my-listings' && bid.status === 'PENDING' && (
                          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => handleAcceptBid(bid.id)} disabled={acceptingBid === bid.id}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                              {acceptingBid === bid.id ? 'Accepting...' : 'Accept'}
                            </button>
                            <button onClick={() => setCounterBid(bid)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                              Counter
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {(!detailListing.bids || detailListing.bids.length === 0) && (
                      <p className="text-xs text-gray-400 dark:text-white/30 text-center py-4">No bids yet. Be the first to bid!</p>
                    )}
                  </div>
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

      {/* Counter Offer Modal */}
      <AnimatePresence>
        {counterBid && (
          <CounterOfferModal bid={counterBid} onCounter={handleCounter} onClose={() => setCounterBid(null)} />
        )}
      </AnimatePresence>

      {/* Create Listing Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <FreightListingForm onSubmit={handleCreateListing} onClose={() => setShowCreateForm(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
