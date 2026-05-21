/**
 * PaymentSheet.tsx — Provider-tabbed payment modal.
 * Tabs: M-Pesa | Airtel Money | MTN MoMo | Flutterwave | Card (Stripe)
 * On success: confetti burst + invoice status update.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { paymentsApi } from '@/api/payments'
import type { Invoice, PaymentProvider } from '@/types'

interface Tab {
  key: PaymentProvider
  label: string
  emoji: string
  countries: string
  inputLabel?: string
  inputPlaceholder?: string
}

const TABS: Tab[] = [
  { key: 'MPESA',       label: 'M-Pesa',        emoji: '🇰🇪', countries: 'Kenya · Tanzania', inputLabel: 'M-Pesa phone', inputPlaceholder: '254712345678' },
  { key: 'AIRTEL',      label: 'Airtel Money',   emoji: '🇺🇬', countries: 'Uganda · Rwanda · TZ', inputLabel: 'Airtel number', inputPlaceholder: '256712345678' },
  { key: 'MTN',         label: 'MTN MoMo',       emoji: '🇷🇼', countries: 'Uganda · Rwanda', inputLabel: 'MTN number', inputPlaceholder: '250712345678' },
  { key: 'FLUTTERWAVE', label: 'Flutterwave',    emoji: '🌍', countries: 'Pan-Africa', inputLabel: 'Phone / email', inputPlaceholder: '256712345678' },
  { key: 'STRIPE',      label: 'Card',           emoji: '💳', countries: 'International', inputLabel: 'Card token', inputPlaceholder: 'tok_visa (Stripe.js)' },
]

type Phase = 'idle' | 'pending' | 'success' | 'error'

interface Props {
  invoice: Invoice
  onClose: () => void
  onPaid: () => void
}

function ConfettiPop() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      {Array.from({ length: 30 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 400
        const y = (Math.random() - 1) * 400
        const color = ['#f5801e', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899'][i % 5]
        return (
          <motion.div key={i}
            className="absolute w-2 h-2 rounded-sm"
            style={{ background: color, top: '50%', left: '50%' }}
            animate={{ x, y, opacity: [1, 1, 0], rotate: Math.random() * 360 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.02 }}
          />
        )
      })}
    </div>
  )
}

export default function PaymentSheet({ invoice, onClose, onPaid }: Props) {
  const [tab,     setTab]     = useState<PaymentProvider>('MPESA')
  const [input,   setInput]   = useState('')
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [errMsg,  setErrMsg]  = useState('')
  const [confetti, setConfetti] = useState(false)

  const currentTab = TABS.find((t) => t.key === tab)!

  async function pay() {
    if (!input.trim()) { setErrMsg('Please enter the required field.'); return }
    setPhase('pending'); setErrMsg('')
    try {
      const payload = tab === 'STRIPE'
        ? { provider: tab, card_token: input.trim() }
        : { provider: tab, phone_number: input.trim() }
      await paymentsApi.payInvoice(invoice.id, payload)
      setPhase('success')
      setConfetti(true)
      setTimeout(() => { setConfetti(false); onPaid() }, 2500)
    } catch (err: unknown) {
      setPhase('error')
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrMsg(msg ?? 'Payment failed. Please try again.')
    }
  }

  return (
    <>
      {confetti && <ConfettiPop />}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white font-heading">Pay Invoice</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
                {invoice.invoice_number} · {Number(invoice.amount_kes).toLocaleString()} {invoice.currency}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success state */}
          {phase === 'success' ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="text-base font-semibold text-gray-900 dark:text-white">Payment initiated!</p>
              <p className="text-sm text-gray-500 dark:text-white/50 text-center max-w-xs">
                {tab === 'MPESA' || tab === 'AIRTEL' || tab === 'MTN'
                  ? 'Check your phone for the payment prompt.'
                  : 'Your payment is being processed.'}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Provider tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => { setTab(t.key); setInput(''); setErrMsg('') }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                      tab === t.key
                        ? 'bg-ct-navy text-white'
                        : 'bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/15',
                    )}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 text-xs text-gray-500 dark:text-white/40">
                {currentTab.countries}
              </div>

              {/* Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">
                  {currentTab.inputLabel}
                </label>
                <input
                  type="text" value={input} onChange={(e) => { setInput(e.target.value); setErrMsg('') }}
                  placeholder={currentTab.inputPlaceholder}
                  disabled={phase === 'pending'}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                />
              </div>

              {/* Error */}
              {(errMsg || phase === 'error') && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {errMsg || 'Payment failed. Please try again.'}
                </div>
              )}

              {tab === 'MPESA' && (
                <p className="text-xs text-gray-400 dark:text-white/30 leading-relaxed">
                  An STK push will be sent to your M-Pesa phone number. Enter your PIN when prompted.
                </p>
              )}

              <button onClick={pay} disabled={phase === 'pending'}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
                style={{ background: phase === 'pending' ? '#6b7280' : 'var(--ct-navy)' }}>
                {phase === 'pending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing…
                  </span>
                ) : (
                  `Pay ${Number(invoice.amount_kes).toLocaleString()} ${invoice.currency} via ${currentTab.label}`
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  )
}
