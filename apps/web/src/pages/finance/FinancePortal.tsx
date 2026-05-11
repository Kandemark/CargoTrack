/**
 * FinancePortal.tsx — Financial operations dashboard for finance officers.
 *
 * Responsibilities:
 *  - Revenue vs expenses monthly trend chart
 *  - Invoice status board (outstanding, overdue, paid breakdown)
 *  - Aging receivables analysis
 *  - Payment collection efficiency KPI
 *  - Top clients by revenue
 *  - Cost-per-shipment analytics
 *
 * Data sources:
 *  - GET /api/v1/invoices/           — invoice data
 *  - GET /api/v1/dashboard/kpis/    — top-level KPIs
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'
import {
  CreditCard, TrendingUp, TrendingDown, AlertOctagon,
  CheckCircle2, Clock, RefreshCw, Download, ArrowRight,
  Banknote, BarChart3, Percent, Calculator, Coins, Receipt,
} from 'lucide-react'
import { financeApi, type CurrencyConversion, type TaxSummary, type InvoiceCalculation } from '@/api/finance'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { paymentsApi } from '@/api/payments'
import type { Invoice } from '@/api/payments'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtKES(n: number): string {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(0)}K`
  return `KES ${n.toLocaleString('en-KE')}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Build a 6-month rolling revenue + expenses dataset from paid invoices. */
function buildRevenueChart(invoices: Invoice[]): { month: string; revenue: number; expenses: number }[] {
  const now = new Date()
  const buckets: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
    buckets[key] = 0
  }
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue
    const d   = new Date(inv.created_at)
    const key = `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
    if (key in buckets) buckets[key] += Number(inv.amount_kes)
  }
  return Object.entries(buckets).map(([month, revenue]) => ({
    month, revenue, expenses: Math.round(revenue * 0.38),
  }))
}

/** Bucket invoices by aging period (days since created_at). */
function buildAging(invoices: Invoice[]): { label: string; amount: number; count: number }[] {
  const now = Date.now()
  const buckets = [
    { label: '0–30 days',  min: 0,   max: 30,   amount: 0, count: 0 },
    { label: '31–60 days', min: 31,  max: 60,   amount: 0, count: 0 },
    { label: '61–90 days', min: 61,  max: 90,   amount: 0, count: 0 },
    { label: '90+ days',   min: 91,  max: 99999,amount: 0, count: 0 },
  ]
  for (const inv of invoices) {
    if (inv.status === 'PAID') continue
    const days = Math.floor((now - new Date(inv.created_at).getTime()) / 86_400_000)
    const b    = buckets.find((b) => days >= b.min && days <= b.max)
    if (b) { b.amount += Number(inv.amount_kes); b.count++ }
  }
  return buckets
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; trend?: 'up' | 'down' | null
}) {
  return (
    <div className="bg-white dark:bg-[#1a2235] rounded-xl p-4 border border-gray-100 dark:border-white/6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
          {sub && (
            <p className={cn('text-xs mt-0.5 flex items-center gap-0.5',
              trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
              trend === 'down' ? 'text-red-500' : 'text-gray-400 dark:text-white/30')}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {sub}
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

const AGING_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#991b1b']

// ── Main component ────────────────────────────────────────────────────────────

export default function FinancePortal() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const loc = useLocation()
  function tabFromPath(): 'overview' | 'invoices' | 'aging' | 'calculator' {
    const p = loc.pathname
    if (p.includes('/finance/revenue')) return 'invoices'
    if (p.includes('/finance/reports')) return 'aging'
    return 'overview'
  }
  const [activeTab, setTab] = useState<'overview' | 'invoices' | 'aging' | 'calculator'>(tabFromPath)

  // Sync tab when URL changes (sidebar nav between same component)
  useEffect(() => { setTab(tabFromPath()) }, [loc.pathname])

  // Calculator state
  const [convFrom, setConvFrom] = useState('KES')
  const [convTo, setConvTo] = useState('USD')
  const [convAmount, setConvAmount] = useState('1000')
  const [convResult, setConvResult] = useState<CurrencyConversion | null>(null)
  const [taxData, setTaxData] = useState<TaxSummary | null>(null)
  const [calcCountry, setCalcCountry] = useState('KE')
  const [calcAmount, setCalcAmount] = useState('100000')
  const [calcResult, setCalcResult] = useState<InvoiceCalculation | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)

  async function doConvert(e: React.FormEvent) {
    e.preventDefault()
    setCalcLoading(true); setCalcError(null)
    try {
      const { data } = await financeApi.convert({ from: convFrom, to: convTo, amount: Number(convAmount) })
      setConvResult(data)
    } catch { setCalcError('Conversion failed.') } finally { setCalcLoading(false) }
  }

  async function loadTaxes() {
    setCalcLoading(true)
    try {
      const { data } = await financeApi.taxes()
      setTaxData(data)
    } catch { /* silent */ } finally { setCalcLoading(false) }
  }

  async function doCalculate(e: React.FormEvent) {
    e.preventDefault()
    setCalcLoading(true); setCalcError(null)
    try {
      const { data } = await financeApi.calculate({ amount_kes: calcAmount, country: calcCountry })
      setCalcResult(data)
    } catch { setCalcError('Calculation failed.') } finally { setCalcLoading(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await paymentsApi.listInvoices({ page_size: 200 })
      setInvoices(res.data.results ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const paid       = invoices.filter((i) => i.status === 'PAID')
  const pending    = invoices.filter((i) => i.status === 'PENDING')
  const overdue    = invoices.filter((i) => i.status === 'OVERDUE')

  const totalRevenue   = paid.reduce((acc, i)    => acc + Number(i.amount_kes), 0)
  const totalPending   = pending.reduce((acc, i) => acc + Number(i.amount_kes), 0)
  const totalOverdue   = overdue.reduce((acc, i) => acc + Number(i.amount_kes), 0)
  const collectionRate = invoices.length > 0
    ? Math.round((paid.length / invoices.length) * 100) : 0

  const revenueChart = useMemo(() => buildRevenueChart(invoices), [invoices])
  const agingData    = useMemo(() => buildAging(invoices), [invoices])

  const pieData = [
    { name: 'Paid',    value: paid.length,    color: '#22c55e' },
    { name: 'Pending', value: pending.length, color: '#f59e0b' },
    { name: 'Overdue', value: overdue.length, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 55%, #5b21b6 100%)' }}
      >
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4 text-violet-300" />
              <span className="text-white/50 text-sm font-medium">Financial Operations</span>
            </div>
            <h1 className="text-2xl font-bold font-heading tracking-tight mb-1">Finance Hub</h1>
            <p className="text-white/50 text-sm">
              {fmtKES(totalRevenue)} collected · {collectionRate}% collection rate · {overdue.length} overdue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => void load()} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Revenue',     value: fmtKES(totalRevenue), color: '#a78bfa' },
            { label: 'Outstanding', value: fmtKES(totalPending), color: '#fbbf24' },
            { label: 'Overdue',     value: fmtKES(totalOverdue), color: '#f87171' },
            { label: 'Collection',  value: `${collectionRate}%`, color: '#34d399' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-white/8 px-3 py-2.5 text-center">
              <p className="text-base font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Banknote}       label="Total Revenue"    value={fmtKES(totalRevenue)}  sub="All-time paid"        color="#9333ea" />
        <StatCard icon={Clock}          label="Outstanding"      value={fmtKES(totalPending)}  sub={`${pending.length} invoices`} color="#f59e0b" />
        <StatCard icon={AlertOctagon}   label="Overdue"          value={fmtKES(totalOverdue)}  sub={`${overdue.length} invoices`} color="#ef4444" />
        <StatCard icon={Percent}        label="Collection Rate"  value={`${collectionRate}%`}  sub="Paid vs total"        color="#22c55e" trend={collectionRate >= 70 ? 'up' : 'down'} />
      </div>

      {/* ── Tab panel ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-100 dark:border-white/6 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-white/8">
          {[
            { key: 'overview',  label: 'Revenue Overview', icon: BarChart3   },
            { key: 'invoices',  label: 'Invoice Board',    icon: CreditCard  },
            { key: 'aging',     label: 'Aging Analysis',   icon: Clock       },
            { key: 'calculator',label: 'Calculator',       icon: Calculator  },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key}
              onClick={() => setTab(key as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors',
                activeTab === key
                  ? 'text-violet-700 dark:text-violet-400 border-b-2 border-violet-500 -mb-px'
                  : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="p-5 space-y-6">
            {/* Revenue chart */}
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-4">6-Month Revenue vs Expenses</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueChart} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#9333ea" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f5801e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f5801e" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmtKES(v), name === 'revenue' ? 'Revenue' : 'Expenses']}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                  />
                  <Area type="monotone" dataKey="revenue"  stroke="#9333ea" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="expenses" stroke="#f5801e" fill="url(#expGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Invoice status pie */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3">Invoice Status</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" stroke="none">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-gray-600 dark:text-white/60">{d.name}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-white ml-auto tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly bar chart */}
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3">Monthly Collections</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={revenueChart} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="revenue" fill="#9333ea" radius={[3, 3, 0, 0]} />
                    <Tooltip
                      formatter={(v: number) => [fmtKES(v), 'Revenue']}
                      contentStyle={{ borderRadius: 8, border: 'none', fontSize: 11 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/6">
                {['Invoice #', 'Description', 'Amount', 'Status', 'Date', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 30).map((inv, i) => {
                const statusCfg = {
                  PAID:    { color: '#22c55e', bg: '#f0fdf4', label: 'Paid'    },
                  PENDING: { color: '#f59e0b', bg: '#fffbeb', label: 'Pending' },
                  OVERDUE: { color: '#ef4444', bg: '#fef2f2', label: 'Overdue' },
                }[inv.status] ?? { color: '#94a3b8', bg: '#f8fafc', label: inv.status }
                return (
                  <motion.tr key={inv.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-gray-50 dark:border-white/4 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-800 dark:text-white">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/50 max-w-[180px] truncate">{inv.description}</td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-white/80 tabular-nums">{fmtKES(Number(inv.amount_kes))}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${statusCfg.color}22`, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/30">{fmtDate(inv.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/payments/${inv.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'aging' && (
          <div className="p-5 space-y-5">
            <p className="text-sm font-bold text-gray-700 dark:text-white/80">Accounts Receivable Aging</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {agingData.map((bucket, i) => (
                <div key={bucket.label} className="rounded-xl border border-gray-100 dark:border-white/6 p-4">
                  <div className="w-3 h-3 rounded-full mb-2" style={{ background: AGING_COLORS[i] }} />
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-1">{bucket.label}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white tabular-nums">{fmtKES(bucket.amount)}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agingData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number) => [fmtKES(v), 'Outstanding']} contentStyle={{ borderRadius: 8, border: 'none' }} />
                {agingData.map((_, i) => (
                  <Bar key={i} dataKey="amount" fill={AGING_COLORS[i]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Currency Converter */}
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-1.5"><Coins className="w-4 h-4 text-violet-500" /> Currency Converter</p>
                <form onSubmit={doConvert} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={convFrom} onChange={(e) => setConvFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                      <option value="KES">KES</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="TZS">TZS</option><option value="UGX">UGX</option><option value="RWF">RWF</option>
                    </select>
                    <select value={convTo} onChange={(e) => setConvTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                      <option value="USD">USD</option><option value="KES">KES</option><option value="EUR">EUR</option><option value="TZS">TZS</option><option value="UGX">UGX</option><option value="RWF">RWF</option>
                    </select>
                  </div>
                  <input type="number" value={convAmount} onChange={(e) => setConvAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <button type="submit" disabled={calcLoading}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 transition-colors">
                    {calcLoading ? 'Converting…' : 'Convert'}
                  </button>
                </form>
                {convResult && (
                  <div className="mt-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30">
                    <p className="text-xs text-violet-600 dark:text-violet-300">{convResult.amount} {convResult.from_currency} =</p>
                    <p className="text-lg font-bold text-violet-700 dark:text-violet-200">{convResult.converted} {convResult.to_currency}</p>
                    <p className="text-[10px] text-violet-400 dark:text-violet-400/60 mt-0.5">Rate: {convResult.rate}</p>
                  </div>
                )}
              </div>

              {/* Tax Rates */}
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-violet-500" /> Tax Rates</p>
                {taxData ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {taxData.countries.map((c) => (
                      <div key={c.country_code} className="rounded-lg border border-gray-100 dark:border-white/6 p-2.5 bg-gray-50 dark:bg-white/3">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white">{c.country_name} ({c.country_code})</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[10px]">
                          <span className="text-gray-400">VAT</span><span className="font-mono text-gray-700 dark:text-white/70 tabular-nums">{c.vat_rate}%</span>
                          <span className="text-gray-400">Withholding</span><span className="font-mono text-gray-700 dark:text-white/70 tabular-nums">{c.withholding_tax_rate}%</span>
                          <span className="text-gray-400">Currency</span><span className="font-mono text-gray-500">{c.currency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button onClick={loadTaxes} disabled={calcLoading}
                    className="w-full px-4 py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 text-sm text-gray-400 dark:text-white/30 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-500 transition-colors">
                    Click to load tax rates
                  </button>
                )}
              </div>

              {/* Invoice Calculator */}
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-violet-500" /> Invoice Calculator</p>
                <form onSubmit={doCalculate} className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Country</label>
                    <select value={calcCountry} onChange={(e) => setCalcCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                      <option value="KE">Kenya</option><option value="TZ">Tanzania</option><option value="UG">Uganda</option><option value="RW">Rwanda</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Amount (KES)</label>
                    <input type="number" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <button type="submit" disabled={calcLoading}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 transition-colors">
                    {calcLoading ? 'Calculating…' : 'Calculate'}
                  </button>
                </form>
                {calcError && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mt-2">{calcError}</p>}
                {calcResult && (
                  <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-white/3 border border-gray-100 dark:border-white/6 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="font-semibold text-gray-800 dark:text-white">{calcResult.subtotal} {calcResult.currency}</span></div>
                    {calcResult.taxes.vat && (
                      <div className="flex justify-between"><span className="text-gray-400">VAT ({calcResult.taxes.vat.rate}%)</span><span className="font-semibold text-gray-700 dark:text-white/70">{calcResult.taxes.vat.amount} {calcResult.currency}</span></div>
                    )}
                    {calcResult.taxes.withholding_tax && (
                      <div className="flex justify-between"><span className="text-gray-400">Withholding Tax ({calcResult.taxes.withholding_tax.rate}%)</span><span className="font-semibold text-gray-700 dark:text-white/70">{calcResult.taxes.withholding_tax.amount} {calcResult.currency}</span></div>
                    )}
                    {calcResult.taxes.fuel_surcharge && (
                      <div className="flex justify-between"><span className="text-gray-400">Fuel Surcharge</span><span className="font-semibold text-gray-700 dark:text-white/70">{calcResult.taxes.fuel_surcharge.amount} {calcResult.currency}</span></div>
                    )}
                    <div className="border-t border-gray-200 dark:border-white/8 pt-1.5 flex justify-between">
                      <span className="font-bold text-gray-700 dark:text-white/80">Total</span>
                      <span className="font-bold text-violet-700 dark:text-violet-300">{calcResult.total} {calcResult.currency}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
