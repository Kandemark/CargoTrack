import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { apiClient } from '@/lib/api'
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-ct-dark-bg">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3.5 border-b border-ct-border-light dark:border-ct-dark-border">
            <View>
              <Text className="text-ct-base font-extrabold text-ct-text-primary dark:text-ct-dark-text">Pay Invoice</Text>
              <Text className="text-ct-xs text-slate-400 mt-px">{invoice.invoice_number} · {Number(invoice.amount_kes).toLocaleString()} {invoice.currency}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {success ? (
              <View className="items-center py-10">
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                <Text className="text-ct-lg font-extrabold text-ct-text-primary dark:text-ct-dark-text mt-3">Payment Initiated!</Text>
                <Text className="text-ct-sm text-ct-text-muted dark:text-ct-dark-text-muted text-center mt-1.5 max-w-[260px]">Check your phone for the payment prompt. Enter your PIN to complete.</Text>
              </View>
            ) : polling ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#0f2d5e" />
                <Text className="text-ct-base font-bold text-ct-text-primary dark:text-ct-dark-text mt-4">Waiting for payment…</Text>
                <Text className="text-ct-xs text-slate-400 text-center mt-1.5">Check your phone and enter your PIN</Text>
              </View>
            ) : (
              <>
                {/* Provider tabs */}
                <Text className="text-ct-xs font-bold text-ct-text-muted dark:text-ct-dark-text-muted uppercase tracking-[0.5px] mb-2.5">Select Provider</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {PROVIDERS.map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => { setProvider(p.key); setInput(''); setErrMsg('') }}
                      className={`mr-2 px-3.5 py-2 rounded-ct-md ${selectedProvider === p.key ? 'bg-ct-navy dark:bg-ct-orange' : 'bg-slate-100 dark:bg-slate-800'}`}
                      activeOpacity={0.75}
                    >
                      <Text className={`text-ct-sm font-bold ${selectedProvider === p.key ? 'text-white' : 'text-ct-text-muted dark:text-slate-300'}`}>{p.emoji} {p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Input */}
                <Text className="text-ct-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{provider.inputLabel} *</Text>
                <TextInput
                  value={input}
                  onChangeText={(t) => { setInput(t); setErrMsg('') }}
                  placeholder={provider.placeholder}
                  keyboardType="phone-pad"
                  className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-ct-md px-3.5 py-3 text-ct-sm text-ct-text-primary dark:text-ct-dark-text bg-white dark:bg-ct-dark-surface mb-2"
                />

                {errMsg ? (
                  <View className="flex-row items-center bg-red-50 dark:bg-red-900/20 rounded-ct-md p-2.5 mb-2">
                    <Ionicons name="alert-circle" size={14} color="#dc2626" />
                    <Text className="text-ct-xs text-ct-danger ml-1.5 flex-1">{errMsg}</Text>
                  </View>
                ) : null}

                {selectedProvider === 'MPESA' && (
                  <Text className="text-ct-xs text-slate-400 mb-4 leading-4">An STK push will be sent to your M-Pesa number. Enter your PIN when prompted.</Text>
                )}

                <TouchableOpacity
                  onPress={() => void pay()}
                  disabled={paying}
                  className={`rounded-ct-md py-3.5 items-center mt-2 ${paying ? 'bg-slate-400 opacity-70' : 'bg-ct-navy dark:bg-ct-orange'}`}
                  activeOpacity={0.8}
                >
                  {paying ? <ActivityIndicator color="#fff" /> : (
                    <Text className="text-ct-sm font-extrabold text-white">Pay {Number(invoice.amount_kes).toLocaleString()} {invoice.currency} via {provider.label}</Text>
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
  const st = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.PENDING

  return (
    <View className="bg-ct-surface-card dark:bg-ct-dark-card mx-4 mb-2.5 rounded-ct-lg p-3.5 shadow-sm">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-ct-dark-text tabular-nums">{invoice.invoice_number}</Text>
          <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">Shipment: {invoice.shipment_tracking}</Text>
        </View>
        <View className="rounded-ct-sm px-2 py-[3px]" style={{ backgroundColor: st.bg }}>
          <Text className="text-ct-xs font-bold" style={{ color: st.text }}>{st.label}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-ct-lg font-extrabold text-ct-text-primary dark:text-ct-dark-text">
            {Number(invoice.amount_kes).toLocaleString()}
            <Text className="text-ct-sm text-ct-text-faint dark:text-slate-400 font-semibold"> {invoice.currency}</Text>
          </Text>
          <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">
            {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {(invoice.status === 'PENDING' || invoice.status === 'FAILED') && (
          <TouchableOpacity
            onPress={() => onPay(invoice)}
            className="bg-ct-orange rounded-ct-md px-4 py-2"
            activeOpacity={0.8}
          >
            <Text className="text-ct-sm font-extrabold text-white">Pay Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
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
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <View className="flex-1">
        {/* Glass header */}
        <GlassCard variant="elevated" accentColor="#16a34a" accentPosition="left" className="mx-4 mt-ct-lg mb-2">
          <View className="p-ct-lg">
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1" activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color="#e2e8f0" />
              </TouchableOpacity>
              <Text className="text-ct-xl font-extrabold text-ct-text-primary dark:text-white flex-1">Payments</Text>
              <Text className="text-ct-sm text-ct-text-muted dark:text-slate-300">{invoices.length} invoices</Text>
            </View>
          </View>
        </GlassCard>

        {loading ? (
          <View className="flex-1 items-center justify-center">
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
