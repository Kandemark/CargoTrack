import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { day, listOf, money } from '@/lib/data'
import { Button, Chip, Empty, HeroStats, Loading, Pill, ScreenFrame, Section, Txt, type PillTone } from '@/components/ui'
import type { Invoice, PaymentProvider } from '@shared/api/types'

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: 'To pay', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
}

const PROVIDERS: { key: PaymentProvider; label: string; inputLabel: string; placeholder: string }[] = [
  { key: 'MPESA', label: 'M-Pesa', inputLabel: 'M-Pesa phone number', placeholder: '254712345678' },
  { key: 'AIRTEL', label: 'Airtel Money', inputLabel: 'Airtel number', placeholder: '256712345678' },
  { key: 'MTN', label: 'MTN MoMo', inputLabel: 'MTN number', placeholder: '250712345678' },
  { key: 'FLUTTERWAVE', label: 'Flutterwave', inputLabel: 'Phone or email', placeholder: '256712345678' },
]

const payable = (i: Invoice) => i.status === 'PENDING' || i.status === 'FAILED' || (i.status as string) === 'OVERDUE'

/** Invoices for shipments: what is owed, what is paid, and paying by mobile money. */
export default function PaymentsScreen() {
  const back = useBack()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'open' | 'paid'>('open')
  const [payTarget, setPayTarget] = useState<Invoice | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/invoices/', { params: { page_size: 50 } })
      setInvoices(listOf<Invoice>(res.data))
    } catch {
      setInvoices([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const open = invoices.filter(payable)
  const paid = invoices.filter((i) => i.status === 'PAID')
  const owed = open.reduce((s, i) => s + Number(i.amount_kes), 0)
  const failed = invoices.filter((i) => i.status === 'FAILED').length
  const shown = filter === 'open' ? open : invoices.filter((i) => !payable(i))

  return (
    <ScreenFrame
      title="Payments"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        invoices.length ? (
          <HeroStats
            items={[
              { label: 'To pay', value: money(owed).replace('KES ', '') },
              { label: 'Failed', value: String(failed), tone: failed ? 'danger' : undefined },
              { label: 'Paid', value: String(paid.length) },
            ]}
          />
        ) : null
      }>
      {loading ? (
        <Loading />
      ) : invoices.length === 0 ? (
        <Empty icon="card-outline" title="No invoices yet" body="Invoices appear here when a shipment is billed." />
      ) : (
        <View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Chip label="To pay" selected={filter === 'open'} onPress={() => setFilter('open')} />
            <Chip label="Settled" selected={filter === 'paid'} onPress={() => setFilter('paid')} />
          </View>
          <Section label={filter === 'open' ? 'Amounts in KES' : 'Paid and refunded'}>
            {shown.length === 0 ? (
              <Empty icon="checkmark-circle-outline" title={filter === 'open' ? 'Nothing to pay' : 'Nothing settled yet'} />
            ) : (
              shown.map((inv, i) => <InvoiceRow key={inv.id} inv={inv} last={i === shown.length - 1} onPay={() => setPayTarget(inv)} />)
            )}
          </Section>
        </View>
      )}
      {payTarget ? <PaySheet invoice={payTarget} onClose={() => setPayTarget(null)} onPaid={() => { setPayTarget(null); load() }} /> : null}
    </ScreenFrame>
  )
}

function InvoiceRow({ inv, last, onPay }: { inv: Invoice; last: boolean; onPay: () => void }) {
  const { colors } = useAppTheme()
  const st = STATUS[inv.status] ?? STATUS.PENDING
  const canPay = payable(inv)
  return (
    <Pressable
      onPress={canPay ? onPay : undefined}
      disabled={!canPay}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>{(inv as { description?: string }).description || inv.shipment_tracking}</Txt>
          <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {inv.invoice_number} · {inv.shipment_tracking} · {day(inv.created_at)}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Txt variant="bodyStrong">{money(inv.amount_kes, inv.currency)}</Txt>
          <Pill label={st.label} tone={st.tone} />
        </View>
      </View>
      {canPay ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.textSecondary} />
          <Txt variant="caption" tone="secondary" style={{ fontFamily: 'DMSans-SemiBold' }}>
            {inv.status === 'FAILED' ? 'Try paying again' : 'Pay with mobile money'}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  )
}

function PaySheet({ invoice, onClose, onPaid }: { invoice: Invoice; onClose: () => void; onPaid: () => void }) {
  const { colors } = useAppTheme()
  const [provider, setProvider] = useState<PaymentProvider>('MPESA')
  const [input, setInput] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'waiting' | 'done'>('form')
  const [error, setError] = useState('')
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  const p = PROVIDERS.find((x) => x.key === provider) ?? PROVIDERS[0]

  useEffect(() => () => { if (poll.current) clearInterval(poll.current) }, [])

  async function pay() {
    if (!input.trim()) { setError(`Enter your ${p.inputLabel.toLowerCase()}.`); return }
    setState('sending')
    setError('')
    try {
      await apiClient.post(`/api/v1/invoices/${invoice.id}/pay/`, { provider, phone_number: input.trim() })
      setState('waiting')
      let tries = 0
      poll.current = setInterval(async () => {
        tries++
        try {
          const res = await apiClient.get<Invoice>(`/api/v1/invoices/${invoice.id}/`)
          if (res.data.status === 'PAID') {
            clearInterval(poll.current!)
            setState('done')
            setTimeout(onPaid, 1500)
            return
          }
        } catch { /* keep waiting */ }
        if (tries >= 12) {
          clearInterval(poll.current!)
          setState('form')
          setError('No confirmation yet. Check your phone, then try again.')
        }
      }, 5000)
    } catch (err: unknown) {
      setState('form')
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'The payment could not start. Try again.')
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ flex: 1 }}>
              <Txt variant="title">Pay {money(invoice.amount_kes, invoice.currency)}</Txt>
              <Txt variant="caption" tone="muted">{invoice.invoice_number} · {invoice.shipment_tracking}</Txt>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {state === 'done' ? (
              <Empty icon="checkmark-circle-outline" title="Paid" body="Thank you. The invoice is settled." />
            ) : state === 'waiting' ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                <ActivityIndicator size="large" color={colors.textBrand} />
                <Txt variant="heading">Check your phone</Txt>
                <Txt variant="body" tone="muted" style={{ textAlign: 'center' }}>Enter your PIN on the prompt from {p.label} to finish.</Txt>
              </View>
            ) : (
              <>
                <View>
                  <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>Pay with</Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {PROVIDERS.map((x) => (
                      <Chip key={x.key} label={x.label} selected={provider === x.key} onPress={() => { setProvider(x.key); setInput(''); setError('') }} />
                    ))}
                  </ScrollView>
                </View>
                <View>
                  <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>{p.inputLabel}</Txt>
                  <TextInput
                    value={input}
                    onChangeText={(t) => { setInput(t); setError('') }}
                    placeholder={p.placeholder}
                    placeholderTextColor={colors.textFaint}
                    keyboardType="phone-pad"
                    style={{ borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.muted, color: colors.text, fontFamily: 'DMSans-Medium', fontSize: 16 }}
                  />
                  {error ? <Txt variant="caption" tone="danger" style={{ marginTop: 8 }}>{error}</Txt> : null}
                  {provider === 'MPESA' ? (
                    <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>You will get an M-Pesa prompt on this number. Enter your PIN to pay.</Txt>
                  ) : null}
                </View>
                <Button variant="primary" onPress={pay} loading={state === 'sending'}>
                  {`Pay ${money(invoice.amount_kes, invoice.currency)}`}
                </Button>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}
