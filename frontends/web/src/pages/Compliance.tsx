/**
 * Compliance.tsx — Cross-border regulatory compliance center.
 *
 * Tracks required trade documents per border corridor, monitors expiration,
 * scores shipment readiness, and surfaces regulatory alerts.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Loader2, AlertCircle, CheckCircle, Clock, XCircle, FileText,
  Shield, CalendarClock, Globe, ChevronDown, ChevronUp, Flag,
} from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { complianceApi, type ComplianceDoc } from '@/api/compliance'
import { shipmentsApi } from '@/api/shipments'
import type { ShipmentListItem } from '@/types'

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  VALID:    { label: 'Valid',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  EXPIRED:  { label: 'Expired',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  EXPIRING: { label: 'Expiring', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  MISSING:  { label: 'Missing',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  PENDING:  { label: 'Pending',  color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
}

const DOC_TYPES = [
  'CERTIFICATE', 'PERMIT', 'DECLARATION', 'INVOICE', 'MANIFEST',
  'PHYTOSANITARY', 'INSURANCE', 'OTHER',
]

// Corridor-specific required document sets
const CORRIDOR_REQUIREMENTS: Record<string, { name: string; docs: string[] }> = {
  'KE-TZ':  { name: 'Kenya → Tanzania',  docs: ['CERTIFICATE', 'DECLARATION', 'PERMIT'] },
  'KE-UG':  { name: 'Kenya → Uganda',    docs: ['CERTIFICATE', 'DECLARATION', 'PHYTOSANITARY'] },
  'KE-RW':  { name: 'Kenya → Rwanda',    docs: ['CERTIFICATE', 'DECLARATION'] },
  'TZ-KE':  { name: 'Tanzania → Kenya',  docs: ['CERTIFICATE', 'DECLARATION', 'PERMIT', 'PHYTOSANITARY'] },
  'UG-KE':  { name: 'Uganda → Kenya',    docs: ['CERTIFICATE', 'DECLARATION'] },
}

// Simulated regulatory updates
const REGULATORY_UPDATES = [
  { date: '2026-05-01', title: 'EAC Single Customs Territory — Phase 5', summary: 'Electronic certificate of origin now mandatory for all intra-EAC shipments.', severity: 'HIGH' },
  { date: '2026-04-18', title: 'Kenya Revenue Authority — New HS Codes', summary: 'Updated harmonized system codes for agricultural goods effective June 2026.', severity: 'MEDIUM' },
  { date: '2026-04-02', title: 'Tanzania Ports Authority — Demurrage Update', summary: 'Free storage period reduced from 7 to 5 days at Dar es Salaam port.', severity: 'MEDIUM' },
]

export default function Compliance() {
  const [docs, setDocs] = useState<ComplianceDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const canUpload = usePermission(Permission.DOCUMENTS_UPLOAD)
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [form, setForm] = useState<Partial<ComplianceDoc>>({
    doc_type: 'CERTIFICATE', status: 'PENDING', is_required: true,
    issued_date: new Date().toISOString().slice(0, 10),
  })
  const [showRegulatory, setShowRegulatory] = useState(false)
  const [showCorridors, setShowCorridors] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    complianceApi.list({ status: statusFilter ?? undefined, page_size: 100 })
      .then(r => {
        const data = r.data
        setDocs(data.results ?? (data as unknown as ComplianceDoc[]))
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    shipmentsApi.getShipments({ page_size: 100 })
      .then(r => setShipments(r.data.results ?? []))
      .catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!form.shipment || !form.doc_type) return
    setSaving(true)
    try {
      const res = await complianceApi.create(form)
      setDocs(prev => [res.data, ...prev])
      setShowForm(false)
      setForm({ doc_type: 'CERTIFICATE', status: 'PENDING', is_required: true,
        issued_date: new Date().toISOString().slice(0, 10) })
    } catch { alert('Failed to create compliance document') }
    finally { setSaving(false) }
  }

  const handleUpdateStatus = async (id: number, status: ComplianceDoc['status']) => {
    const res = await complianceApi.update(id, { status })
    setDocs(prev => prev.map(d => d.id === id ? res.data : d))
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this compliance document?')) return
    await complianceApi.delete(id)
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  // ── Computed metrics ────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    valid: docs.filter(d => d.status === 'VALID').length,
    expiring: docs.filter(d => d.status === 'EXPIRING').length,
    expired: docs.filter(d => d.status === 'EXPIRED').length,
    missing: docs.filter(d => d.status === 'MISSING').length,
    pending: docs.filter(d => d.status === 'PENDING').length,
    expiresIn7d: docs.filter(d => d.days_until_expiry !== null && d.days_until_expiry >= 0 && d.days_until_expiry <= 7).length,
    expiresIn30d: docs.filter(d => d.days_until_expiry !== null && d.days_until_expiry > 7 && d.days_until_expiry <= 30).length,
    expiresIn90d: docs.filter(d => d.days_until_expiry !== null && d.days_until_expiry > 30 && d.days_until_expiry <= 90).length,
  }), [docs])

  const compliancePct = docs.length > 0 ? Math.round(counts.valid / docs.length * 100) : 100

  const scoreColor = compliancePct >= 90 ? 'from-green-500 to-emerald-500'
    : compliancePct >= 70 ? 'from-amber-400 to-yellow-500'
    : 'from-red-500 to-rose-500'

  const filtered = statusFilter ? docs.filter(d => d.status === statusFilter) : docs

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Center</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Cross-border regulatory documents & trade compliance
          </p>
        </div>
        {canUpload && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Document
          </button>
        )}
      </div>

      {/* Score hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl bg-gradient-to-r ${scoreColor} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white/80">Overall Compliance Score</div>
            <div className="text-5xl font-bold mt-1">{compliancePct}%</div>
            <div className="text-white/80 text-sm mt-1">
              {counts.valid} valid of {docs.length} documents
            </div>
          </div>
          <FileText className="w-16 h-16 text-white/30" />
        </div>
      </motion.div>

      {/* Expiry alert KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Expiring ≤ 7 days', count: counts.expiresIn7d, icon: AlertCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
          { label: 'Expiring ≤ 30 days', count: counts.expiresIn30d, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
          { label: 'Expiring ≤ 90 days', count: counts.expiresIn90d, icon: CalendarClock, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
        ].map(k => (
          <div key={k.label} className={`flex items-center gap-4 p-4 rounded-xl border ${k.color}`}>
            <k.icon className="w-8 h-8" />
            <div>
              <p className="text-2xl font-bold">{k.count}</p>
              <p className="text-xs font-medium opacity-70">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Corridor Requirements + Regulatory Updates (collapsible) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Corridor requirements */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button onClick={() => setShowCorridors(!showCorridors)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Border Corridor Requirements</h3>
            </div>
            {showCorridors ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showCorridors && (
            <div className="px-4 pb-4 space-y-2">
              {Object.entries(CORRIDOR_REQUIREMENTS).map(([key, corr]) => (
                <div key={key} className="p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">{corr.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {corr.docs.map(doc => {
                      const hasDoc = docs.some(d => d.doc_type === doc && d.status === 'VALID')
                      return (
                        <span key={doc} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          hasDoc ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {hasDoc ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                          {doc}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 dark:text-white/30 mt-2">
                Based on EAC Common Market Protocol and national customs requirements.
              </p>
            </div>
          )}
        </div>

        {/* Regulatory updates */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button onClick={() => setShowRegulatory(!showRegulatory)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Regulatory Updates</h3>
            </div>
            {showRegulatory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showRegulatory && (
            <div className="px-4 pb-4 space-y-2">
              {REGULATORY_UPDATES.map(update => (
                <div key={update.title} className="p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      update.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{update.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{update.summary}</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1">
                        {new Date(update.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat filter chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { key: null,       label: 'All',      value: docs.length },
          { key: 'VALID',    label: 'Valid',    value: counts.valid },
          { key: 'EXPIRING', label: 'Expiring', value: counts.expiring },
          { key: 'EXPIRED',  label: 'Expired',  value: counts.expired },
          { key: 'MISSING',  label: 'Missing',  value: counts.missing },
          { key: 'PENDING',  label: 'Pending',  value: counts.pending },
        ].map(s => (
          <button key={s.key ?? 'ALL'} onClick={() => setStatusFilter(s.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
              statusFilter === s.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
            }`}>
            <span>{s.label}</span>
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
              statusFilter === s.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>{s.value}</span>
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Compliance Document</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shipment</label>
              <select value={form.shipment ?? ''} onChange={e => setForm(p => ({ ...p, shipment: Number(e.target.value) }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Select shipment…</option>
                {shipments.map(s => <option key={s.id} value={s.id}>{s.tracking_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Document Type</label>
              <select value={form.doc_type ?? 'CERTIFICATE'} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(['reference', 'issued_by', 'issued_date', 'expiry_date'] as (keyof ComplianceDoc)[]).map(f => (
              <div key={f}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">{f.replace('_', ' ')}</label>
                <input type={f.includes('date') ? 'date' : 'text'}
                  value={(form[f] as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status ?? 'PENDING'} onChange={e => setForm(p => ({ ...p, status: e.target.value as ComplianceDoc['status'] }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Document'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Documents table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield className="w-12 h-12 text-gray-200 dark:text-white/10" />
            <p className="text-sm text-gray-500 dark:text-white/30">No compliance documents found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-white/5">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Shipment</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Doc Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Reference</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Issued By</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Expiry</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Required</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map(doc => {
                  const cfg = STATUS_CFG[doc.status] ?? STATUS_CFG.PENDING
                  const Icon = cfg.icon
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-900 dark:text-white">{doc.tracking_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{doc.doc_type_display}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{doc.reference || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{doc.issued_by || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.expiry_date ? (
                          <div>
                            <div className="text-xs text-gray-700 dark:text-gray-300">{new Date(doc.expiry_date).toLocaleDateString()}</div>
                            {doc.days_until_expiry !== null && doc.days_until_expiry <= 60 && (
                              <div className={`text-[10px] font-semibold ${doc.days_until_expiry < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                {doc.days_until_expiry < 0 ? `Expired ${Math.abs(doc.days_until_expiry)}d ago` : `${doc.days_until_expiry}d left`}
                              </div>
                            )}
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {doc.is_required
                          ? <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Required</span>
                          : <span className="text-xs text-gray-400">Optional</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select value={doc.status} onChange={e => handleUpdateStatus(doc.id, e.target.value as ComplianceDoc['status'])}
                            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-500 hover:underline">Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
