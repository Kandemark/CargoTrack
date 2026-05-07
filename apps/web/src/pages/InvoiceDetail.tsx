/**
 * InvoiceDetail.tsx — Invoice detail with payment history + Pay Now button.
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Download, CreditCard, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { paymentsApi } from '@/api/payments'
import PaymentSheet from '@/components/PaymentSheet'
import type { Invoice, InvoiceStatus, PaymentStatus } from '@/types'

const INV_STATUS: Record<InvoiceStatus, { label: string; dot: string; text: string }> = {
  PENDING:  { label: 'Pending',  dot: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-300'    },
  PAID:     { label: 'Paid',     dot: 'bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
  FAILED:   { label: 'Failed',   dot: 'bg-red-400',     text: 'text-red-700 dark:text-red-300'         },
  REFUNDED: { label: 'Refunded', dot: 'bg-gray-400',    text: 'text-gray-600 dark:text-white/50'       },
}
const PAY_STATUS_DOT: Record<PaymentStatus, string> = {
  PENDING:   'bg-amber-400',
  SUCCESS:   'bg-emerald-400',
  FAILED:    'bg-red-400',
  CANCELLED: 'bg-gray-400',
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [paying,  setPaying]  = useState(false)

  async function load() {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const res = await paymentsApi.getInvoice(Number(id))
      setInvoice(res.data)
    } catch {
      setError('Invoice not found.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !invoice) return (
    <div className="flex flex-col items-center py-24 gap-4">
      <AlertTriangle className="w-10 h-10 text-red-400" />
      <p className="text-sm text-gray-600 dark:text-white/60">{error ?? 'Invoice not found.'}</p>
      <Link to="/payments" className="text-sm font-medium text-blue-600 hover:underline">← Back to Payments</Link>
    </div>
  )

  const st = INV_STATUS[invoice.status]

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/payments" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{invoice.invoice_number}</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">Shipment: <span className="font-mono">{invoice.shipment_tracking}</span></p>
        </div>
      </div>

      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">
              {Number(invoice.amount_kes).toLocaleString()} <span className="text-lg text-gray-400 dark:text-white/40">{invoice.currency}</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn('w-2 h-2 rounded-full', st.dot)} />
              <span className={cn('text-sm font-semibold', st.text)}>{st.label}</span>
            </div>
            {invoice.description && <p className="text-sm text-gray-500 dark:text-white/50 mt-2 max-w-sm">{invoice.description}</p>}
          </div>
          <div className="flex flex-col gap-2">
            {invoice.status !== 'PAID' && invoice.status !== 'REFUNDED' && (
              <button onClick={() => setPaying(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: 'var(--ct-orange)' }}>
                <CreditCard className="w-4 h-4" /> Pay Now
              </button>
            )}
            <a
              href={paymentsApi.getPdfUrl(invoice.id)}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <Download className="w-4 h-4" /> Download PDF
            </a>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/8 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Created</p>
            <p className="font-medium text-gray-700 dark:text-white/80">
              {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {invoice.paid_at && (
            <div>
              <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Paid on</p>
              <p className="font-medium text-emerald-600 dark:text-emerald-400">
                {new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Payment history */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Payment Attempts</h2>
        </div>
        {invoice.payments.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <Clock className="w-8 h-8 text-gray-200 dark:text-white/15" />
            <p className="text-sm text-gray-400 dark:text-white/30">No payment attempts yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {invoice.payments.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-5 py-3.5">
                {p.status === 'SUCCESS' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-0.5', PAY_STATUS_DOT[p.status])} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-white">{p.provider}</p>
                  {p.provider_reference && (
                    <p className="font-mono text-xs text-gray-400 dark:text-white/30 truncate">{p.provider_reference}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                    {Number(p.amount).toLocaleString()} {p.currency}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/30">
                    {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {paying && (
          <PaymentSheet
            invoice={invoice}
            onClose={() => setPaying(false)}
            onPaid={() => { setPaying(false); void load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
