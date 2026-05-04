import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, CreditCard, AlertTriangle, RefreshCw, X, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, Download,
  CheckCircle, Clock, XCircle, RotateCcw,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { paymentsApi } from '@/api/payments'
import { shipmentsApi } from '@/api/shipments'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import type { Invoice, InvoiceStatus, ShipmentListItem } from '@/types'

const fmtKES = (v: number) =>
  v >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(1)}M` : `KES ${(v / 1_000).toFixed(0)}K`

function buildMonthlyRevenue(invoices: Invoice[]) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const buckets: Record<string, { income: number; count: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = MONTHS[d.getMonth()]
    buckets[key] = { income: 0, count: 0 }
  }
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue
    const d = new Date(inv.created_at)
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (monthsAgo < 0 || monthsAgo > 5) continue
    const key = MONTHS[d.getMonth()]
    if (key in buckets) {
      buckets[key].income += Number(inv.amount_kes)
      buckets[key].count++
    }
  }
  return Object.entries(buckets).map(([month, v]) => ({
    month,
    income: v.income,
    expenses: Math.round(v.income * 0.38),
    count: v.count,
  }))
}

function calcMoMTrend(data: { income: number }[]) {
  if (data.length < 2) return 0
  const prev = data[data.length - 2].income
  const curr = data[data.length - 1].income
  if (!prev) return 0
  return ((curr - prev) / prev) * 100
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<InvoiceStatus, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  PENDING:  { label: 'Pending',  bg: 'bg-amber-50 dark:bg-amber-900/20',      text: 'text-amber-700 dark:text-amber-300',    icon: Clock       },
  PAID:     { label: 'Paid',     bg: 'bg-emerald-50 dark:bg-emerald-900/20',  text: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle },
  FAILED:   { label: 'Failed',   bg: 'bg-red-50 dark:bg-red-900/20',          text: 'text-red-700 dark:text-red-300',         icon: XCircle     },
  REFUNDED: { label: 'Refunded', bg: 'bg-gray-100 dark:bg-white/8',           text: 'text-gray-600 dark:text-white/60',       icon: RotateCcw   },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.PENDING
  const Icon = c.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', c.bg, c.text)}>
      <Icon className="w-3 h-3" />{c.label}
    </span>
  )
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

// ── Create modal (unchanged) ──────────────────────────────────────────────────

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
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
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
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                {['KES', 'USD', 'UGX', 'RWF', 'TZS'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/10 rounded-xl shadow-elevated px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 dark:text-white/80 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 dark:text-white/50">{p.name}:</span>
          <span className="font-semibold text-gray-700 dark:text-white/80">{fmtKES(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Payments() {
  const [invoices,    setInvoices]    = useState<Invoice[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL')

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await paymentsApi.listInvoices({ page_size: 200 })
      setInvoices(res.data.results)
    } catch {
      setError('Failed to load invoices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() =>
    statusFilter === 'ALL' ? invoices : invoices.filter(i => i.status === statusFilter),
    [invoices, statusFilter])

  const stats = useMemo(() => {
    const paid  = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount_kes), 0)
    const pending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.amount_kes), 0)
    const failed  = invoices.filter(i => i.status === 'FAILED').length
    return { paid, pending, failed, total: invoices.length }
  }, [invoices])

  const revenueData = useMemo(() => buildMonthlyRevenue(invoices), [invoices])
  const momTrend    = useMemo(() => calcMoMTrend(revenueData), [revenueData])

  const providerBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const inv of invoices) {
      const p = inv.payments[0]?.provider ?? 'Direct'
      map[p] = (map[p] ?? 0) + Number(inv.amount_kes)
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [invoices])

  if (error) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  const PROVIDER_COLORS = ['#0f2d5e', '#f97316', '#22c55e', '#8b5cf6', '#ef4444']

  return (
    <div className="space-y-5 pb-4">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Payments & Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">{stats.total} invoices · financial overview</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-white/8 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--ct-orange)' }}>
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
        </div>
      </motion.div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: fmtKES(stats.paid), sub: 'Paid invoices', icon: TrendingUp, color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15' },
          { label: 'Pending', value: fmtKES(stats.pending), sub: 'Awaiting payment', icon: Clock, color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/15' },
          { label: 'Failed', value: `${stats.failed}`, sub: 'Need attention', icon: XCircle, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/15' },
          { label: 'Total Invoices', value: `${stats.total}`, sub: 'All time', icon: CreditCard, color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/15' },
        ].map(({ label, value, sub, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{loading ? '—' : value}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-white/50 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 dark:text-white/25 mt-2 border-t border-gray-100 dark:border-white/6 pt-2">{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue trend */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="xl:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Revenue Overview</h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Income vs expenses — 6-month trend</p>
            </div>
            <div className={cn('flex items-center gap-1 text-xs font-semibold', momTrend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {momTrend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {momTrend >= 0 ? '+' : ''}{momTrend.toFixed(1)}% MoM
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gPayInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f2d5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0f2d5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPayExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={fmtKES} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#0f2d5e" fill="url(#gPayInc)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f97316" fill="url(#gPayExp)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Provider breakdown */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">By Provider</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-4">Revenue by payment provider</p>
          {loading ? <Sk className="h-40 w-full rounded-xl" /> : (
            <div className="space-y-1">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={providerBreakdown} layout="vertical" barCategoryGap="20%" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={fmtKES} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip formatter={(v: number) => fmtKES(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" name="Revenue" radius={[0, 3, 3, 0]}>
                    {providerBreakdown.map((_, i) => <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="pt-2 space-y-1.5">
                {providerBreakdown.slice(0, 4).map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[i % PROVIDER_COLORS.length] }} />
                      <span className="text-gray-500 dark:text-white/40">{name}</span>
                    </div>
                    <span className="font-semibold text-gray-700 dark:text-white/70">{fmtKES(value)}</span>
                  </div>
                ))}
                {providerBreakdown.length === 0 && <p className="text-xs text-gray-400 dark:text-white/30 text-center py-2">No data yet</p>}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Invoice table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">All Invoices</h2>
          <div className="flex gap-1">
            {(['ALL', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  statusFilter === s ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
                style={statusFilter === s ? { background: 'var(--ct-navy)' } : {}}>
                {s === 'ALL' ? 'All' : STATUS_CFG[s].label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DataTable<Invoice & Record<string, unknown>>
            columns={[
              { key: 'invoice_number', header: 'Invoice', render: (row: Invoice) => (
                <Link to={`/payments/${row.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">{row.invoice_number}</Link>
              )},
              { key: 'shipment_tracking', header: 'Shipment', render: (row: Invoice) => (
                <span className="font-mono text-xs text-gray-600 dark:text-white/60">{row.shipment_tracking}</span>
              )},
              { key: 'amount_kes', header: 'Amount', align: 'right', render: (row: Invoice) => (
                <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{Number(row.amount_kes).toLocaleString()} <span className="text-xs text-gray-400 dark:text-white/30">{row.currency}</span></span>
              )},
              { key: 'status', header: 'Status', render: (row: Invoice) => <StatusBadge status={row.status} /> },
              { key: 'provider', header: 'Provider', render: (row: Invoice) => (
                <span className="text-xs text-gray-500 dark:text-white/40">{row.payments[0]?.provider ?? '—'}</span>
              )},
              { key: 'created_at', header: 'Date', render: (row: Invoice) => (
                <span className="text-xs text-gray-500 dark:text-white/40">{new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              )},
              { key: 'actions', header: 'Actions', align: 'center', render: (row: Invoice) => (
                <Link to={`/payments/${row.id}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ArrowUpRight className="w-3 h-3" /></Link>
              )},
            ] as ColumnDef<Record<string, unknown>>[]}
            data={(filtered as unknown as Record<string, unknown>[])}
            searchable
            searchPlaceholder="Search invoices…"
            emptyTitle="No invoices found"
            emptyDescription="Create your first invoice to get started."
            pageSize={15}
          />
        )}
      </motion.div>

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load() }} />}
      </AnimatePresence>
    </div>
  )
}
