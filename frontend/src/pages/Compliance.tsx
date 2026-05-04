import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, AlertCircle, CheckCircle, Clock, XCircle, FileText, X } from 'lucide-react'
import { complianceApi, type ComplianceDoc } from '@/api/compliance'
import { shipmentsApi } from '@/api/shipments'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import type { ShipmentListItem } from '@/types'

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  VALID:    { label: 'Valid',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  EXPIRED:  { label: 'Expired',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  EXPIRING: { label: 'Expiring', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  MISSING:  { label: 'Missing',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  PENDING:  { label: 'Pending',  color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
}

const DOC_TYPES = [
  'CERTIFICATE', 'PERMIT', 'DECLARATION', 'INVOICE', 'MANIFEST', 'PHYTOSANITARY', 'INSURANCE', 'OTHER',
]

export default function Compliance() {
  const [docs, setDocs] = useState<ComplianceDoc[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [form, setForm] = useState<Partial<ComplianceDoc>>({
    doc_type: 'CERTIFICATE', status: 'PENDING', is_required: true,
    issued_date: new Date().toISOString().slice(0, 10),
  })

  const load = useCallback(() => {
    setLoading(true)
    complianceApi.list({ status: statusFilter ?? undefined, page_size: 100 })
      .then(r => {
        const data = r.data
        setDocs(data.results ?? (data as unknown as ComplianceDoc[]))
        setTotal(data.count ?? 0)
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

  const counts = {
    valid: docs.filter(d => d.status === 'VALID').length,
    expiring: docs.filter(d => d.status === 'EXPIRING').length,
    expired: docs.filter(d => d.status === 'EXPIRED').length,
    missing: docs.filter(d => d.status === 'MISSING').length,
    pending: docs.filter(d => d.status === 'PENDING').length,
  }
  const compliance_pct = docs.length > 0
    ? Math.round(counts.valid / docs.length * 100) : 100

  const scoreColor = compliance_pct >= 90 ? 'from-green-500 to-emerald-500'
    : compliance_pct >= 70 ? 'from-amber-400 to-yellow-500'
    : 'from-red-500 to-rose-500'

  const filtered = statusFilter ? docs.filter(d => d.status === statusFilter) : docs

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Regulatory document tracking and compliance status</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Document
        </button>
      </div>

      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl bg-gradient-to-r ${scoreColor} p-6 text-white`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white/80">Compliance Score</div>
            <div className="text-5xl font-bold mt-1">{compliance_pct}%</div>
            <div className="text-white/80 text-sm mt-1">
              {counts.valid} valid of {docs.length} required documents
            </div>
          </div>
          <FileText className="w-16 h-16 text-white/30" />
        </div>
      </motion.div>

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
          <button
            key={s.key ?? 'ALL'}
            onClick={() => setStatusFilter(s.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
              statusFilter === s.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
            }`}
          >
            <span>{s.label}</span>
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
              statusFilter === s.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>{s.value}</span>
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Compliance Document</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shipment</label>
              <select
                value={form.shipment ?? ''}
                onChange={e => setForm(p => ({ ...p, shipment: Number(e.target.value) }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select shipment…</option>
                {shipments.map(s => <option key={s.id} value={s.id}>{s.tracking_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Document Type</label>
              <select
                value={form.doc_type ?? 'CERTIFICATE'}
                onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {([
              ['reference', 'Reference Number', 'text'],
              ['issued_by', 'Issued By', 'text'],
              ['issued_date', 'Issued Date', 'date'],
              ['expiry_date', 'Expiry Date', 'date'],
            ] as [keyof ComplianceDoc, string, string][]).map(([f, l, t]) => (
              <div key={f}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{l}</label>
                <input
                  type={t}
                  value={(form[f] as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select
                value={form.status ?? 'PENDING'}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as ComplianceDoc['status'] }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
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
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          </div>
        ) : (
          <DataTable<Record<string, unknown>>
            columns={[
              { key: 'tracking_number', header: 'Shipment', render: (row) => (
                <span className="font-mono text-xs text-gray-900 dark:text-white">{(row as unknown as ComplianceDoc).tracking_number}</span>
              )},
              { key: 'doc_type_display', header: 'Doc Type', render: (row) => (
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{(row as unknown as ComplianceDoc).doc_type_display}</span>
              )},
              { key: 'reference', header: 'Reference', render: (row) => (
                <span className="text-xs text-gray-600 dark:text-gray-400">{(row as unknown as ComplianceDoc).reference || '—'}</span>
              )},
              { key: 'issued_by', header: 'Issued By', render: (row) => (
                <span className="text-xs text-gray-600 dark:text-gray-400">{(row as unknown as ComplianceDoc).issued_by || '—'}</span>
              )},
              { key: 'expiry', header: 'Expiry', render: (row) => {
                const doc = row as unknown as ComplianceDoc
                return doc.expiry_date ? (
                  <div>
                    <div className="text-xs text-gray-700 dark:text-gray-300">{new Date(doc.expiry_date).toLocaleDateString()}</div>
                    {doc.days_until_expiry !== null && doc.days_until_expiry <= 60 && (
                      <div className={`text-xs ${doc.days_until_expiry < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                        {doc.days_until_expiry < 0 ? `Expired ${Math.abs(doc.days_until_expiry)}d ago` : `${doc.days_until_expiry}d left`}
                      </div>
                    )}
                  </div>
                ) : <span className="text-xs text-gray-400">—</span>
              }},
              { key: 'is_required', header: 'Required', render: (row) => {
                const doc = row as unknown as ComplianceDoc
                return doc.is_required
                  ? <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">Required</span>
                  : <span className="text-xs text-gray-400">Optional</span>
              }},
              { key: 'status', header: 'Status', render: (row) => {
                const doc = row as unknown as ComplianceDoc
                const cfg = STATUS_CFG[doc.status] ?? STATUS_CFG.PENDING
                const Icon = cfg.icon
                return (
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                )
              }},
              { key: 'actions', header: 'Actions', render: (row) => {
                const doc = row as unknown as ComplianceDoc
                return (
                  <div className="flex items-center gap-2">
                    <select value={doc.status} onChange={e => handleUpdateStatus(doc.id, e.target.value as ComplianceDoc['status'])}
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-500 hover:underline">Del</button>
                  </div>
                )
              }},
            ] as ColumnDef<Record<string, unknown>>[]}
            data={filtered as unknown as Record<string, unknown>[]}
            searchable
            searchPlaceholder="Search documents by tracking number, reference…"
            emptyTitle="No compliance documents found"
            emptyDescription="Add one to track regulatory requirements."
            pageSize={12}
          />
        )}
      </motion.div>
    </div>
  )
}
