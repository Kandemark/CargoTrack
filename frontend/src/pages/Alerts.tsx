/**
 * @route /alerts  @auth IsAuthenticated
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, CheckCheck, AlertTriangle, RefreshCw, Search,
  Filter, X, ChevronDown, ChevronUp, ArrowUpRight,
  Clock, CheckCircle, AlertCircle, Info, Shield,
  SlidersHorizontal, Package, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAlertStore } from '@/store/alertStore'
import type { Alert, AlertSeverity } from '@/types'

// ── Config ────────────────────────────────────────────────────────────────────

const SEV_CFG: Record<AlertSeverity, {
  label: string; card: string; dot: string; badge: string; icon: React.ElementType; pill: string
}> = {
  CRITICAL: { label: 'Critical', card: 'border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-900/10',     dot: 'bg-red-500',    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',     icon: AlertCircle, pill: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'     },
  HIGH:     { label: 'High',     card: 'border-orange-200 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-900/10', dot: 'bg-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', icon: AlertTriangle, pill: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30' },
  MEDIUM:   { label: 'Medium',   card: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10',    dot: 'bg-amber-400',  badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',   icon: AlertTriangle, pill: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'   },
  LOW:      { label: 'Low',      card: 'border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-900/10',         dot: 'bg-blue-400',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',      icon: Info,          pill: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'          },
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const PAGE_SIZE = 20

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({
  alert, selected, onSelect, onAcknowledge,
}: {
  alert: Alert; selected: boolean; onSelect: (id: number) => void; onAcknowledge: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEV_CFG[alert.severity] ?? SEV_CFG.LOW
  const Icon = cfg.icon

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 rounded-2xl border p-4 transition-all', cfg.card, alert.acknowledged && 'opacity-50')}>

      {/* Checkbox */}
      <div className="pt-0.5 shrink-0">
        <input type="checkbox" checked={selected} onChange={() => onSelect(alert.id)}
          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer" />
      </div>

      {/* Dot */}
      <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.dot)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide', cfg.badge)}>
                <Icon className="w-2.5 h-2.5" />{cfg.label}
              </span>
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90 leading-snug">{alert.title}</p>
            </div>
            <p className={cn('text-xs text-gray-600 dark:text-white/50 mt-0.5', expanded ? '' : 'line-clamp-2')}>{alert.message}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {alert.acknowledged ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-white/30">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Acked
              </span>
            ) : (
              <button onClick={() => onAcknowledge(alert.id)}
                className="text-xs font-semibold text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white underline underline-offset-2 transition-colors">
                Acknowledge
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {alert.shipment_tracking && (
            <Link to={`/shipments/${alert.id}`}
              className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <Package className="w-3 h-3" />{alert.shipment_tracking}
            </Link>
          )}
          <span className="text-gray-300 dark:text-white/15">·</span>
          <span className="text-xs text-gray-400 dark:text-white/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeAgo(alert.sent_at)}
          </span>
          <span className="text-gray-300 dark:text-white/15">·</span>
          <span className="text-xs text-gray-400 dark:text-white/30">
            {new Date(alert.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={() => setExpanded(!expanded)}
            className="ml-auto text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 flex items-center gap-0.5 transition-colors">
            {expanded ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> More</>}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { alerts, unreadCount, isLoading, error, fetchAlerts, acknowledgeAlert } = useAlertStore()

  const [search,   setSearch]   = useState('')
  const [sevFilter, setSevFilter] = useState<AlertSeverity | 'ALL'>('ALL')
  const [showAcked, setShowAcked] = useState(false)
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [page,      setPage]      = useState(1)
  const [acking,    setAcking]    = useState(false)

  useEffect(() => { void fetchAlerts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sevCounts = useMemo(() => {
    const counts = { ALL: alerts.length, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>
    for (const a of alerts) counts[a.severity] = (counts[a.severity] ?? 0) + 1
    return counts
  }, [alerts])

  const filtered = useMemo(() => {
    let list = alerts
    if (!showAcked)      list = list.filter(a => !a.acknowledged)
    if (sevFilter !== 'ALL') list = list.filter(a => a.severity === sevFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.shipment_tracking ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [alerts, showAcked, sevFilter, search])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSelect(id: number) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selected.size === paginated.filter(a => !a.acknowledged).length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paginated.filter(a => !a.acknowledged).map(a => a.id)))
    }
  }

  async function acknowledgeSelected() {
    if (selected.size === 0) return
    setAcking(true)
    await Promise.all([...selected].map(id => acknowledgeAlert(id)))
    setSelected(new Set())
    setAcking(false)
  }

  async function acknowledgeAll() {
    setAcking(true)
    const unread = alerts.filter(a => !a.acknowledged)
    await Promise.all(unread.map(a => acknowledgeAlert(a.id)))
    setAcking(false)
  }

  const unreadOnPage = paginated.filter(a => !a.acknowledged)
  const allPageSelected = unreadOnPage.length > 0 && unreadOnPage.every(a => selected.has(a.id))

  return (
    <div className="space-y-5 pb-4">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading flex items-center gap-2">
            <Bell className="w-6 h-6 text-gray-400" /> Alerts
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
              {unreadCount > 0
                ? <span className="text-orange-600 dark:text-orange-400 font-semibold">{unreadCount} unacknowledged</span>
                : <span className="text-emerald-600 dark:text-emerald-400">All caught up!</span>}
              {' · '}{alerts.length} total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => void fetchAlerts()} disabled={isLoading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          {unreadCount > 0 && (
            <button onClick={acknowledgeAll} disabled={acking}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
              <CheckCheck className="w-3.5 h-3.5" /> Ack All
            </button>
          )}
        </div>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { sev: 'ALL',      label: 'Total',    bg: 'bg-gray-50 dark:bg-white/4',             text: 'text-gray-700 dark:text-white/70',       icon: Bell        },
          { sev: 'CRITICAL', label: 'Critical', bg: 'bg-red-50 dark:bg-red-900/15',            text: 'text-red-700 dark:text-red-400',         icon: AlertCircle },
          { sev: 'HIGH',     label: 'High',     bg: 'bg-orange-50 dark:bg-orange-900/15',      text: 'text-orange-700 dark:text-orange-400',   icon: AlertTriangle },
          { sev: 'MEDIUM',   label: 'Medium',   bg: 'bg-amber-50 dark:bg-amber-900/15',        text: 'text-amber-700 dark:text-amber-400',     icon: AlertTriangle },
          { sev: 'LOW',      label: 'Low',      bg: 'bg-blue-50 dark:bg-blue-900/15',          text: 'text-blue-700 dark:text-blue-400',       icon: Info        },
        ] as const).map(({ sev, label, bg, text, icon: Icon }, i) => (
          <motion.button key={sev} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => { setSevFilter(sev); setPage(1) }}
            className={cn('bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-4 shadow-card text-left hover:shadow-elevated hover:-translate-y-0.5 transition-all',
              sevFilter === sev && 'ring-2 ring-blue-400')}>
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', bg)}>
              <Icon className={cn('w-4 h-4', text)} />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{sevCounts[sev] ?? 0}</p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.button>
        ))}
      </div>

      {/* Filter bar */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search alerts, tracking numbers…"
            className="w-full pl-9 pr-9 py-2 rounded-xl text-sm bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-card" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-1 shadow-card">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
            <button key={s} onClick={() => { setSevFilter(s); setPage(1) }}
              className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                sevFilter === s ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
              style={sevFilter === s ? { background: s === 'CRITICAL' ? '#ef4444' : s === 'HIGH' ? '#f97316' : s === 'MEDIUM' ? '#f59e0b' : s === 'LOW' ? '#3b82f6' : 'var(--ct-navy)' } : {}}>
              {s === 'ALL' ? 'All' : SEV_CFG[s].label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowAcked(!showAcked)}
          className={cn('inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
            showAcked ? 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-[#1a2235] border-gray-200 dark:border-white/8 text-gray-500 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5'
          )}>
          <Filter className="w-3.5 h-3.5" />
          {showAcked ? 'Hide Acknowledged' : 'Show Acknowledged'}
        </button>

        {filtered.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-white/30 ml-auto">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </motion.div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-900/30">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{selected.size} selected</span>
            <button onClick={acknowledgeSelected} disabled={acking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              <CheckCheck className="w-3.5 h-3.5" />
              {acking ? 'Acknowledging…' : 'Acknowledge Selected'}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700 ml-auto">
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert list */}
      {error ? (
        <div className="flex flex-col items-center py-16 gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500 dark:text-white/50">{error}</p>
          <button onClick={() => void fetchAlerts()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--ct-navy)' }}>
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-2xl border border-gray-100 dark:border-white/6 bg-white dark:bg-[#1a2235]">
              <Sk className="w-3.5 h-3.5 rounded mt-0.5" /><Sk className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-3.5 w-3/4 rounded" /><Sk className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8">
          <Bell className="w-10 h-10 text-gray-200 dark:text-white/15" />
          <p className="text-sm font-medium text-gray-500 dark:text-white/50">
            {search || sevFilter !== 'ALL' ? 'No alerts match your filters.' : 'No alerts. All clear!'}
          </p>
          {(search || sevFilter !== 'ALL') && (
            <button onClick={() => { setSearch(''); setSevFilter('ALL') }}
              className="text-xs text-blue-600 hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-4 py-2">
            <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer" />
            <span className="text-xs text-gray-400 dark:text-white/30">Select page</span>
          </div>
          {paginated.map((alert) => (
            <AlertCard key={alert.id} alert={alert}
              selected={selected.has(alert.id)}
              onSelect={toggleSelect}
              onAcknowledge={(id) => void acknowledgeAlert(id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400 dark:text-white/30">
            Page {page} of {pageCount} · {filtered.length} alerts
          </p>
          <div className="flex items-center gap-1">
            {[...Array(Math.min(pageCount, 7))].map((_, i) => {
              const p = i + 1
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn('w-7 h-7 rounded-lg text-xs font-semibold transition-colors',
                    page === p ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
                  style={page === p ? { background: 'var(--ct-navy)' } : {}}>
                  {p}
                </button>
              )
            })}
            {pageCount > 7 && <span className="text-gray-400 px-1">…</span>}
          </div>
        </motion.div>
      )}
    </div>
  )
}
