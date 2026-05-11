/**
 * @route /predictions  @auth IsAuthenticated
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, TrendingUp, AlertTriangle, RefreshCw, Search,
  Shield, Zap, Activity, Target, ChevronDown, ChevronUp,
  MapPin, Clock, Package, ArrowUpRight, Filter,
  BarChart2, Info,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { predictionsApi } from '@/api/predictions'
import type { DelayPrediction, ShipmentListItem } from '@/types'

// ── Types & utils ──────────────────────────────────────────────────────────────

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

function getRiskLevel(score: number): RiskLevel {
  if (score >= 0.7) return 'HIGH'
  if (score >= 0.4) return 'MEDIUM'
  return 'LOW'
}

const RISK_CFG: Record<RiskLevel, {
  label: string; badge: string; text: string; bar: string; dot: string; pill: string
}> = {
  HIGH:   { label: 'High Risk',   badge: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     bar: '#ef4444', dot: 'bg-red-500',    pill: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400'     },
  MEDIUM: { label: 'Medium Risk', badge: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', bar: '#f59e0b', dot: 'bg-amber-400',  pill: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' },
  LOW:    { label: 'Low Risk',    badge: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', bar: '#22c55e', dot: 'bg-emerald-400', pill: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
}

interface PredictionRow {
  shipment: ShipmentListItem
  prediction: DelayPrediction | null
  loading: boolean
  error: boolean
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

function RiskBar({ score }: { score: number }) {
  const pct  = Math.round(score * 100)
  const color = pct >= 70 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden max-w-[80px]">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── Quick ML Tool Card ──────────────────────────────────────────────────────────

interface MLField {
  key: string; label: string; type: 'text' | 'select'; placeholder?: string; options?: string[]
}

function MLToolCard({ title, desc, fields, runner, resultFn }: {
  title: string; desc: string
  fields: MLField[]
  runner: (vals: Record<string, string>) => Promise<Record<string, unknown>>
  resultFn: (data: Record<string, unknown>) => string
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.key, f.options?.[0] ?? '']))
  )
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr(''); setResult(null)
    try {
      const data = await runner(vals)
      setResult(resultFn(data))
    } catch {
      setErr('Prediction failed')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={run} className="rounded-xl border border-gray-100 dark:border-white/6 p-4 bg-gray-50/50 dark:bg-white/2 space-y-2">
      <div>
        <p className="text-xs font-semibold text-gray-800 dark:text-white">{title}</p>
        <p className="text-[10px] text-gray-400 dark:text-white/30">{desc}</p>
      </div>
      {fields.map(f => f.type === 'select' ? (
        <select key={f.key} value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-400">
          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input key={f.key} value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
          placeholder={f.placeholder} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
      ))}
      <button type="submit" disabled={loading}
        className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 transition-colors">
        {loading ? 'Running…' : 'Run'}
      </button>
      {err && <p className="text-[10px] text-red-500">{err}</p>}
      {result && <p className="text-xs font-semibold text-gray-700 dark:text-white/70 bg-white dark:bg-white/5 rounded-lg px-2.5 py-1.5">{result}</p>}
    </form>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Predictions() {
  const [rows,       setRows]       = useState<PredictionRow[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL')
  const [expanded,   setExpanded]   = useState<number | null>(null)
  const [predicting, setPredicting] = useState<number | null>(null)

  async function load() {
    setError(null); setIsLoading(true)
    try {
      const listRes = await shipmentsApi.getShipments({ status: 'IN_TRANSIT', page_size: 100 })
      const shipments = listRes.data.results

      const seed: PredictionRow[] = shipments.map(s => ({
        shipment: s, prediction: null, loading: true, error: false,
      }))
      setRows(seed)
      setIsLoading(false)

      const settled = await Promise.allSettled(shipments.map(s => shipmentsApi.predictDelay(s.id)))

      setRows(prev => prev.map((row, i) => ({
        ...row,
        prediction: settled[i].status === 'fulfilled' ? settled[i].value.data : null,
        loading: false,
        error: settled[i].status === 'rejected',
      })).sort((a, b) => {
        const ra = a.prediction?.delay_risk_score ?? -1
        const rb = b.prediction?.delay_risk_score ?? -1
        return rb - ra
      }))
    } catch {
      setError('Failed to load predictions. Please try again.')
      setIsLoading(false)
    }
  }

  async function refreshOne(id: number) {
    setPredicting(id)
    try {
      const res = await shipmentsApi.predictDelay(id)
      setRows(prev => prev.map(r =>
        r.shipment.id === id ? { ...r, prediction: res.data, loading: false, error: false } : r
      ))
    } catch { /* ignore */ }
    setPredicting(null)
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = rows
    if (riskFilter !== 'ALL') {
      list = list.filter(r => r.prediction && getRiskLevel(r.prediction.delay_risk_score) === riskFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.shipment.tracking_number.toLowerCase().includes(q) ||
        r.shipment.route.origin.toLowerCase().includes(q) ||
        r.shipment.route.destination.toLowerCase().includes(q) ||
        r.shipment.carrier_name.toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, riskFilter, search])

  const stats = useMemo(() => {
    const withPreds = rows.filter(r => r.prediction)
    const high   = withPreds.filter(r => getRiskLevel(r.prediction!.delay_risk_score) === 'HIGH').length
    const medium = withPreds.filter(r => getRiskLevel(r.prediction!.delay_risk_score) === 'MEDIUM').length
    const low    = withPreds.filter(r => getRiskLevel(r.prediction!.delay_risk_score) === 'LOW').length
    const avgScore = withPreds.length > 0
      ? withPreds.reduce((s, r) => s + r.prediction!.delay_risk_score, 0) / withPreds.length
      : 0
    const predictedDelayed = withPreds.filter(r => r.prediction!.predicted_delayed).length
    return { total: rows.length, withPreds: withPreds.length, high, medium, low, avgScore, predictedDelayed }
  }, [rows])

  const riskDistData = [
    { name: 'High',   value: stats.high,   fill: '#ef4444' },
    { name: 'Medium', value: stats.medium, fill: '#f59e0b' },
    { name: 'Low',    value: stats.low,    fill: '#22c55e' },
  ].filter(d => d.value > 0)

  const scoreChartData = useMemo(() =>
    rows
      .filter(r => r.prediction)
      .slice(0, 15)
      .map(r => ({
        name: r.shipment.tracking_number,
        score: Math.round(r.prediction!.delay_risk_score * 100),
        fill: r.prediction!.delay_risk_score >= 0.7 ? '#ef4444' : r.prediction!.delay_risk_score >= 0.4 ? '#f59e0b' : '#22c55e',
      })),
  [rows])

  if (error) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-500 dark:text-white/50">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-4">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading flex items-center gap-2">
            <Brain className="w-6 h-6" style={{ color: 'var(--ct-orange)' }} />
            AI Delay Predictions
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            ML-powered risk assessment · {stats.withPreds} shipments scored · avg risk {Math.round(stats.avgScore * 100)}%
          </p>
        </div>
        <button onClick={load} disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} /> Refresh All
        </button>
      </motion.div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'In Transit',    value: stats.total,          icon: Activity,   color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/15'       },
          { label: 'High Risk',     value: stats.high,           icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/15'      },
          { label: 'Medium Risk',   value: stats.medium,         icon: TrendingUp, color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/15'     },
          { label: 'Low Risk',      value: stats.low,            icon: Shield,     color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/15'  },
          { label: 'Predicted Late',value: stats.predictedDelayed, icon: Target,   color: '#f5801e', bg: 'bg-orange-50 dark:bg-orange-900/15'   },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', bg)}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{value}</p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      {!isLoading && stats.withPreds > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Risk score bar chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="xl:col-span-2 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Risk Score Heatmap</h2>
                <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Top {scoreChartData.length} highest-risk shipments</p>
              </div>
              <BarChart2 className="w-4 h-4 text-gray-300 dark:text-white/20" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreChartData} layout="vertical" barCategoryGap="20%" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={90} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Risk Score']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                  {scoreChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Risk distribution donut */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading">Risk Distribution</h2>
                <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">Breakdown by level</p>
              </div>
              <Info className="w-4 h-4 text-gray-300 dark:text-white/20" />
            </div>
            {riskDistData.length > 0 ? (
              <div className="flex flex-col items-center gap-3 flex-1">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={riskDistData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                      {riskDistData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5">
                  {riskDistData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-gray-600 dark:text-white/60">{d.name} Risk</span>
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-white/80">
                        {d.value} ({stats.withPreds > 0 ? Math.round((d.value / stats.withPreds) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-400 dark:text-white/30">No prediction data yet</p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking, route, carrier…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-card" />
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-1 shadow-card">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
            <button key={r} onClick={() => setRiskFilter(r)}
              className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                riskFilter === r ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
              style={riskFilter === r ? {
                background: r === 'HIGH' ? '#ef4444' : r === 'MEDIUM' ? '#f59e0b' : r === 'LOW' ? '#22c55e' : 'var(--ct-navy)'
              } : {}}>
              {r === 'ALL' ? 'All' : RISK_CFG[r].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-white/30">{filtered.length} results</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 rounded-2xl border border-gray-100 dark:border-white/6 bg-white dark:bg-[#1a2235]">
              <Sk className="h-3.5 w-28 rounded" /><Sk className="h-3.5 flex-1 rounded" /><Sk className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8">
          <Brain className="w-10 h-10 text-gray-200 dark:text-white/15" />
          <p className="text-sm font-medium text-gray-500 dark:text-white/50">
            {search || riskFilter !== 'ALL' ? 'No shipments match your filters.' : 'No in-transit shipments to predict.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/6 bg-gray-50/50 dark:bg-white/2">
                <th className="px-5 py-3 text-left font-medium">Tracking #</th>
                <th className="px-5 py-3 text-left font-medium">Route</th>
                <th className="px-5 py-3 text-left font-medium">Carrier</th>
                <th className="px-5 py-3 text-left font-medium">Risk Level</th>
                <th className="px-5 py-3 text-left font-medium">Risk Score</th>
                <th className="px-5 py-3 text-left font-medium">Delayed?</th>
                <th className="px-5 py-3 text-left font-medium">Confidence</th>
                <th className="px-5 py-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {filtered.map(({ shipment: s, prediction: p, loading: rowLoading, error: rowError }) => {
                const level  = p ? getRiskLevel(p.delay_risk_score) : null
                const cfg    = level ? RISK_CFG[level] : null
                const isExpanded = expanded === s.id
                return (
                  <AnimatePresence key={s.id}>
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={cn('hover:bg-gray-50/70 dark:hover:bg-white/4 transition-colors cursor-pointer',
                        isExpanded && 'bg-blue-50/40 dark:bg-blue-900/10')}
                      onClick={() => setExpanded(isExpanded ? null : s.id)}>
                      <td className="px-5 py-3.5">
                        <Link to={`/shipments/${s.id}`} onClick={e => e.stopPropagation()}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline">
                          {s.tracking_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-300 shrink-0" />
                          {s.route.origin} → {s.route.destination}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">{s.carrier_name}</td>
                      <td className="px-5 py-3.5">
                        {rowLoading ? <Sk className="h-5 w-20 rounded-full" /> :
                         rowError   ? <span className="text-xs text-gray-400 dark:text-white/25">Error</span> :
                         level && cfg ? (
                           <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.badge, cfg.text)}>
                             <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                             {cfg.label}
                           </span>
                         ) : <span className="text-gray-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {rowLoading ? <Sk className="h-3 w-24 rounded" /> :
                         p ? <RiskBar score={p.delay_risk_score} /> :
                         <span className="text-gray-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {rowLoading ? <Sk className="h-5 w-10 rounded-full" /> :
                         p ? (
                           <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-bold',
                             p.predicted_delayed ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400')}>
                             {p.predicted_delayed ? 'Yes' : 'No'}
                           </span>
                         ) : <span className="text-gray-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-gray-600 dark:text-white/60 tabular-nums">
                        {rowLoading ? <Sk className="h-3 w-10 rounded" /> :
                         p ? `${Math.round(p.confidence * 100)}%` :
                         '—'}
                      </td>
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => void refreshOne(s.id)} disabled={predicting === s.id}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-40">
                          <Zap className={cn('w-3 h-3', predicting === s.id && 'animate-spin')} />
                          {predicting === s.id ? 'Updating…' : 'Re-predict'}
                        </button>
                      </td>
                    </motion.tr>

                    {/* Expanded detail row */}
                    {isExpanded && p && (
                      <tr key={`${s.id}-detail`} className="bg-blue-50/30 dark:bg-blue-900/5">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wide mb-2">Shipment Details</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Weight',    value: `${s.weight_kg?.toLocaleString() ?? '—'} kg`,                                                             icon: Package },
                                  { label: 'Departure', value: new Date(s.scheduled_departure).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), icon: Clock   },
                                  { label: 'Arrival',   value: new Date(s.scheduled_arrival).toLocaleDateString('en-GB',   { day:'numeric', month:'short', year:'numeric' }), icon: Target  },
                                ].map(({ label, value, icon: Icon }) => (
                                  <div key={label} className="flex items-center gap-2 text-xs">
                                    <Icon className="w-3 h-3 text-gray-400 dark:text-white/30 shrink-0" />
                                    <span className="text-gray-400 dark:text-white/30">{label}:</span>
                                    <span className="font-semibold text-gray-700 dark:text-white/70">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wide mb-2">Prediction Details</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Risk Score',  value: `${Math.round(p.delay_risk_score * 100)}%`  },
                                  { label: 'Confidence',  value: `${Math.round(p.confidence * 100)}%`         },
                                  { label: 'Predicted',   value: p.predicted_delayed ? 'Will be delayed' : 'On schedule' },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400 dark:text-white/30">{label}</span>
                                    <span className="font-semibold text-gray-700 dark:text-white/70">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Link to={`/shipments/${s.id}`}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/5 transition-colors">
                                View Shipment <ArrowUpRight className="w-3 h-3" />
                              </Link>
                              <button onClick={() => void refreshOne(s.id)} disabled={predicting === s.id}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                style={{ background: 'var(--ct-navy)' }}>
                                <Zap className="w-3 h-3" /> Refresh
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                )
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/6 text-xs text-gray-400 dark:text-white/30 flex justify-between bg-gray-50/30 dark:bg-white/1">
            <span>{filtered.length} of {rows.length} shipments</span>
            <span>Avg risk: <strong className="text-gray-600 dark:text-white/60">{Math.round(stats.avgScore * 100)}%</strong> · {stats.predictedDelayed} predicted late</span>
          </div>
        </div>
      )}

      {/* Quick ML Tools */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 shadow-card">
        <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" /> Quick ML Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MLToolCard
            title="Demand Forecast"
            desc="Corridor demand prediction"
            fields={[{ key: 'corridor', label: 'Corridor', type: 'select', options: ['Northern', 'Central', 'LAPSSET'] }]}
            runner={(vals) => predictionsApi.demand({ corridor: vals.corridor }).then(r => r.data)}
            resultFn={(d: Record<string, unknown>) => `${d.forecast_demand_teu} TEU (${d.trend})`}
          />
          <MLToolCard
            title="Theft Risk"
            desc="Route security assessment"
            fields={[
              { key: 'origin', label: 'Origin', type: 'text', placeholder: 'e.g. Nairobi' },
              { key: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g. Kigali' },
            ]}
            runner={(vals) => predictionsApi.theftRisk({ origin: vals.origin, destination: vals.destination }).then(r => r.data)}
            resultFn={(d: Record<string, unknown>) => `${d.risk_level} (${Math.round(Number(d.theft_risk_score) * 100)}%)`}
          />
          <MLToolCard
            title="Border Delay"
            desc="Crossing wait time"
            fields={[{ key: 'border_name', label: 'Border', type: 'text', placeholder: 'e.g. Namanga' }]}
            runner={(vals) => predictionsApi.borderDelay({ border_name: vals.border_name }).then(r => r.data)}
            resultFn={(d: Record<string, unknown>) => `${d.predicted_wait_hours} hrs · ${d.best_crossing_window}`}
          />
          <MLToolCard
            title="Fuel Optimize"
            desc="Route fuel savings"
            fields={[
              { key: 'origin', label: 'Origin', type: 'text', placeholder: 'e.g. Mombasa' },
              { key: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g. Kampala' },
            ]}
            runner={(vals) => predictionsApi.fuelOptimize({ origin: vals.origin, destination: vals.destination }).then(r => r.data)}
            resultFn={(d: Record<string, unknown>) => `${d.estimated_fuel_savings_pct}% savings · ${d.optimal_speed_kmh} km/h`}
          />
        </div>
      </div>
    </div>
  )
}
