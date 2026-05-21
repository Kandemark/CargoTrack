/**
 * CommandPalette.tsx — Global ⌘K search overlay.
 * Groups: Pages | Shipments | Alerts
 * Keyboard: arrows to navigate, Enter to go, Escape to close.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Package, Bell, LayoutDashboard, Map, CreditCard,
  FileText, Users, Settings, Brain, X, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import { alertsApi } from '@/api/alerts'
import type { ShipmentListItem, Alert } from '@/types'

// ── Static nav pages ──────────────────────────────────────────────────────────

interface NavPage { label: string; to: string; icon: React.ElementType; desc?: string }

const NAV_PAGES: NavPage[] = [
  { label: 'Dashboard',       to: '/ops/dashboard',   icon: LayoutDashboard, desc: 'Operations overview' },
  { label: 'Shipments',       to: '/ops/shipments',   icon: Package,         desc: 'All shipments'       },
  { label: 'Live Map',        to: '/live-map',         icon: Map,             desc: 'Real-time positions' },
  { label: 'AI Predictions',  to: '/ops/predictions', icon: Brain,           desc: 'Delay risk analysis' },
  { label: 'Alerts',          to: '/shared/alerts',   icon: Bell,            desc: 'Active notifications'},
  { label: 'Payments',        to: '/payments',         icon: CreditCard,      desc: 'Invoices & billing'  },
  { label: 'Documents',       to: '/documents',        icon: FileText,        desc: 'Shipment documents'  },
  { label: 'Team',            to: '/team',             icon: Users,           desc: 'User management'     },
  { label: 'Settings',        to: '/settings',         icon: Settings,        desc: 'Account settings'    },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultKind = 'page' | 'shipment' | 'alert'

interface Result {
  kind: ResultKind
  id: string
  label: string
  sub?: string
  to: string
  icon: React.ElementType
}

function buildShipmentResult(s: ShipmentListItem): Result {
  return {
    kind: 'shipment',
    id:    `s-${s.id}`,
    label: s.tracking_number,
    sub:   `${s.route.origin} → ${s.route.destination} · ${s.carrier_name}`,
    to:    `/ops/shipments/${s.id}`,
    icon:  Package,
  }
}

function buildAlertResult(a: Alert): Result {
  return {
    kind: 'alert',
    id:    `a-${a.id}`,
    label: a.message,
    sub:   `${a.shipment_tracking} · ${a.severity}`,
    to:    '/shared/alerts',
    icon:  Bell,
  }
}

// ── Fuzzy filter ──────────────────────────────────────────────────────────────

function fuzzy(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  return q === '' || t.includes(q)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Result[]>([])
  const [active,   setActive]   = useState(0)
  const [loading,  setLoading]  = useState(false)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    const pages = NAV_PAGES.filter((p) =>
      fuzzy(p.label, q) || fuzzy(p.desc ?? '', q),
    ).map<Result>((p) => ({
      kind: 'page', id: `p-${p.to}`, label: p.label, sub: p.desc, to: p.to, icon: p.icon,
    }))

    if (!q.trim()) {
      setResults(pages.slice(0, 5))
      return
    }

    setLoading(true)
    try {
      const [shipmentsRes, alertsRes] = await Promise.all([
        shipmentsApi.getShipments({ page_size: 50 }),
        alertsApi.getAlerts(),
      ])
      const shipResults = shipmentsRes.data.results
        .filter((s) => fuzzy(s.tracking_number, q) || fuzzy(s.carrier_name, q))
        .slice(0, 5)
        .map(buildShipmentResult)
      const alertResults = alertsRes.data.results
        .filter((a) => fuzzy(a.message, q) || fuzzy(a.shipment_tracking, q))
        .slice(0, 3)
        .map(buildAlertResult)
      setResults([...pages.slice(0, 3), ...shipResults, ...alertResults])
    } catch {
      setResults(pages)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce 200 ms
  useEffect(() => {
    const t = setTimeout(() => { void search(query) }, 200)
    return () => clearTimeout(t)
  }, [query, search])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      }
      if (e.key === 'Enter' && results[active]) {
        navigate(results[active].to)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, active, navigate, onClose])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const GROUP_LABELS: Record<ResultKind, string> = { page: 'Pages', shipment: 'Shipments', alert: 'Alerts' }

  function renderGroup(kind: ResultKind, items: Result[]) {
    if (!items.length) return null
    return (
      <div key={kind}>
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
          {GROUP_LABELS[kind]}
        </div>
        {items.map((r, idx) => {
          const globalIdx = results.indexOf(r)
          const Icon = r.icon
          return (
            <button
              key={r.id}
              data-idx={globalIdx}
              onClick={() => { navigate(r.to); onClose() }}
              onMouseEnter={() => setActive(globalIdx)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                globalIdx === active
                  ? 'bg-ct-navy text-white'
                  : 'text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5',
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', globalIdx === active ? 'text-ct-orange' : 'text-gray-400 dark:text-white/30')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.label}</p>
                {r.sub && <p className={cn('text-xs truncate', globalIdx === active ? 'text-white/70' : 'text-gray-400 dark:text-white/30')}>{r.sub}</p>}
              </div>
              {globalIdx === active && <ArrowRight className="w-3.5 h-3.5 text-white/60 shrink-0" />}
            </button>
          )
        })}
      </div>
    )
  }

  const groups = (['page', 'shipment', 'alert'] as ResultKind[]).map((kind) => ({
    kind,
    items: results.filter((r) => r.kind === kind),
  }))

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'fixed top-[20vh] left-1/2 -translate-x-1/2 z-50',
              'w-full max-w-xl rounded-2xl overflow-hidden',
              'bg-white dark:bg-[#1a2235] shadow-elevated',
              'border border-gray-200 dark:border-white/10',
            )}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/8">
              <Search className="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                placeholder="Search shipments, pages, alerts…"
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none"
              />
              {loading && (
                <div className="w-4 h-4 border-2 border-ct-navy border-t-transparent rounded-full animate-spin" />
              )}
              <button onClick={onClose} className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
              {results.length === 0 && !loading && (
                <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white/30">
                  {query ? `No results for "${query}"` : 'Type to search…'}
                </p>
              )}
              {groups.map(({ kind, items }) => renderGroup(kind, items))}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-gray-100 dark:border-white/8 flex items-center gap-3 text-[10px] text-gray-400 dark:text-white/25">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">Esc</kbd> close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
