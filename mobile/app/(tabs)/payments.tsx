/**
 * mobile/app/(tabs)/payments.tsx
 * Invoice list + Pay Now with M-Pesa STK push polling.
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
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import type { Invoice, InvoiceStatus, PaymentProvider } from '@shared/api/types'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  PENDING:  { label: 'Pending',  bg: '#fef3c7', text: '#92400e' },
  PAID:     { label: 'Paid',     bg: '#d1fae5', text: '#065f46' },
  FAILED:   { label: 'Failed',   bg: '#fee2e2', text: '#991b1b' },
  REFUNDED: { label: 'Refunded', bg: '#f3f4f6', text: '#6b7280' },
}

interface Provider {
  key: PaymentProvider
  label: string
  emoji: string
  placeholder: string
  inputLabel: string
}

const PROVIDERS: Provider[] = [
  { key: 'MPESA',       label: 'M-Pesa',      emoji: '🇰🇪', inputLabel: 'M-Pesa phone',  placeholder: '254712345678' },
  { key: 'AIRTEL',      label: 'Airtel Money', emoji: '🇺🇬', inputLabel: 'Airtel number', placeholder: '256712345678' },
  { key: 'MTN',         label: 'MTN MoMo',    emoji: '🇷🇼', inputLabel: 'MTN number',    placeholder: '250712345678' },
  { key: 'FLUTTERWAVE', label: 'Flutterwave', emoji: '🌍', inputLabel: 'Phone/email',   placeholder: '256712345678' },
]

// ── Pay Modal ─────────────────────────────────────────────────────────────────

function PayModal({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: Invoice
  onClose: () => void
  onPaid: () => void
}) {
  const [selectedProvider, setProvider] = useState<PaymentProvider>('MPESA')
  const [input,   setInput]   = useState('')
  const [paying,  setPaying]  = useState(false)
  const [polling, setPolling] = useState(false)
  const [errMsg,  setErrMsg]  = useState('')
  const [success, setSuccess] = useState(false)

  const provider = PROVIDERS.find((p) => p.key === selectedProvider) ?? PROVIDERS[0]

  async function pay() {
    if (!input.trim()) { setErrMsg(`Please enter your ${provider.inputLabel}.`); return }
    setPaying(true); setErrMsg('')
    try {
      await apiClient.post(`/api/v1/invoices/${invoice.id}/pay/`, {
        provider: selectedProvider,
        phone_number: input.trim(),
      })
      // STK push sent — now poll for completion
      setPolling(true)
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        try {
          const res = await apiClient.get<Invoice>(`/api/v1/invoices/${invoice.id}/`)
          if (res.data.status === 'PAID') {
            clearInterval(interval)
            setPolling(false)
            setSuccess(true)
            setTimeout(() => { onPaid() }, 1800)
          }
        } catch { /* keep polling */ }
        if (attempts >= 12) {
          clearInterval(interval)
          setPolling(false)
          setErrMsg('Payment timed out. Check your phone and try again.')
        }
      }, 5000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrMsg(msg ?? 'Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Pay Invoice</Text>
              <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                {invoice.invoice_number} · {Number(invoice.amount_kes).toLocaleString()} {invoice.currency}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {success ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 12 }}>Payment Initiated!</Text>
                <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6, maxWidth: 260 }}>
                  Check your phone for the payment prompt. Enter your PIN to complete.
                </Text>
              </View>
            ) : polling ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#0f2d5e" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 16 }}>Waiting for payment…</Text>
                <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
                  Check your phone and enter your PIN
                </Text>
              </View>
            ) : (
              <>
                {/* Provider tabs */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Select Provider</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {PROVIDERS.map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => { setProvider(p.key); setInput(''); setErrMsg('') }}
                      style={{
                        marginRight: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: selectedProvider === p.key ? '#0f2d5e' : '#f1f5f9',
                      }}
                      activeOpacity={0.75}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: selectedProvider === p.key ? '#fff' : '#6b7280' }}>
                        {p.emoji} {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Input */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>{provider.inputLabel} *</Text>
                <TextInput
                  value={input}
                  onChangeText={(t) => { setInput(t); setErrMsg('') }}
                  placeholder={provider.placeholder}
                  keyboardType="phone-pad"
                  style={{
                    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 12,
                    fontSize: 14, color: '#111827', backgroundColor: '#fff', marginBottom: 8,
                  }}
                />

                {errMsg ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    <Ionicons name="alert-circle" size={14} color="#dc2626" />
                    <Text style={{ fontSize: 12, color: '#dc2626', marginLeft: 6, flex: 1 }}>{errMsg}</Text>
                  </View>
                ) : null}

                {selectedProvider === 'MPESA' && (
                  <Text style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16, lineHeight: 16 }}>
                    An STK push will be sent to your M-Pesa number. Enter your PIN when prompted.
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() => void pay()}
                  disabled={paying}
                  style={{
                    backgroundColor: paying ? '#6b7280' : '#0f2d5e',
                    borderRadius: 14, paddingVertical: 14,
                    alignItems: 'center', marginTop: 8, opacity: paying ? 0.7 : 1,
                  }}
                  activeOpacity={0.8}>
                  {paying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                      Pay {Number(invoice.amount_kes).toLocaleString()} {invoice.currency} via {provider.label}
                    </Text>
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
  const st = STATUS[invoice.status] ?? STATUS.PENDING

  return (
    <View style={{
      backgroundColor: '#fff',
      marginHorizontal: 16, marginBottom: 10,
      borderRadius: 16, padding: 14,
      shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>
            {invoice.invoice_number}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            Shipment: {invoice.shipment_tracking}
          </Text>
        </View>
        <View style={{ backgroundColor: st.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: st.text }}>{st.label}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>
            {Number(invoice.amount_kes).toLocaleString()}
            <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '600' }}> {invoice.currency}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {(invoice.status === 'PENDING' || invoice.status === 'FAILED') && (
          <TouchableOpacity
            onPress={() => onPay(invoice)}
            style={{ backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}
            activeOpacity={0.8}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Pay Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const [invoices,   setInvoices]   = useState<Invoice[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [payTarget,  setPayTarget]  = useState<Invoice | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiClient.get<{ results?: Invoice[] } | Invoice[]>('/api/v1/invoices/?page_size=50')
      const data = (res.data as { results?: Invoice[] })?.results ?? (res.data as Invoice[]) ?? []
      setInvoices(data)
    } catch {
      Alert.alert('Error', 'Failed to load invoices.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

        {/* Header */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Payments</Text>
            <Text style={{ color: '#93b4d8', fontSize: 12 }}>{invoices.length} invoices</Text>
          </View>
        </View>

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
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="card-outline" size={40} color="#cbd5e1" />
                <Text style={{ color: '#9ca3af', marginTop: 10, fontSize: 14 }}>No invoices yet</Text>
              </View>
            }
          />
        )}

        {payTarget && (
          <PayModal
            invoice={payTarget}
            onClose={() => setPayTarget(null)}
            onPaid={() => { setPayTarget(null); void load() }}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
