/**
 * mobile/app/(tabs)/documents.tsx
 * Shipment document browser with camera capture and PDF viewer.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { WebView } from 'react-native-webview'
import { apiClient } from '@/lib/api'
import { shipmentsApi } from '@/lib/api'
import type { Document as ShipDoc, DocType, ShipmentListItem } from '@shared/api/types'

// ── Doc type display ──────────────────────────────────────────────────────────

const DOC_ICONS: Record<DocType, string> = {
  BOL:       '📋',
  CUSTOMS:   '🛃',
  PACKING:   '📦',
  INSURANCE: '🛡️',
  OTHER:     '📄',
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  BOL:       'Bill of Lading',
  CUSTOMS:   'Customs Declaration',
  PACKING:   'Packing List',
  INSURANCE: 'Insurance Certificate',
  OTHER:     'Other Document',
}

const DOC_TYPES: DocType[] = ['BOL', 'CUSTOMS', 'PACKING', 'INSURANCE', 'OTHER']

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  shipments,
  selectedShipId,
  onClose,
  onUploaded,
}: {
  shipments: ShipmentListItem[]
  selectedShipId: string
  onClose: () => void
  onUploaded: () => void
}) {
  const [shipId,  setShipId]  = useState(selectedShipId || (shipments[0] ? String(shipments[0].id) : ''))
  const [docType, setDocType] = useState<DocType>('OTHER')
  const [file,    setFile]    = useState<{ uri: string; name: string; type: string } | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed.'); return }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setFile({
        uri: asset.uri,
        name: `capture_${Date.now()}.jpg`,
        type: 'image/jpeg',
      })
    }
  }

  async function pickFromGallery() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setFile({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      })
    }
  }

  async function upload() {
    if (!shipId || !file) { setErr('Please select a shipment and a file.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob)
      fd.append('doc_type', docType)
      await apiClient.post(`/api/v1/shipments/${shipId}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUploaded()
    } catch {
      setErr('Upload failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Upload Document</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={26} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {err ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <Ionicons name="alert-circle" size={14} color="#dc2626" />
              <Text style={{ fontSize: 12, color: '#dc2626', marginLeft: 6 }}>{err}</Text>
            </View>
          ) : null}

          {/* Shipment selector */}
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Shipment *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {shipments.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setShipId(String(s.id))}
                style={{
                  marginRight: 8, paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: 10, borderWidth: 1.5,
                  borderColor: shipId === String(s.id) ? '#0f2d5e' : '#e5e7eb',
                  backgroundColor: shipId === String(s.id) ? '#0f2d5e' : '#f9fafb',
                }}
                activeOpacity={0.75}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: shipId === String(s.id) ? '#fff' : '#374151' }}>
                  {s.tracking_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Doc type */}
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Document Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {DOC_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                onPress={() => setDocType(dt)}
                style={{
                  marginRight: 8, paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: 10, backgroundColor: docType === dt ? '#f97316' : '#f1f5f9',
                }}
                activeOpacity={0.75}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: docType === dt ? '#fff' : '#6b7280' }}>
                  {DOC_ICONS[dt]} {dt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* File picker */}
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 }}>File *</Text>
          {file ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Ionicons name="document" size={20} color="#3b82f6" />
              <Text style={{ flex: 1, fontSize: 13, color: '#1d4ed8', marginLeft: 8 }} numberOfLines={1}>{file.name}</Text>
              <TouchableOpacity onPress={() => setFile(null)}>
                <Ionicons name="close-circle" size={18} color="#93c5fd" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => void pickFromCamera()}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', backgroundColor: '#fafafa' }}
                activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={26} color="#9ca3af" />
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: '600' }}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void pickFromGallery()}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', backgroundColor: '#fafafa' }}
                activeOpacity={0.8}>
                <Ionicons name="folder-open-outline" size={26} color="#9ca3af" />
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: '600' }}>Browse</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => void upload()}
            disabled={saving || !file || !shipId}
            style={{
              backgroundColor: saving || !file || !shipId ? '#9ca3af' : '#0f2d5e',
              borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8,
            }}
            activeOpacity={0.8}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Upload Document</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── PDF Viewer Modal ──────────────────────────────────────────────────────────

function PdfViewer({ doc, onClose }: { doc: ShipDoc; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#111827' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>{doc.filename}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        {doc.file_url ? (
          <WebView
            source={{ uri: doc.file_url }}
            style={{ flex: 1, backgroundColor: '#1a1a2e' }}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' }}>
                <ActivityIndicator color="#f5801e" />
              </View>
            )}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alert-circle-outline" size={48} color="#6b7280" />
            <Text style={{ color: '#9ca3af', marginTop: 12, fontSize: 14 }}>Preview not available</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ── Doc Card ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onPreview }: { doc: ShipDoc; onPreview: (d: ShipDoc) => void }) {
  return (
    <View style={{
      backgroundColor: '#fff',
      marginHorizontal: 16, marginBottom: 10,
      borderRadius: 14, padding: 14,
      shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
      flexDirection: 'row', alignItems: 'center',
    }}>
      <Text style={{ fontSize: 28, marginRight: 12 }}>{DOC_ICONS[doc.doc_type]}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
          {doc.filename || doc.doc_type_display}
        </Text>
        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type_display}
        </Text>
        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
          {doc.uploaded_by_name ?? 'Unknown'} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onPreview(doc)} style={{ padding: 8 }}>
        <Ionicons name="eye-outline" size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const [shipments,   setShipments]   = useState<ShipmentListItem[]>([])
  const [shipId,      setShipId]      = useState('')
  const [docs,        setDocs]        = useState<ShipDoc[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [showUpload,  setShowUpload]  = useState(false)
  const [previewDoc,  setPreviewDoc]  = useState<ShipDoc | null>(null)

  const loadShipments = useCallback(async () => {
    try {
      const res = await shipmentsApi.list({ page_size: 200 })
      const results = (res.data as { results?: ShipmentListItem[] })?.results ?? (res.data as ShipmentListItem[]) ?? []
      setShipments(results)
      if (!shipId && results.length > 0) setShipId(String(results[0].id))
    } catch { /* silent */ }
  }, [shipId])

  const loadDocs = useCallback(async (isRefresh = false) => {
    if (!shipId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiClient.get(`/api/v1/shipments/${shipId}/documents/`)
      const data = (res.data as { results?: ShipDoc[] })?.results ?? (res.data as ShipDoc[]) ?? []
      setDocs(data)
    } catch {
      Alert.alert('Error', 'Failed to load documents.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [shipId])

  useEffect(() => { void loadShipments() }, [])
  useEffect(() => { if (shipId) void loadDocs() }, [shipId])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

        {/* Header */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Documents</Text>
            <TouchableOpacity
              onPress={() => setShowUpload(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
              activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', marginLeft: 5 }}>Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Shipment selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {shipments.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setShipId(String(s.id))}
                style={{
                  marginRight: 8, paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: shipId === String(s.id) ? '#f97316' : 'rgba(255,255,255,0.12)',
                }}
                activeOpacity={0.75}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{s.tracking_number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="document-outline" size={40} color="#cbd5e1" />
                <Text style={{ color: '#9ca3af', marginTop: 10, fontSize: 14 }}>No documents for this shipment</Text>
              </View>
            }
          />
        )}

        {showUpload && (
          <UploadModal
            shipments={shipments}
            selectedShipId={shipId}
            onClose={() => setShowUpload(false)}
            onUploaded={() => { setShowUpload(false); void loadDocs() }}
          />
        )}

        {previewDoc && (
          <PdfViewer doc={previewDoc} onClose={() => setPreviewDoc(null)} />
        )}
      </View>
    </SafeAreaView>
  )
}
