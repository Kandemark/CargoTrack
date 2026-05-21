import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import { EmptyState, Button, GlassCard } from '@/components/ui'
import type { Invoice, InvoiceStatus, PaymentProvider } from '@shared/api/types'

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  PENDING:  { label: 'Pending',  bg: '#fef3c7', text: '#92400e' },
  PAID:     { label: 'Paid',     bg: '#d1fae5', text: '#065f46' },
  FAILED:   { label: 'Failed',   bg: '#fee2e2', text: '#991b1b' },
  REFUNDED: { label: 'Refunded', bg: '#f3f4f6', text: '#6b7280' },
}

const PROVIDERS: { key: PaymentProvider; label: string; emoji: string; placeholder: string; inputLabel: string }[] = [
  { key: 'MPESA', label: 'M-Pesa', emoji: '🇰🇪', inputLabel: 'M-Pesa phone', placeholder: '254712345678' },
  { key: 'AIRTEL', label: 'Airtel Money', emoji: '🇺🇬', inputLabel: 'Airtel number', placeholder: '256712345678' },
  { key: 'MTN', label: 'MTN MoMo', emoji: '🇷🇼', inputLabel: 'MTN number', placeholder: '250712345678' },
  { key: 'FLUTTERWAVE', label: 'Flutterwave', emoji: '🌍', inputLabel: 'Phone/email', placeholder: '256712345678' },
]

// ── Pay Modal ─────────────────────────────────────────────────────────────────

function PayModal({ invoice, onClose, onPaid }: { invoice: Invoice; onClose: () => void; onPaid: () => void }) {
  const { colors, font, radius, isDark } = useAppTheme()
  const [selectedProvider, setProvider] = useState<PaymentProvider>('MPESA')
  const [input, setInput] = useState('')
  const [paying, setPaying] = useState(false)
  const [polling, setPolling] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [success, setSuccess] = useState(false)

  const provider = PROVIDERS.find((p) => p.key === selectedProvider) ?? PROVIDERS[0]

  async function pay() {
    if (!input.trim()) { setErrMsg(`Please enter your ${provider.inputLabel}.`); return }
    setPaying(true); setErrMsg('')
    try {
      await apiClient.post(`/api/v1/invoices/${invoice.id}/pay/`, { provider: selectedProvider, phone_number: input.trim() })
      setPolling(true)
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        try {
          const res = await apiClient.get<Invoice>(`/api/v1/invoices/${invoice.id}/`)
          if (res.data.status === 'PAID') { clearInterval(interval); setPolling(false); setSuccess(true); setTimeout(() => onPaid(), 1800) }
        } catch { /* keep polling */ }
        if (attempts >= 12) { clearInterval(interval); setPolling(false); setErrMsg('Payment timed out. Check your phone and try again.') }
      }, 5000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrMsg(msg ?? 'Payment failed. Please try again.')
    } finally { setPaying(false) }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: isDark ? colors.background : '#fff' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View>
              <Text style={{ fontSize: font.size.base, fontWeight: font.weight.extrabold, color: colors.text }}>Pay Invoice</Text>
              <Text style={{ fontSize: font.size.xs, color: '#94a3b8', marginTop: 1 }}>{invoice.invoice_number} · {Number(invoice.amount_kes).toLocaleString()} {invoice.currency}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {success ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.extrabold, color: colors.text, marginTop: 12 }}>Payment Initiated!</Text>
                <Text style={{ fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: 6, maxWidth: 260 }}>Check your phone for the payment prompt. Enter your PIN to complete.</Text>
              </View>
            ) : polling ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#0f2d5e" />
                <Text style={{ fontSize: font.size.base, fontWeight: font.weight.bold, color: colors.text, marginTop: 16 }}>Waiting for payment…</Text>
                <Text style={{ fontSize: font.size.xs, color: '#94a3b8', textAlign: 'center', marginTop: 6 }}>Check your phone and enter your PIN</Text>
              </View>
            ) : (
              <>
                {/* Provider tabs */}
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Select Provider</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {PROVIDERS.map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => { setProvider(p.key); setInput(''); setErrMsg('') }}
                      style={{
                        marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md,
                        backgroundColor: selectedProvider === p.key ? (isDark ? '#f5801e' : '#0f2d5e') : (isDark ? '#1e293b' : '#f1f5f9'),
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: selectedProvider === p.key ? '#fff' : colors.textMuted }}>{p.emoji} {p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Input */}
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#cbd5e1' : '#334155', marginBottom: 6 }}>{provider.inputLabel} *</Text>
                <TextInput
                  value={input}
                  onChangeText={(t) => { setInput(t); setErrMsg('') }}
                  placeholder={provider.placeholder}
                  keyboardType="phone-pad"
                  style={{ borderWidth: 1.5, borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.size.sm, color: colors.text, backgroundColor: isDark ? colors.muted : '#fff', marginBottom: 8 }}
                />

                {errMsg ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(127,29,29,0.2)' : '#fef2f2', borderRadius: radius.md, padding: 10, marginBottom: 8 }}>
                    <Ionicons name="alert-circle" size={14} color="#dc2626" />
                    <Text style={{ fontSize: font.size.xs, color: '#EF4444', marginLeft: 6, flex: 1 }}>{errMsg}</Text>
                  </View>
                ) : null}

                {selectedProvider === 'MPESA' && (
                  <Text style={{ fontSize: font.size.xs, color: '#94a3b8', marginBottom: 16, lineHeight: 16 }}>An STK push will be sent to your M-Pesa number. Enter your PIN when prompted.</Text>
                )}

                <TouchableOpacity
                  onPress={() => void pay()}
                  disabled={paying}
                  style={{
                    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 8,
                    backgroundColor: paying ? '#94a3b8' : (isDark ? '#f5801e' : '#0f2d5e'),
                    opacity: paying ? 0.7 : 1,
                  }}
                  activeOpacity={0.8}
                >
                  {paying ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: '#fff' }}>Pay {Number(invoice.amount_kes).toLocaleString()} {invoice.currency} via {provider.label}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Invoice Row ───────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onPay }: { invoice: Invoice; onPay: (inv: Invoice) => void }) {
  const { colors, font, radius } = useAppTheme()
  const st = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.PENDING

  return (
    <View style={{
      backgroundColor: colors.card,
      marginHorizontal: 16, marginBottom: 10, borderRadius: radius.lg, padding: 14,
      shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text, fontVariant: ['tabular-nums'] }}>{invoice.invoice_number}</Text>
          <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>Shipment: {invoice.shipment_tracking}</Text>
        </View>
        <View style={{ borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: st.bg }}>
          <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: st.text }}>{st.label}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.extrabold, color: colors.text }}>
            {Number(invoice.amount_kes).toLocaleString()}
            <Text style={{ fontSize: font.size.sm, color: colors.textFaint, fontWeight: font.weight.semibold }}> {invoice.currency}</Text>
          </Text>
          <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>
            {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {(invoice.status === 'PENDING' || invoice.status === 'FAILED') && (
          <TouchableOpacity
            onPress={() => onPay(invoice)}
            style={{ backgroundColor: '#f5801e', borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 8 }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: '#fff' }}>Pay Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const { colors, font, radius, spacing, isDark } = useAppTheme()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [payTarget, setPayTarget] = useState<Invoice | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const res = await apiClient.get<{ results?: Invoice[] } | Invoice[]>('/api/v1/invoices/?page_size=50')
      const data = (res.data as { results?: Invoice[] })?.results ?? (res.data as Invoice[]) ?? []
      setInvoices(data)
    } catch {
      Alert.alert('Error', 'Failed to load invoices.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#16a34a" accentPosition="left" style={{ marginHorizontal: 16, marginTop: spacing.lg, marginBottom: 8 }}>
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color="#e2e8f0" />
              </TouchableOpacity>
              <Text style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: colors.text, flex: 1 }}>Payments</Text>
              <Text style={{ fontSize: font.size.sm, color: colors.textMuted }}>{invoices.length} invoices</Text>
            </View>
          </View>
        </GlassCard>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#f5801e" />
          </View>
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(inv) => String(inv.id)}
            renderItem={({ item }) => <InvoiceRow invoice={item} onPay={setPayTarget} />}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#f5801e" />}
            ListEmptyComponent={
              <EmptyState icon="card-outline" title="No invoices yet" description="Invoices will appear here once generated" size="lg" />
            }
          />
        )}

        {payTarget && (
          <PayModal invoice={payTarget} onClose={() => setPayTarget(null)} onPaid={() => { setPayTarget(null); void load() }} />
        )}
      </View>
    </SafeAreaView>
  )
}
