import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface ETAResult {
  tracking_number: string; progress_pct: number; estimated_arrival: string
  estimated_remaining_hours: number; distance_remaining_km: number; total_distance_km: number
  current_speed_kmh: number; upcoming_border: string | null; border_wait_minutes: number | null
  confidence_low: string; confidence_high: string
}

export default function ETAScreen() {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [result, setResult] = useState<ETAResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { colors, font, brand, status, spacing } = useAppTheme()

  async function handleLookup() {
    if (!trackingNumber.trim()) return
    setLoading(true); setError('')
    try {
      const res = await apiClient.get<ETAResult>(`/api/v1/eta/?tracking_number=${encodeURIComponent(trackingNumber.trim())}`)
      if (res.data) setResult(res.data)
      else setError('No ETA data found for that tracking number.')
    } catch { setError('Failed to fetch ETA. Check the tracking number and try again.') }
    finally { setLoading(false) }
  }

  function formatDateTime(iso: string) { return new Date(iso).toLocaleString() }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="ETA Tracker" backButton />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <View style={[s.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textFaint} />
          <TextInput
            style={[s.input, { color: colors.text }]}
            placeholder="Enter tracking number..."
            placeholderTextColor={colors.textFaint}
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            onSubmitEditing={handleLookup}
            returnKeyType="search"
            autoCapitalize="characters"
          />
          <TouchableOpacity onPress={handleLookup} disabled={loading} style={[s.searchBtn, { backgroundColor: brand.primary }]}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-forward" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[s.tn, { color: colors.text }]}>{result.tracking_number}</Text>

            {/* Progress bar */}
            <View style={[s.progressTrack, { backgroundColor: colors.muted }]}>
              <View style={[s.progressFill, { width: `${Math.min(result.progress_pct, 100)}%`, backgroundColor: brand.primary }]} />
            </View>
            <Text style={[s.progressLabel, { color: colors.textMuted }]}>{result.progress_pct.toFixed(0)}% complete</Text>

            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <View style={s.row}>
              <Text style={[s.label, { color: colors.textFaint }]}>Estimated Arrival</Text>
              <Text style={[s.value, { color: colors.text }]}>{formatDateTime(result.estimated_arrival)}</Text>
            </View>

            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <View style={s.row}>
              <Text style={[s.label, { color: colors.textFaint }]}>Remaining</Text>
              <Text style={[s.value, { color: colors.text }]}>{result.estimated_remaining_hours.toFixed(1)}h · {result.distance_remaining_km.toFixed(0)} km</Text>
            </View>

            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <View style={s.row}>
              <Text style={[s.label, { color: colors.textFaint }]}>Speed</Text>
              <Text style={[s.value, { color: colors.text }]}>{result.current_speed_kmh.toFixed(1)} km/h</Text>
            </View>

            {result.upcoming_border && (
              <>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>Next Border</Text>
                  <Text style={[s.value, { color: colors.text }]}>{result.upcoming_border}{result.border_wait_minutes != null ? ` · ~${result.border_wait_minutes} min wait` : ''}</Text>
                </View>
              </>
            )}

            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <View style={s.row}>
              <Text style={[s.label, { color: colors.textFaint }]}>Confidence Window</Text>
              <Text style={[s.value, { color: colors.text }]}>{new Date(result.confidence_low).toLocaleString()} – {new Date(result.confidence_high).toLocaleString()}</Text>
            </View>
          </View>
        )}

        {error ? (
          <View style={[s.errorBox, { backgroundColor: '#ef444418', borderColor: '#ef444430' }]}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 48, gap: 8 },
  input: { flex: 1, fontSize: 15, fontWeight: '600' },
  searchBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  tn: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'right' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1 },
  errorBox: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16 },
})
