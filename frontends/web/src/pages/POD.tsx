/**
 * POD.tsx — Proof of Delivery management: capture, verify, dispute, resolve.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Plus,
  Camera, FileSearch, MessageSquare, Shield, Search, X,
  ChevronDown, ChevronUp, Truck, MapPin, Clock, User, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { podApi, type ProofOfDelivery, type PODDispute } from '@/api/pod'

const CONDITION_LABELS: Record<string, string> = {
  GOOD: 'Good — intact', DAMAGED: 'Damaged', SHORT: 'Short — mismatch', REFUSED: 'Refused',
}

const CONDITION_COLORS: Record<string, string> = {
  GOOD: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  DAMAGED: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  SHORT: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  REFUSED: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
}

const VERIFY_COLORS: Record<string, string> = {
  VERIFIED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  UNVERIFIED: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  DISPUTED: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
}

const DISPUTE_REASONS = ['DAMAGED', 'SHORTAGE', 'WRONG_GOODS', 'LATE', 'CONDITION', 'DOCUMENTATION', 'OTHER'] as const
const RESOLUTION_STATUSES = [
  'OPEN', 'UNDER_REVIEW', 'AWAITING_EVIDENCE',
  'RESOLVED_REFUND', 'RESOLVED_REDELIVERY', 'RESOLVED_ACCEPTED', 'CLOSED',
] as const

export default function PODPage() {
  const [pods, setPods] = useState<ProofOfDelivery[]>([])
  const [disputes, setDisputes] = useState<PODDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'pods' | 'disputes'>('pods')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [disputePod, setDisputePod] = useState<ProofOfDelivery | null>(null)
  const [resolvePod, setResolvePod] = useState<ProofOfDelivery | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionErr, setActionErr] = useState('')

  const canCapturePOD = usePermission(Permission.SHIPMENTS_UPDATE)
  const canManagePOD = usePermission(Permission.FINANCE_MANAGE)

  async function load() {
    setLoading(true); setError(null)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (statusFilter !== 'ALL') params.verification_status = statusFilter
      const [podRes, disputeRes] = await Promise.all([
        podApi.list(params),
        podApi.listDisputes(),
      ])
      setPods(podRes.data.results)
      setDisputes(disputeRes.data.results)
    } catch {
      setError('Failed to load POD data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(pod: ProofOfDelivery) {
    try {
      const { data } = await podApi.verify(pod.id)
      setPods((prev) => prev.map((p) => p.id === pod.id ? data : p))
    } catch { /* ignore */ }
  }

  async function handleRaiseDispute() {
    if (!disputePod) return
    setSaving(true); setActionErr('')
    try {
      const { data } = await podApi.raiseDispute(disputePod.id, {
        dispute_reason: 'DAMAGED',
        description: 'Dispute raised from POD management panel.',
      })
      setPods((prev) => prev.map((p) => p.id === disputePod.id ? { ...p, dispute: data, verification_status: 'DISPUTED' } : p))
      setDisputes((prev) => [data, ...prev])
      setDisputePod(null)
    } catch {
      setActionErr('Failed to raise dispute.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResolveDispute() {
    if (!resolvePod?.dispute) return
    setSaving(true); setActionErr('')
    try {
      const { data } = await podApi.resolveDispute(resolvePod.id, {
        resolution_status: 'CLOSED',
        resolution_notes: 'Resolved from admin panel.',
      })
      setPods((prev) => prev.map((p) => p.id === resolvePod.id ? { ...p, dispute: data } : p))
      setDisputes((prev) => prev.map((d) => d.id === data.id ? data : d))
      setResolvePod(null)
    } catch {
      setActionErr('Failed to resolve dispute.')
    } finally {
      setSaving(false)
    }
  }

  const filteredPods = pods.filter((p) => {
    if (search && !p.tracking_number?.toLowerCase().includes(search.toLowerCase()) &&
        !p.received_by_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: pods.length,
    verified: pods.filter((p) => p.verification_status === 'VERIFIED').length,
    disputed: pods.filter((p) => p.verification_status === 'DISPUTED').length,
    unverified: pods.filter((p) => p.verification_status === 'UNVERIFIED').length,
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-white/50">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header + Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Proof of Delivery</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            {stats.total} PODs · {stats.verified} verified · {stats.disputed} disputed · {stats.unverified} pending
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total PODs', value: stats.total, color: 'bg-blue-500' },
          { label: 'Verified', value: stats.verified, color: 'bg-emerald-500' },
          { label: 'Pending', value: stats.unverified, color: 'bg-amber-500' },
          { label: 'Disputed', value: stats.disputed, color: 'bg-red-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-4 flex items-center gap-3">
            <div className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-white/40">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center rounded-lg bg-gray-100 dark:bg-white/5 p-0.5">
          {(['pods', 'disputes'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                tab === t ? 'bg-white dark:bg-white/15 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/40')}>
              {t === 'pods' ? 'PODs' : 'Disputes'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking or receiver…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="ALL">All statuses</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Pending</option>
          <option value="DISPUTED">Disputed</option>
        </select>
      </div>

      {/* POD Table / Dispute list */}
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'pods' ? (
          filteredPods.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Truck className="w-10 h-10 text-gray-200 dark:text-white/15" />
              <p className="text-sm text-gray-500 dark:text-white/40">No PODs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/8">
                    <th className="px-5 py-3 text-left font-medium">Tracking</th>
                    <th className="px-5 py-3 text-left font-medium">Receiver</th>
                    <th className="px-5 py-3 text-left font-medium">Condition</th>
                    <th className="px-5 py-3 text-left font-medium">Verification</th>
                    <th className="px-5 py-3 text-left font-medium">Delivered</th>
                    <th className="px-5 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {filteredPods.map((pod) => (
                    <tr key={pod.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                          {pod.tracking_number || `POD #${pod.id}`}
                        </span>
                        <p className="text-xs text-gray-400 dark:text-white/30 font-mono">{pod.verification_code}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{pod.received_by_name}</p>
                        {pod.received_by_phone && <p className="text-xs text-gray-400">{pod.received_by_phone}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', CONDITION_COLORS[pod.condition])}>
                          {CONDITION_LABELS[pod.condition] || pod.condition}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', VERIFY_COLORS[pod.verification_status])}>
                          <span className={cn('w-1.5 h-1.5 rounded-full',
                            pod.verification_status === 'VERIFIED' ? 'bg-emerald-500' :
                            pod.verification_status === 'DISPUTED' ? 'bg-red-500' : 'bg-amber-500')} />
                          {pod.verification_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                        {new Date(pod.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setExpandedId(expandedId === pod.id ? null : pod.id)}
                            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8">
                            {expandedId === pod.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {pod.verification_status === 'UNVERIFIED' && (
                            <button onClick={() => handleVerify(pod)}
                              className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {pod.verification_status !== 'DISPUTED' && (
                            <button onClick={() => setDisputePod(pod)}
                              className="p-1 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {pod.dispute && pod.dispute.resolution_status !== 'CLOSED' &&
                           pod.dispute.resolution_status !== 'RESOLVED_REFUND' &&
                           pod.dispute.resolution_status !== 'RESOLVED_REDELIVERY' &&
                           pod.dispute.resolution_status !== 'RESOLVED_ACCEPTED' && (
                            <button onClick={() => setResolvePod(pod)}
                              className="p-1 rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Disputes tab */
          disputes.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <MessageSquare className="w-10 h-10 text-gray-200 dark:text-white/15" />
              <p className="text-sm text-gray-500 dark:text-white/40">No disputes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide border-b border-gray-100 dark:border-white/8">
                    <th className="px-5 py-3 text-left font-medium">POD #</th>
                    <th className="px-5 py-3 text-left font-medium">Reason</th>
                    <th className="px-5 py-3 text-left font-medium">Raised by</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {disputes.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-900 dark:text-white">POD #{d.pod}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-700 dark:text-white/70">{d.dispute_reason}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{d.raised_by_name || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                          d.resolution_status.startsWith('RESOLVED') || d.resolution_status === 'CLOSED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300')}>
                          {d.resolution_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-white/40">
                        {new Date(d.raised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Dispute Modal */}
      <AnimatePresence>
        {disputePod && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
              className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Raise Dispute</h2>
                <button onClick={() => setDisputePod(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-6 py-4 space-y-3">
                {actionErr && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{actionErr}</p>}
                <p className="text-sm text-gray-600 dark:text-white/60">
                  Dispute POD for tracking <span className="font-mono font-semibold">{disputePod.tracking_number || `#${disputePod.id}`}</span>?
                </p>
                <p className="text-xs text-gray-400">Receiver: {disputePod.received_by_name} · Condition: {CONDITION_LABELS[disputePod.condition]}</p>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
                <button onClick={() => setDisputePod(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
                <button onClick={handleRaiseDispute} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                  {saving ? 'Raising…' : 'Raise Dispute'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resolve Modal */}
      <AnimatePresence>
        {resolvePod?.dispute && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
              className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Resolve Dispute</h2>
                <button onClick={() => setResolvePod(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-6 py-4 space-y-3">
                {actionErr && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{actionErr}</p>}
                <p className="text-sm text-gray-600 dark:text-white/60">
                  Resolve dispute for POD #{resolvePod.dispute.pod} — {resolvePod.dispute.dispute_reason}
                </p>
                <p className="text-xs text-gray-400">Current status: {resolvePod.dispute.resolution_status.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
                <button onClick={() => setResolvePod(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
                <button onClick={handleResolveDispute} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Resolving…' : 'Close Dispute'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
