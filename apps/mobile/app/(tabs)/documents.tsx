import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { WebView } from 'react-native-webview'
import { apiClient, shipmentsApi } from '@/lib/api'
import { EmptyState, Button, GlassCard } from '@/components/ui'
import type { Document as ShipDoc, DocType, ShipmentListItem } from '@shared/api/types'

const DOC_ICONS: Record<DocType, string> = { BOL: '📋', CUSTOMS: '🛃', PACKING: '📦', INSURANCE: '🛡️', OTHER: '📄' }
const DOC_TYPE_LABELS: Record<DocType, string> = {
  BOL: 'Bill of Lading', CUSTOMS: 'Customs Declaration', PACKING: 'Packing List', INSURANCE: 'Insurance Certificate', OTHER: 'Other Document',
}
const DOC_TYPES: DocType[] = ['BOL', 'CUSTOMS', 'PACKING', 'INSURANCE', 'OTHER']

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ shipments, selectedShipId, onClose, onUploaded }: {
  shipments: ShipmentListItem[]; selectedShipId: string; onClose: () => void; onUploaded: () => void
}) {
  const [shipId, setShipId] = useState(selectedShipId || (shipments[0] ? String(shipments[0].id) : ''))
  const [docType, setDocType] = useState<DocType>('OTHER')
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed.'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: false })
    if (!result.canceled && result.assets[0]) {
      setFile({ uri: result.assets[0].uri, name: `capture_${Date.now()}.jpg`, type: 'image/jpeg' })
    }
  }

  async function pickFromGallery() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
    if (!result.canceled && result.assets[0]) {
      setFile({ uri: result.assets[0].uri, name: result.assets[0].name, type: result.assets[0].mimeType ?? 'application/octet-stream' })
    }
  }

  async function upload() {
    if (!shipId || !file) { setErr('Please select a shipment and a file.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob)
      fd.append('doc_type', docType)
      await apiClient.post(`/api/v1/shipments/${shipId}/documents/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onUploaded()
    } catch { setErr('Upload failed. Please try again.') }
    finally { setSaving(false) }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-ct-dark-bg">
        <View className="flex-row items-center justify-between px-5 py-3.5 border-b border-ct-border-light dark:border-ct-dark-border">
          <Text className="text-ct-base font-extrabold text-ct-text-primary dark:text-ct-dark-text">Upload Document</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={26} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {err ? (
            <View className="flex-row items-center bg-red-50 dark:bg-red-900/20 rounded-ct-md p-2.5 mb-3">
              <Ionicons name="alert-circle" size={14} color="#dc2626" />
              <Text className="text-ct-xs text-ct-danger ml-1.5">{err}</Text>
            </View>
          ) : null}

          {/* Shipment selector */}
          <Text className="text-ct-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Shipment *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {shipments.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setShipId(String(s.id))}
                className={`mr-2 px-3.5 py-2 rounded-ct-md border-[1.5px] ${shipId === String(s.id) ? 'border-ct-navy dark:border-ct-orange bg-ct-navy dark:bg-ct-orange' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}
                activeOpacity={0.75}
              >
                <Text className={`text-ct-xs font-bold ${shipId === String(s.id) ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{s.tracking_number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Doc type */}
          <Text className="text-ct-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Document Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {DOC_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                onPress={() => setDocType(dt)}
                className={`mr-2 px-3.5 py-2 rounded-ct-md ${docType === dt ? 'bg-ct-orange' : 'bg-slate-100 dark:bg-slate-800'}`}
                activeOpacity={0.75}
              >
                <Text className={`text-ct-xs font-bold ${docType === dt ? 'text-white' : 'text-ct-text-muted dark:text-slate-300'}`}>{DOC_ICONS[dt]} {dt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* File picker */}
          <Text className="text-ct-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">File *</Text>
          {file ? (
            <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 rounded-ct-md p-3 mb-3">
              <Ionicons name="document" size={20} color="#3b82f6" />
              <Text className="flex-1 text-ct-sm text-blue-700 dark:text-blue-300 ml-2" numberOfLines={1}>{file.name}</Text>
              <TouchableOpacity onPress={() => setFile(null)}>
                <Ionicons name="close-circle" size={18} color="#93c5fd" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-2.5 mb-4">
              <TouchableOpacity onPress={() => void pickFromCamera()} className="flex-1 items-center py-4 rounded-ct-md border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800" activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={26} color="#9ca3af" />
                <Text className="text-ct-xs text-ct-text-muted mt-1.5 font-semibold">Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void pickFromGallery()} className="flex-1 items-center py-4 rounded-ct-md border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800" activeOpacity={0.8}>
                <Ionicons name="folder-open-outline" size={26} color="#9ca3af" />
                <Text className="text-ct-xs text-ct-text-muted mt-1.5 font-semibold">Browse</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => void upload()}
            disabled={saving || !file || !shipId}
            className={`rounded-ct-md py-3.5 items-center mt-2 ${saving || !file || !shipId ? 'bg-slate-400' : 'bg-ct-navy dark:bg-ct-orange'}`}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-ct-sm font-extrabold text-white">Upload Document</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── PDF Viewer ────────────────────────────────────────────────────────────────

function PdfViewer({ doc, onClose }: { doc: ShipDoc; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-2.5 bg-gray-900">
          <Text className="text-ct-sm font-bold text-white flex-1" numberOfLines={1}>{doc.filename}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        {doc.file_url ? (
          <WebView
            source={{ uri: doc.file_url }}
            className="flex-1 bg-[#1a1a2e]"
            startInLoadingState
            renderLoading={() => (
              <View className="flex-1 items-center justify-center bg-gray-900">
                <ActivityIndicator color="#f5801e" />
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="alert-circle-outline" size={48} color="#6b7280" />
            <Text className="text-ct-sm text-slate-400 mt-3">Preview not available</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ── Doc Card ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onPreview }: { doc: ShipDoc; onPreview: (d: ShipDoc) => void }) {
  return (
    <View className="bg-ct-surface-card dark:bg-ct-dark-card mx-4 mb-2.5 rounded-ct-md p-3.5 flex-row items-center shadow-sm">
      <Text className="text-[28px] mr-3">{DOC_ICONS[doc.doc_type]}</Text>
      <View className="flex-1 min-w-0">
        <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-ct-dark-text" numberOfLines={1}>{doc.filename || doc.doc_type_display}</Text>
        <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type_display}</Text>
        <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-px">
          {doc.uploaded_by_name ?? 'Unknown'} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onPreview(doc)} className="p-2">
        <Ionicons name="eye-outline" size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [shipId, setShipId] = useState('')
  const [docs, setDocs] = useState<ShipDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<ShipDoc | null>(null)

  const loadShipments = useCallback(async () => {
    try {
      const res = await shipmentsApi.list({ page_size: 200 })
      const results = (res.data as { results?: ShipmentListItem[] })?.results ?? (res.data as unknown as ShipmentListItem[]) ?? []
      setShipments(results)
      if (!shipId && results.length > 0) setShipId(String(results[0].id))
    } catch { /* silent */ }
  }, [shipId])

  const loadDocs = useCallback(async (isRefresh = false) => {
    if (!shipId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const res = await apiClient.get(`/api/v1/shipments/${shipId}/documents/`)
      const data = (res.data as { results?: ShipDoc[] })?.results ?? (res.data as ShipDoc[]) ?? []
      setDocs(data)
    } catch { Alert.alert('Error', 'Failed to load documents.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [shipId])

  useEffect(() => { void loadShipments() }, [])
  useEffect(() => { if (shipId) void loadDocs() }, [shipId])

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <View className="flex-1">
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#7c3aed" accentPosition="left" className="mx-4 mt-ct-lg mb-2">
          <View className="p-ct-lg">
            <View className="flex-row items-center mb-3">
              <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1" activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color="#e2e8f0" />
              </TouchableOpacity>
              <Text className="text-ct-xl font-extrabold text-ct-text-primary dark:text-white flex-1">Documents</Text>
              <TouchableOpacity
                onPress={() => setShowUpload(true)}
                className="flex-row items-center bg-ct-orange rounded-ct-md px-3 py-[7px]"
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                <Text className="text-ct-xs font-extrabold text-white ml-[5px]">Upload</Text>
              </TouchableOpacity>
            </View>

          {/* Shipment selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {shipments.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setShipId(String(s.id))}
                className={`mr-2 px-3 py-1.5 rounded-ct-sm ${shipId === String(s.id) ? 'bg-ct-orange' : 'bg-slate-200 dark:bg-white/10'}`}
                activeOpacity={0.75}
              >
                <Text className={`text-ct-xs font-bold ${shipId === String(s.id) ? 'text-white' : 'text-ct-text-primary dark:text-white'}`}>{s.tracking_number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>
        </GlassCard>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f5801e" />
          </View>
        ) : (
          <FlatList
            data={docs}
            keyExtractor={(d) => String(d.id)}
            renderItem={({ item }) => <DocCard doc={item} onPreview={setPreviewDoc} />}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDocs(true)} tintColor="#f5801e" />}
            ListEmptyComponent={
              <EmptyState icon="document-outline" title="No documents for this shipment" description="Upload a document or select a different shipment" size="lg" />
            }
          />
        )}

        {showUpload && (
          <UploadModal shipments={shipments} selectedShipId={shipId} onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); void loadDocs() }} />
        )}
        {previewDoc && <PdfViewer doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      </View>
    </SafeAreaView>
  )
}
