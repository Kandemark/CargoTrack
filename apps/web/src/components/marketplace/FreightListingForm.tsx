import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Package, Weight, Ruler, MapPin, Calendar, DollarSign, FileText, Loader2 } from 'lucide-react'
import type { FreightListingCreatePayload } from '@/types'

const CARGO_TYPES = [
  { value: 'GENERAL', label: 'General Cargo' },
  { value: 'PERISHABLE', label: 'Perishable' },
  { value: 'HAZARDOUS', label: 'Hazardous Materials' },
  { value: 'FRAGILE', label: 'Fragile' },
  { value: 'BULK', label: 'Bulk' },
  { value: 'CONTAINER', label: 'Containerized' },
  { value: 'LIQUID', label: 'Liquid' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'LIVESTOCK', label: 'Livestock' },
  { value: 'OTHER', label: 'Other' },
]

interface Props {
  onSubmit: (data: FreightListingCreatePayload) => Promise<any>
  onClose: () => void
}

export default function FreightListingForm({ onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    cargo_type: 'GENERAL', weight_kg: '', volume_m3: '',
    origin: '', destination: '',
    pickup_date: '', delivery_date: '',
    budget_min: '', budget_max: '', description: '',
    requires_hazmat: false, requires_reefer: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!form.origin || !form.destination || !form.weight_kg || !form.pickup_date || !form.delivery_date) {
      setError('Please fill in all required fields.')
      return
    }
    if (parseFloat(form.weight_kg) <= 0) {
      setError('Weight must be positive.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        cargo_type: form.cargo_type,
        weight_kg: parseFloat(form.weight_kg),
        volume_m3: form.volume_m3 ? parseFloat(form.volume_m3) : undefined,
        origin: form.origin,
        destination: form.destination,
        pickup_date: form.pickup_date,
        delivery_date: form.delivery_date,
        budget_min: form.budget_min || undefined,
        budget_max: form.budget_max || undefined,
        description: form.description || undefined,
        requires_hazmat: form.requires_hazmat,
        requires_reefer: form.requires_reefer,
      })
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create listing.')
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
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Post Freight Listing</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <Package className="w-3 h-3 inline mr-1" /> Cargo Type *
            </label>
            <select
              value={form.cargo_type}
              onChange={(e) => update('cargo_type', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
            >
              {CARGO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <Weight className="w-3 h-3 inline mr-1" /> Weight (kg) *
              </label>
              <input type="number" step="0.01" min="0.01"
                value={form.weight_kg} onChange={(e) => update('weight_kg', e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <Ruler className="w-3 h-3 inline mr-1" /> Volume (m³)
              </label>
              <input type="number" step="0.01" min="0"
                value={form.volume_m3} onChange={(e) => update('volume_m3', e.target.value)}
                placeholder="e.g. 12.5"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <MapPin className="w-3 h-3 inline mr-1" /> Origin *
              </label>
              <input type="text"
                value={form.origin} onChange={(e) => update('origin', e.target.value)}
                placeholder="e.g. Nairobi"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <MapPin className="w-3 h-3 inline mr-1" /> Destination *
              </label>
              <input type="text"
                value={form.destination} onChange={(e) => update('destination', e.target.value)}
                placeholder="e.g. Mombasa"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" /> Pickup Date *
              </label>
              <input type="date"
                value={form.pickup_date} onChange={(e) => update('pickup_date', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" /> Delivery Date *
              </label>
              <input type="date"
                value={form.delivery_date} onChange={(e) => update('delivery_date', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <DollarSign className="w-3 h-3 inline mr-1" /> Budget Min ($)
              </label>
              <input type="number" step="0.01" min="0"
                value={form.budget_min} onChange={(e) => update('budget_min', e.target.value)}
                placeholder="e.g. 1000"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <DollarSign className="w-3 h-3 inline mr-1" /> Budget Max ($)
              </label>
              <input type="number" step="0.01" min="0"
                value={form.budget_max} onChange={(e) => update('budget_max', e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <FileText className="w-3 h-3 inline mr-1" /> Description
            </label>
            <textarea
              value={form.description} onChange={(e) => update('description', e.target.value)}
              placeholder="Describe the cargo, handling requirements..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-ct-orange/50 focus:border-ct-orange outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.requires_hazmat}
                onChange={(e) => update('requires_hazmat', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-ct-orange focus:ring-ct-orange"
              />
              Requires Hazmat
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.requires_reefer}
                onChange={(e) => update('requires_reefer', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-ct-orange focus:ring-ct-orange"
              />
              Requires Reefer
            </label>
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
          {submitting ? 'Posting...' : 'Post Listing'}
        </button>
      </motion.div>
    </motion.div>
  )
}
