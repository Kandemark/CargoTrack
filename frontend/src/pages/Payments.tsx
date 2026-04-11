/**
 * Payments.tsx — Invoice list with create-invoice modal.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CreditCard, AlertTriangle, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { paymentsApi } from '@/api/payments'
import { shipmentsApi } from '@/api/shipments'
import type { Invoice, InvoiceStatus, Route, ShipmentListItem } from '@/types'

const STATUS_CFG: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  PENDING:  { label: 'Pending',  bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-300'  },
  PAID:     { label: 'Paid',     bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
  FAILED:   { label: 'Failed',   bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-300'      },
  REFUNDED: { label: 'Refunded', bg: 'bg-gray-100 dark:bg-white/8',        text: 'text-gray-600 dark:text-white/60'    },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.PENDING
  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', c.bg, c.text)}>{c.label}</span>
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [form, setForm] = useState({ shipment: '', amount_kes: '', currency: 'KES', description: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    shipmentsApi.getShipments({ page_size: 200 }).then((r) => setShipments(r.data.results))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.shipment || !form.amount_kes) { setErr('Shipment and amount are required.'); return }
    setSaving(true); setErr('')
    try {
      await paymentsApi.createInvoice({ shipment: Number(form.shipment), amount_kes: form.amount_kes, currency: form.currency, description: form.description })
      onCreated()
    } catch {
      setErr('Failed to create invoice. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated w-full max-w-md border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white font-heading">Create Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Shipment *</label>
            <select value={form.shipment} onChange={(e) => setForm((f) => ({ ...f, shipment: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select shipment…</option>
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>{s.tracking_number} · {s.route.origin} → {s.route.destination}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Amount *</label>
              <input type="number" min="1" step="0.01" value={form.amount_kes} onChange={(e) => setForm((f) => ({ ...f, amount_kes: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {['KES', 'USD', 'UGX', 'RWF', 'TZS'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default function Payments() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await paymentsApi.listInvoices({ page_size: 100 })
      setInvoices(res.data.results)
    } catch {
      setError('Failed to load invoices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">{invoices.length} invoices</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--ct-orange)' }}>
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500 dark:text-white/50">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <CreditCard className="w-10 h-10 text-gray-200 dark:text-white/15" />
              <p className="text-sm font-medium text-gray-500 dark:text-white/50">No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/8">
                    <th className="px-5 py-3.5 text-left font-medium">Invoice #</th>
                    <th className="px-5 py-3.5 text-left font-medium">Shipment</th>
                    <th className="px-5 py-3.5 text-left font-medium">Amount</th>
                    <th className="px-5 py-3.5 text-left font-medium">Status</th>
                    <th className="px-5 py-3.5 text-left font-medium">Provider</th>
                    <th className="px-5 py-3.5 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  <AnimatePresence initial={false}>
                    {invoices.map((inv, i) => (
                      <motion.tr key={inv.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link to={`/payments/${inv.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-white/60">{inv.shipment_tracking}</td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                          {Number(inv.amount_kes).toLocaleString()} {inv.currency}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                          {inv.payments[0]?.provider ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                          {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load() }} />}
      </AnimatePresence>
    </div>
  )
}
