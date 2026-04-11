/**
 * Documents.tsx — Browse and upload shipment documents.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, X, AlertTriangle, RefreshCw, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { documentsApi } from '@/api/payments'
import { shipmentsApi } from '@/api/shipments'
import type { Document as ShipDoc, DocType, ShipmentListItem } from '@/types'

const DOC_ICONS: Record<DocType, string> = {
  BOL:       '📋',
  CUSTOMS:   '🛃',
  PACKING:   '📦',
  INSURANCE: '🛡️',
  OTHER:     '📄',
}

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
      <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white font-heading">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Shipment *</label>
            <select value={shipId} onChange={(e) => setShipId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select shipment…</option>
              {shipments.map((s) => <option key={s.id} value={s.id}>{s.tracking_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="BOL">Bill of Lading</option>
              <option value="CUSTOMS">Customs Declaration</option>
              <option value="PACKING">Packing List</option>
              <option value="INSURANCE">Insurance Certificate</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                file ? 'border-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/30',
              )}>
              <Upload className="w-5 h-5 text-gray-400" />
              {file ? (
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">{file.name}</p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-white/40">Click to choose file</p>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'var(--ct-navy)' }}>
              {saving ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default function Documents() {
  const [docs,      setDocs]      = useState<ShipDoc[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [preview,   setPreview]   = useState<ShipDoc | null>(null)
  const [shipId,    setShipId]    = useState('')
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])

  async function loadShipments() {
    const res = await shipmentsApi.getShipments({ page_size: 200 })
    setShipments(res.data.results)
    if (!shipId && res.data.results.length > 0) setShipId(String(res.data.results[0].id))
  }

  async function loadDocs() {
    if (!shipId) return
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
  useEffect(() => { if (shipId) void loadDocs() }, [shipId])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Documents</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">Shipment documents &amp; attachments</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
          style={{ background: 'var(--ct-orange)' }}>
          <Upload className="w-4 h-4" /> Upload
        </button>
      </div>

      {/* Shipment selector */}
      <select value={shipId} onChange={(e) => setShipId(e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a2235] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-xs">
        {shipments.map((s) => <option key={s.id} value={s.id}>{s.tracking_number}</option>)}
      </select>

      {error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
          <button onClick={loadDocs} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-white/8 animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <FileText className="w-10 h-10 text-gray-200 dark:text-white/15" />
          <p className="text-sm text-gray-500 dark:text-white/40">No documents for this shipment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence initial={false}>
            {docs.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{DOC_ICONS[doc.doc_type]}</span>
                  <button onClick={() => setPreview(doc)} className="text-gray-400 hover:text-blue-600 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doc.filename || doc.doc_type_display}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{doc.doc_type_display}</p>
                </div>
                <p className="text-xs text-gray-400 dark:text-white/30">
                  {doc.uploaded_by_name ?? 'Unknown'} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* PDF preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-[#1a2235] rounded-2xl overflow-hidden shadow-elevated border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/8">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{preview.filename}</p>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              {preview.file_url ? (
                <iframe src={preview.file_url} className="w-full h-[60vh]" title={preview.filename} />
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-400 dark:text-white/40 text-sm">
                  Preview not available
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); void loadDocs() }} />}
      </AnimatePresence>
    </div>
  )
}
