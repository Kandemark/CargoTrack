import { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, Modal, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { day, listOf } from '@/lib/data'
import { Button, Chip, Empty, HeroStats, ListRow, Loading, Pill, ScreenFrame, Section, Txt, type PillTone } from '@/components/ui'
import type { Document as ShipDoc, DocType, ShipmentListItem } from '@shared/api/types'

/** A paper a shipment must carry (customs declaration, permit...), tracked whether or not a file exists. */
interface Required {
  id: number
  shipment: number
  doc_type_display: string
  status: string
  reference: string
  issued_by: string
  expiry_date: string | null
  days_until_expiry: number | null
}

const REQ_STATUS: Record<string, { label: string; tone: PillTone }> = {
  VALID: { label: 'Valid', tone: 'success' },
  EXPIRING: { label: 'Expiring', tone: 'warning' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
  MISSING: { label: 'Missing', tone: 'danger' },
  PENDING: { label: 'Pending', tone: 'neutral' },
}

const FILE_TYPES: { key: DocType; label: string }[] = [
  { key: 'BOL', label: 'Bill of lading' },
  { key: 'CUSTOMS', label: 'Customs' },
  { key: 'PACKING', label: 'Packing list' },
  { key: 'INSURANCE', label: 'Insurance' },
  { key: 'OTHER', label: 'Other' },
]

/**
 * All paperwork in one place, per shipment: the papers it must carry and
 * their state, then the files uploaded for it. Upload from camera or files.
 */
export default function DocumentsScreen() {
  const back = useBack()
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [required, setRequired] = useState<Required[]>([])
  const [files, setFiles] = useState<Record<number, ShipDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [focus, setFocus] = useState<number | 'all'>('all')
  const [uploadFor, setUploadFor] = useState<ShipmentListItem | null>(null)

  const load = useCallback(async () => {
    try {
      const [sh, req] = await Promise.all([
        apiClient.get('/api/v1/shipments/', { params: { page_size: 100 } }),
        apiClient.get('/api/v1/compliance/', { params: { page_size: 100 } }),
      ])
      const list = listOf<ShipmentListItem>(sh.data)
      setShipments(list)
      setRequired(listOf<Required>(req.data))
      const perShipment = await Promise.all(
        list.map((s) => apiClient.get(`/api/v1/shipments/${s.id}/documents/`).then((r) => [s.id, listOf<ShipDoc>(r.data)] as const).catch(() => [s.id, []] as const)),
      )
      setFiles(Object.fromEntries(perShipment))
    } catch {
      setShipments([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const missing = required.filter((r) => r.status === 'MISSING' || r.status === 'EXPIRED').length
  const expiring = required.filter((r) => r.status === 'EXPIRING' || (r.days_until_expiry !== null && r.days_until_expiry <= 14 && r.days_until_expiry >= 0)).length
  const fileCount = Object.values(files).reduce((s, f) => s + f.length, 0)
  const withPapers = shipments.filter((s) => required.some((r) => r.shipment === s.id) || (files[s.id]?.length ?? 0) > 0)
  const shown = focus === 'all' ? withPapers : withPapers.filter((s) => s.id === focus)

  return (
    <ScreenFrame
      title="Documents"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        !loading ? (
          <HeroStats
            items={[
              { label: 'Missing', value: String(missing), tone: missing ? 'danger' : undefined },
              { label: 'Expiring', value: String(expiring), tone: expiring ? 'warning' : undefined },
              { label: 'Files', value: String(fileCount) },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : (
        <View style={{ gap: 32 }}>
          {withPapers.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              <Chip label="All" selected={focus === 'all'} onPress={() => setFocus('all')} />
              {withPapers.map((s) => (
                <Chip key={s.id} label={s.tracking_number} selected={focus === s.id} onPress={() => setFocus(s.id)} />
              ))}
            </ScrollView>
          ) : null}

          {shown.length === 0 ? (
            <Empty
              icon="document-text-outline"
              title="No paperwork yet"
              body="Upload a bill of lading, customs papers or insurance for a shipment."
              action={shipments[0] ? <Button variant="primary" onPress={() => setUploadFor(shipments[0])}>Upload a document</Button> : undefined}
            />
          ) : (
            shown.map((s) => {
              const req = required.filter((r) => r.shipment === s.id)
              const docs = files[s.id] ?? []
              const rows = req.length + docs.length
              let n = 0
              return (
                <Section key={s.id} label={`${s.tracking_number} · ${s.route.origin} → ${s.route.destination}`} action="Upload" onAction={() => setUploadFor(s)}>
                  {req.map((r) => {
                    const st = REQ_STATUS[r.status] ?? REQ_STATUS.PENDING
                    n++
                    return (
                      <ListRow
                        key={`r${r.id}`}
                        icon="shield-checkmark-outline"
                        title={r.doc_type_display}
                        subtitle={[r.reference || 'No reference yet', r.expiry_date ? `expires ${day(r.expiry_date)}` : null].filter(Boolean).join(' · ')}
                        trailing={<Pill label={st.label} tone={st.tone} />}
                        last={n === rows}
                      />
                    )
                  })}
                  {docs.map((d) => {
                    n++
                    return (
                      <ListRow
                        key={`f${d.id}`}
                        icon="document-attach-outline"
                        title={d.filename || d.doc_type_display}
                        subtitle={`${d.doc_type_display} · ${d.uploaded_by_name ?? 'Unknown'} · ${day(d.created_at)}`}
                        onPress={d.file_url ? () => Linking.openURL(d.file_url!) : undefined}
                        last={n === rows}
                      />
                    )
                  })}
                </Section>
              )
            })
          )}
        </View>
      )}
      {uploadFor ? <UploadSheet shipment={uploadFor} onClose={() => setUploadFor(null)} onDone={() => { setUploadFor(null); load() }} /> : null}
    </ScreenFrame>
  )
}

function UploadSheet({ shipment, onClose, onDone }: { shipment: ShipmentListItem; onClose: () => void; onDone: () => void }) {
  const { colors } = useAppTheme()
  const [docType, setDocType] = useState<DocType>('OTHER')
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Camera needed', 'Allow camera access to photograph a document.'); return }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
    if (!r.canceled && r.assets[0]) setFile({ uri: r.assets[0].uri, name: `photo_${Date.now()}.jpg`, type: 'image/jpeg' })
  }

  async function fromFiles() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
    if (!r.canceled && r.assets[0]) setFile({ uri: r.assets[0].uri, name: r.assets[0].name, type: r.assets[0].mimeType ?? 'application/octet-stream' })
  }

  async function upload() {
    if (!file) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob)
      fd.append('doc_type', docType)
      await apiClient.post(`/api/v1/shipments/${shipment.id}/documents/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onDone()
    } catch {
      Alert.alert('Upload failed', 'Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="title">Upload a document</Txt>
            <Txt variant="caption" tone="muted">{shipment.tracking_number} · {shipment.route.origin} → {shipment.route.destination}</Txt>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
          <View>
            <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>Kind of document</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FILE_TYPES.map((t) => <Chip key={t.key} label={t.label} selected={docType === t.key} onPress={() => setDocType(t.key)} />)}
            </View>
          </View>
          <View>
            <Txt variant="label" tone="faint" style={{ marginBottom: 4 }}>File</Txt>
            <ListRow icon="camera-outline" title="Take a photo" onPress={fromCamera} />
            <ListRow icon="folder-open-outline" title="Choose a PDF or image" onPress={fromFiles} last />
            {file ? <Txt variant="body" tone="muted" style={{ marginTop: 8 }}>Selected: {file.name}</Txt> : null}
          </View>
          <Button variant="primary" onPress={upload} loading={saving} disabled={!file}>Upload</Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
