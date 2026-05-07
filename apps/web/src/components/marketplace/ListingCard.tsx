import { motion } from 'framer-motion'
import { Calendar, Clock, DollarSign, Shield, Snowflake, Gavel } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FreightListing } from '@/types'

const CARGO_LABELS: Record<string, string> = {
  GENERAL:    'General', PERISHABLE: 'Perishable', HAZARDOUS: 'Hazmat',
  FRAGILE:    'Fragile', BULK: 'Bulk', CONTAINER: 'Containerized',
  LIQUID:     'Liquid', VEHICLES: 'Vehicles', LIVESTOCK: 'Livestock', OTHER: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  OPEN:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  AWARDED:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  CANCELLED:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

interface Props {
  listing: FreightListing
  onSelect?: (listing: FreightListing) => void
  onBid?: (listing: FreightListing) => void
  showBidButton?: boolean
}

export default function ListingCard({ listing, onSelect, onBid, showBidButton }: Props) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect?.(listing)}
      className="group bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50
        p-5 hover:shadow-lg hover:border-ct-orange/30 dark:hover:border-ct-orange/30 cursor-pointer
        transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {listing.origin} <span className="text-gray-400 mx-1.5">→</span> {listing.destination}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            <span>{CARGO_LABELS[listing.cargo_type] ?? listing.cargo_type_display}</span>
            <span>·</span>
            <span>{listing.weight_kg.toLocaleString()} kg</span>
            {listing.volume_m3 && <><span>·</span><span>{listing.volume_m3} m³</span></>}
          </p>
        </div>
        <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide shrink-0', STATUS_STYLES[listing.status])}>
          {listing.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
          Pickup: {fmt(listing.pickup_date)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
          Delivery: {fmt(listing.delivery_date)}
        </div>
        {(listing.budget_min || listing.budget_max) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 col-span-2">
            <DollarSign className="w-3 h-3 text-gray-400 shrink-0" />
            Budget: {listing.budget_min ? `$${listing.budget_min}` : ''}
            {listing.budget_min && listing.budget_max ? ' – ' : ''}
            {listing.budget_max ? `$${listing.budget_max}` : ''}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-3">
        {listing.requires_hazmat && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
            <Shield className="w-3 h-3" /> Hazmat
          </span>
        )}
        {listing.requires_reefer && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-0.5 rounded">
            <Snowflake className="w-3 h-3" /> Reefer
          </span>
        )}
        {listing.bid_count > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
            <Gavel className="w-3 h-3" /> {listing.bid_count} bid{listing.bid_count !== 1 ? 's' : ''}
            {listing.lowest_bid != null && (
              <span className="text-green-600 dark:text-green-400 ml-1">
                · Lowest ${Number(listing.lowest_bid).toLocaleString()}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/50">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Posted by {listing.posted_by_name}
        </span>
        {showBidButton && listing.status === 'OPEN' && (
          <button
            onClick={(e) => { e.stopPropagation(); onBid?.(listing) }}
            className="px-3 py-1.5 rounded-lg bg-ct-orange text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
          >
            Place Bid
          </button>
        )}
      </div>
    </motion.div>
  )
}
