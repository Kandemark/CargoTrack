import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, DollarSign, Truck, User, FileText, Clock, Loader2 } from 'lucide-react'

interface Props {
  listingTitle: string
  budgetMin?: string | null
  budgetMax?: string | null
  onBid: (data: { amount: string; truck?: number; driver?: number; notes?: string; estimated_days?: number }) => Promise<any>
  onClose: () => void
}

export default function BidModal({ listingTitle, budgetMin, budgetMax, onBid, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [truck, setTruck] = useState('')
  const [driver, setDriver] = useState('')
  const [notes, setNotes] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid bid amount.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onBid({
        amount,
        truck: truck ? parseInt(truck) : undefined,
        driver: driver ? parseInt(driver) : undefined,
        notes: notes || undefined,
        estimated_days: estimatedDays ? parseInt(estimatedDays) : undefined,
      })
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to place bid.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Place Bid</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">{listingTitle}</p>

        {(budgetMin || budgetMax) && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Budget range: {budgetMin ? `$${budgetMin}` : ''}{budgetMin && budgetMax ? ' – ' : ''}{budgetMax ? `$${budgetMax}` : ''}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <DollarSign className="w-3 h-3 inline mr-1" /> Bid Amount *
            </label>
            <input
              type="number" step="0.01" min="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500.00"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <Truck className="w-3 h-3 inline mr-1" /> Truck ID
              </label>
              <input
                type="number" value={truck} onChange={(e) => setTruck(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <User className="w-3 h-3 inline mr-1" /> Driver ID
              </label>
              <input
                type="number" value={driver} onChange={(e) => setDriver(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <Clock className="w-3 h-3 inline mr-1" /> Estimated Days
            </label>
            <input
              type="number" min="1" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)}
              placeholder="e.g. 3"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <FileText className="w-3 h-3 inline mr-1" /> Notes
            </label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 w-full py-2.5 rounded-lg bg-ct-orange text-white font-semibold text-sm hover:bg-orange-600
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting...' : 'Submit Bid'}
        </button>
      </motion.div>
    </motion.div>
  )
}
