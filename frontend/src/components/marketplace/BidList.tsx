import { motion } from 'framer-motion'
import { Truck, User, Clock, Check, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bid } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACCEPTED:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WITHDRAWN: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

interface Props {
  bids: Bid[]
  isOwner?: boolean
  onAccept?: (bidId: number) => void
  acceptingBid?: number | null
}

export default function BidList({ bids, isOwner, onAccept, acceptingBid }: Props) {
  if (bids.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
        No bids yet. Be the first to bid!
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {bids.map((bid, i) => (
        <motion.div
          key={bid.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3 border border-gray-200 dark:border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-white">{bid.carrier_name}</span>
              <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded', STATUS_STYLES[bid.status])}>
                {bid.status}
              </span>
            </div>
            <span className="font-bold text-sm text-green-600 dark:text-green-400">
              ${Number(bid.amount).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            {bid.truck_info && (
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3" /> {bid.truck_info.plate}
              </span>
            )}
            {bid.driver_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {bid.driver_name}
              </span>
            )}
            {bid.estimated_days && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {bid.estimated_days} days
              </span>
            )}
          </div>

          {bid.notes && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1">
              <FileText className="w-3 h-3 mt-0.5 shrink-0" />
              {bid.notes}
            </p>
          )}

          {isOwner && bid.status === 'PENDING' && onAccept && (
            <button
              onClick={() => onAccept(bid.id)}
              disabled={acceptingBid === bid.id}
              className="mt-2 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3 h-3" />
              {acceptingBid === bid.id ? 'Accepting...' : 'Accept Bid'}
            </button>
          )}
        </motion.div>
      ))}
    </div>
  )
}
