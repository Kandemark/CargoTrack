/**
 * Documents.tsx — Enterprise document management with folder view, search, filter.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Upload, X, AlertTriangle, RefreshCw, Eye,
  Search, Download, Filter, FolderOpen, Folder,
  ChevronRight, Clock, User, Shield, Package,
  FileArchive, FileCog, Grid, List as ListIcon, ScanText,
} from 'lucide-react'
import { ocrApi, type DocumentExtraction } from '@/api/ocr'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { documentsApi } from '@/api/payments'
import { shipmentsApi } from '@/api/shipments'
import type { Document as ShipDoc, DocType, ShipmentListItem } from '@/types'

// ── Config ────────────────────────────────────────────────────────────────────

const DOC_CFG: Record<DocType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  BOL:       { icon: FileText,    label: 'Bill of Lading',      color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/20'    },
  CUSTOMS:   { icon: Shield,      label: 'Customs Declaration', color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  PACKING:   { icon: Package,     label: 'Packing List',        color: '#f5801e', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  INSURANCE: { icon: FileCog,     label: 'Insurance Cert.',     color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-900/20'},
  OTHER:     { icon: FileArchive, label: 'Other',               color: '#94a3b8', bg: 'bg-gray-100 dark:bg-white/8'        },
}

const DOC_TYPES: DocType[] = ['BOL', 'CUSTOMS', 'PACKING', 'INSURANCE', 'OTHER']

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-gray-100 dark:bg-white/8 animate-pulse', className)} />
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [shipId,    setShipId]    = useState('')
  const [docType,   setDocType]   = useState<DocType>('OTHER')
  const [file,      setFile]      = useState<File | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    shipmentsApi.getShipments({ page_size: 200 }).then((r) => setShipments(r.data.results))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!shipId || !file) { setErr('Shipment and file are required.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      await documentsApi.uploadDocument(Number(shipId), fd)
      onUploaded()
    } catch {
      setErr('Upload failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white font-heading">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Shipment *</label>
            <select value={shipId} onChange={(e) => setShipId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select shipment…</option>
              {shipments.map((s) => <option key={s.id} value={s.id}>{s.tracking_number} · {s.route.origin} → {s.route.destination}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Document Type</label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TYPES.map((type) => {
                const cfg = DOC_CFG[type]
                const Icon = cfg.icon
                return (
                  <button key={type} type="button" onClick={() => setDocType(type)}
                    className={cn('flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors',
                      docType === type ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 hover:bg-gray-50 dark:hover:bg-white/5')}>
                    <Icon className="w-4 h-4" style={{ color: docType === type ? cfg.color : undefined }} />
                    <span className="text-[10px] text-center leading-tight">{cfg.label.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">File *</label>
            <div onClick={() => fileRef.current?.click()}
              className={cn('flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                file ? 'border-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-white/15 hover:border-blue-300 dark:hover:border-white/30')}>
              <Upload className="w-5 h-5 text-gray-400" />
              {file ? (
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
              ) : (
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-600 dark:text-white/60">Click to choose file</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5">PDF, PNG, JPG, DOCX up to 20MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-navy)' }}>
              {saving ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Document card ─────────────────────────────────────────────────────────────

function DocCard({ doc, onPreview, gridView }: { doc: ShipDoc; onPreview: (d: ShipDoc) => void; gridView: boolean }) {
  const cfg = DOC_CFG[doc.doc_type] ?? DOC_CFG.OTHER
  const Icon = cfg.icon

  if (!gridView) {
    return (
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/4 transition-colors group">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doc.filename || cfg.label}</p>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{cfg.label}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-500 dark:text-white/40">{doc.uploaded_by_name ?? 'Unknown'}</p>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
            {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onPreview(doc)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
          {doc.file_url && (
            <a href={doc.file_url} download className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-5 flex flex-col gap-3 hover:shadow-elevated hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start justify-between">
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', cfg.bg)}>
          <Icon className="w-5 h-5" style={{ color: cfg.color }} />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onPreview(doc)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
          {doc.file_url && (
            <a href={doc.file_url} download className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{doc.filename || cfg.label}</p>
        <span className={cn('inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold', cfg.bg)} style={{ color: cfg.color }}>
          <Icon className="w-2.5 h-2.5" />{cfg.label}
        </span>
      </div>
      <div className="border-t border-gray-100 dark:border-white/6 pt-2.5 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{doc.uploaded_by_name ?? 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30">
          <Clock className="w-3 h-3 shrink-0" />
          {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Documents() {
  const [docs,       setDocs]       = useState<ShipDoc[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [preview,    setPreview]    = useState<ShipDoc | null>(null)
  const [shipId,     setShipId]     = useState('')
  const [shipments,  setShipments]  = useState<ShipmentListItem[]>([])
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<DocType | 'ALL'>('ALL')
  const [gridView,   setGridView]   = useState(true)
  const canUpload = usePermission(Permission.DOCUMENTS_UPLOAD)

  // OCR state
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrResult, setOcrResult] = useState<DocumentExtraction | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const ocrFileRef = useRef<HTMLInputElement>(null)

  async function runOCR() {
    if (!ocrFile) return
    setOcrLoading(true); setOcrError(null); setOcrResult(null)
    try {
      const { data } = await ocrApi.extract(ocrFile, shipId ? Number(shipId) : undefined)
      setOcrResult(data)
    } catch {
      setOcrError('OCR extraction failed.')
    } finally { setOcrLoading(false) }
  }

  async function loadShipments() {
    const res = await shipmentsApi.getShipments({ page_size: 200 })
    setShipments(res.data.results)
    if (!shipId && res.data.results.length > 0) setShipId(String(res.data.results[0].id))
  }

  async function loadDocs() {
    if (!shipId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await documentsApi.listDocuments(Number(shipId))
      setDocs((res.data as { results?: ShipDoc[] })?.results ?? (res.data as ShipDoc[]) ?? [])
    } catch {
      setError('Failed to load documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadShipments() }, [])
  useEffect(() => { if (shipId) void loadDocs() }, [shipId]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentShipment = useMemo(() => shipments.find(s => String(s.id) === shipId), [shipments, shipId])

  const filtered = useMemo(() => {
    let list = docs
    if (typeFilter !== 'ALL') list = list.filter(d => d.doc_type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => (d.filename ?? '').toLowerCase().includes(q) || d.doc_type_display.toLowerCase().includes(q))
    }
    return list
  }, [docs, typeFilter, search])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: docs.length }
    for (const d of docs) counts[d.doc_type] = (counts[d.doc_type] ?? 0) + 1
    return counts
  }, [docs])

  return (
    <div className="space-y-5 pb-4">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Documents</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            {docs.length > 0 ? `${docs.length} documents for ${currentShipment?.tracking_number ?? 'selected shipment'}` : 'Shipment documents & attachments'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setGridView(!gridView)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
            {gridView ? <ListIcon className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          {canUpload && (
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'var(--ct-orange)' }}>
              <Upload className="w-4 h-4" /> Upload
            </button>
          )}
        </div>
      </motion.div>

      {/* Doc type KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { type: 'ALL' as const, label: 'All', icon: FolderOpen, color: '#0f2d5e', bg: 'bg-blue-50 dark:bg-blue-900/15' },
          ...DOC_TYPES.map(t => ({ type: t, label: DOC_CFG[t].label.split(' ')[0], icon: DOC_CFG[t].icon, color: DOC_CFG[t].color, bg: DOC_CFG[t].bg })),
        ].map(({ type, label, icon: Icon, color, bg }, i) => (
          <motion.button key={type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setTypeFilter(type)}
            className={cn('bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-3 shadow-card text-left hover:shadow-elevated hover:-translate-y-0.5 transition-all',
              typeFilter === type && 'ring-2 ring-blue-400')}>
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', bg)}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white font-heading tabular-nums">{typeCounts[type] ?? 0}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-0.5">{label}</p>
          </motion.button>
        ))}
      </div>

      {/* Shipment selector + search + filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/8 rounded-xl px-3 py-2 shadow-card">
          <Folder className="w-4 h-4 text-orange-400 shrink-0" />
          <select value={shipId} onChange={(e) => setShipId(e.target.value)}
            className="text-sm bg-transparent text-gray-900 dark:text-white focus:outline-none min-w-0 max-w-xs">
            {shipments.length === 0 && <option value="">No shipments</option>}
            {shipments.map((s) => <option key={s.id} value={s.id}>{s.tracking_number} — {s.route.origin} → {s.route.destination}</option>)}
          </select>
        </div>

        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename or type…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-card" />
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-1 shadow-card">
          {(['ALL', ...DOC_TYPES] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-2 py-1 rounded-lg text-xs font-semibold transition-colors',
                typeFilter === t ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}
              style={typeFilter === t ? { background: t === 'ALL' ? 'var(--ct-navy)' : DOC_CFG[t].color } : {}}>
              {t === 'ALL' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500 dark:text-white/50">{error}</p>
          <button onClick={loadDocs} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : loading ? (
        gridView ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Sk key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-white/5">
                <Sk className="w-9 h-9 rounded-xl" /><Sk className="flex-1 h-3.5 rounded" />
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8">
          <FileText className="w-10 h-10 text-gray-200 dark:text-white/15" />
          <p className="text-sm text-gray-500 dark:text-white/40">
            {search || typeFilter !== 'ALL' ? 'No documents match your filter.' : 'No documents for this shipment'}
          </p>
          {!shipId && (
            <p className="text-xs text-gray-400 dark:text-white/25">Select a shipment above to view its documents</p>
          )}
          {canUpload && (
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white mt-2"
              style={{ background: 'var(--ct-orange)' }}>
              <Upload className="w-3.5 h-3.5" /> Upload First Document
            </button>
          )}
        </div>
      ) : gridView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence initial={false}>
            {filtered.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <DocCard doc={doc} onPreview={setPreview} gridView={gridView} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden shadow-card">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/6 grid grid-cols-12 text-xs text-gray-400 dark:text-white/30 uppercase tracking-wide font-medium bg-gray-50/50 dark:bg-white/2">
            <span className="col-span-5">Name</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-3">Uploaded By</span>
            <span className="col-span-2 text-right">Date</span>
          </div>
          <AnimatePresence initial={false}>
            {filtered.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}>
                <DocCard doc={doc} onPreview={setPreview} gridView={false} />
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/6 text-xs text-gray-400 dark:text-white/30 bg-gray-50/30 dark:bg-white/1">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''} · {currentShipment?.tracking_number ?? '—'}
          </div>
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-[#1a2235] rounded-2xl overflow-hidden shadow-elevated border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/8">
                <div className="flex items-center gap-2">
                  {(() => { const cfg = DOC_CFG[preview.doc_type]; const I = cfg.icon; return <I className="w-4 h-4" style={{ color: cfg.color }} /> })()}
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{preview.filename || preview.doc_type_display}</p>
                </div>
                <div className="flex items-center gap-2">
                  {preview.file_url && (
                    <a href={preview.file_url} download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  )}
                  <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {preview.file_url ? (
                <iframe src={preview.file_url} className="w-full h-[65vh]" title={preview.filename} />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 dark:text-white/40">
                  <FileText className="w-10 h-10" />
                  <p className="text-sm">Preview not available</p>
                  {preview.file_url && (
                    <a href={preview.file_url} download className="text-xs text-blue-600 hover:underline">Download to view</a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); void loadDocs() }} />}
      </AnimatePresence>

      {/* OCR Extraction Panel */}
      <div className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ScanText className="w-5 h-5 text-orange-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Document OCR</h2>
          <span className="text-[10px] text-gray-400 dark:text-white/30">Extract text from uploaded documents</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div onClick={() => ocrFileRef.current?.click()}
              className={cn('flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                ocrFile ? 'border-orange-300 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-white/15 hover:border-orange-300 dark:hover:border-orange-600')}>
              <Upload className="w-5 h-5 text-gray-400" />
              {ocrFile ? (
                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">{ocrFile.name} ({(ocrFile.size / 1024).toFixed(0)} KB)</p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-white/30">Drop a document for OCR text extraction</p>
              )}
            </div>
            <input ref={ocrFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={(e) => { setOcrFile(e.target.files?.[0] ?? null); setOcrResult(null); setOcrError(null) }} />
            <button onClick={runOCR} disabled={!ocrFile || ocrLoading}
              className="mt-3 w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5">
              <ScanText className="w-3.5 h-3.5" /> {ocrLoading ? 'Extracting…' : 'Extract Text'}
            </button>
            {ocrError && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mt-2">{ocrError}</p>}
          </div>
          <div>
            {ocrResult ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-400">Type</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-white">{ocrResult.document_type}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-400">Confidence</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-white">{(ocrResult.ocr_confidence * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-400">Pages</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-white">{ocrResult.page_count}</p>
                  </div>
                </div>
                {ocrResult.extracted_fields && Object.keys(ocrResult.extracted_fields).length > 0 && (
                  <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1.5">Extracted Fields</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(ocrResult.extracted_fields).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-gray-400">{k.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-gray-700 dark:text-white/70 truncate ml-2">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <details className="text-xs">
                  <summary className="text-gray-400 cursor-pointer">Raw Text ({ocrResult.word_count} words)</summary>
                  <pre className="mt-1 p-2 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-white/50 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px]">{ocrResult.raw_text}</pre>
                </details>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 gap-2 text-gray-300 dark:text-white/15">
                <ScanText className="w-10 h-10" />
                <p className="text-xs text-gray-400 dark:text-white/25">Extracted text will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
