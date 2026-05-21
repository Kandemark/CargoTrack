import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { WebView } from 'react-native-webview'
import { apiClient, shipmentsApi } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
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
  const { colors, font, radius, isDark } = useAppTheme()
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
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: isDark ? colors.background : '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: font.size.base, fontWeight: font.weight.extrabold, color: colors.text }}>Upload Document</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={26} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {err ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(127,29,29,0.2)' : '#fef2f2', borderRadius: radius.md, padding: 10, marginBottom: 12 }}>
              <Ionicons name="alert-circle" size={14} color="#dc2626" />
              <Text style={{ fontSize: font.size.xs, color: '#EF4444', marginLeft: 6 }}>{err}</Text>
            </View>
          ) : null}

          {/* Shipment selector */}
          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#cbd5e1' : '#334155', marginBottom: 6 }}>Shipment *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {shipments.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setShipId(String(s.id))}
                style={[{
                  marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1.5,
                }, shipId === String(s.id) ? {
                  borderColor: isDark ? '#f5801e' : '#0f2d5e', backgroundColor: isDark ? '#f5801e' : '#0f2d5e',
                } : {
                  borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                }]}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: shipId === String(s.id) ? '#fff' : (isDark ? '#cbd5e1' : '#334155') }}>{s.tracking_number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Doc type */}
          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#cbd5e1' : '#334155', marginBottom: 6 }}>Document Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {DOC_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                onPress={() => setDocType(dt)}
                style={{
                  marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md,
                  backgroundColor: docType === dt ? '#f5801e' : (isDark ? '#1e293b' : '#f1f5f9'),
                }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: docType === dt ? '#fff' : colors.textMuted }}>{DOC_ICONS[dt]} {dt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* File picker */}
          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#cbd5e1' : '#334155', marginBottom: 8 }}>File *</Text>
          {file ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(30,58,138,0.2)' : '#eff6ff', borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
              <Ionicons name="document" size={20} color="#3b82f6" />
              <Text style={{ flex: 1, fontSize: font.size.sm, color: isDark ? '#93c5fd' : '#1d4ed8', marginLeft: 8 }} numberOfLines={1}>{file.name}</Text>
              <TouchableOpacity onPress={() => setFile(null)}>
                <Ionicons name="close-circle" size={18} color="#93c5fd" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity onPress={() => void pickFromCamera()} style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? '#475569' : '#cbd5e1', backgroundColor: isDark ? '#1e293b' : '#f8fafc' }} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={26} color="#9ca3af" />
                <Text style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 6, fontWeight: font.weight.semibold }}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void pickFromGallery()} style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? '#475569' : '#cbd5e1', backgroundColor: isDark ? '#1e293b' : '#f8fafc' }} activeOpacity={0.8}>
                <Ionicons name="folder-open-outline" size={26} color="#9ca3af" />
                <Text style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 6, fontWeight: font.weight.semibold }}>Browse</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => void upload()}
            disabled={saving || !file || !shipId}
            style={{
              borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 8,
              backgroundColor: saving || !file || !shipId ? '#94a3b8' : (isDark ? '#f5801e' : '#0f2d5e'),
            }}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: '#fff' }}>Upload Document</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── PDF Viewer ────────────────────────────────────────────────────────────────

function PdfViewer({ doc, onClose }: { doc: ShipDoc; onClose: () => void }) {
  const { font } = useAppTheme()
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#111827' }}>
          <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#fff', flex: 1 }} numberOfLines={1}>{doc.filename}</Text>
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
            <Text style={{ fontSize: font.size.sm, color: '#94a3b8', marginTop: 12 }}>Preview not available</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ── Doc Card ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onPreview }: { doc: ShipDoc; onPreview: (d: ShipDoc) => void }) {
  const { colors, font, radius } = useAppTheme()
  return (
    <View style={{
      backgroundColor: colors.card,
      marginHorizontal: 16, marginBottom: 10, borderRadius: radius.md, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
    }}>
      <Text style={{ fontSize: 28, marginRight: 12 }}>{DOC_ICONS[doc.doc_type]}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }} numberOfLines={1}>{doc.filename || doc.doc_type_display}</Text>
        <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type_display}</Text>
        <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 1 }}>
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
  const { colors, font, radius, spacing, isDark } = useAppTheme()
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#7c3aed" accentPosition="left" style={{ marginHorizontal: 16, marginTop: spacing.lg, marginBottom: 8 }}>
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color="#e2e8f0" />
              </TouchableOpacity>
              <Text style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: colors.text, flex: 1 }}>Documents</Text>
              <TouchableOpacity
                onPress={() => setShowUpload(true)}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5801e', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 }}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: '#fff', marginLeft: 5 }}>Upload</Text>
              </TouchableOpacity>
            </View>

          {/* Shipment selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {shipments.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setShipId(String(s.id))}
                style={{
                  marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm,
                  backgroundColor: shipId === String(s.id) ? '#f5801e' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: shipId === String(s.id) ? '#fff' : colors.text }}>{s.tracking_number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>
        </GlassCard>

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
