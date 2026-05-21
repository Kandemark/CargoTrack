/**
 * BulkActionBar — Floating toolbar for batch operations on selected rows.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckSquare } from 'lucide-react'

export interface BulkAction {
  label: string
  icon?: React.ElementType
  onClick: () => void
  variant?: 'default' | 'danger' | 'primary'
}

interface Props {
  count: number
  actions: BulkAction[]
  onClear: () => void
  loading?: boolean
}

export default function BulkActionBar({ count, actions, onClear, loading }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="sticky top-0 z-30 mb-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border"
          style={{
            background: 'var(--ct-navy)',
            borderColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <CheckSquare className="w-4 h-4 text-white/70" />
          <span className="text-sm font-semibold text-white">{count} selected</span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {actions.map((action) => {
              const variant = action.variant ?? 'default'
              const bg = variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : variant === 'primary'
                  ? 'bg-ct-orange hover:bg-orange-600 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              const Icon = action.icon as React.ComponentType<{ className?: string }> | undefined
              return (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  disabled={loading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${bg}`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {action.label}
                </button>
              )
            })}
          </div>
          <button onClick={onClear} className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
