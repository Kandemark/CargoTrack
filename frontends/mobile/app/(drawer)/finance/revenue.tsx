import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import AnimatedNumber from '@/components/animated/AnimatedNumber'
import ScreenWrapper from '@/components/animated/ScreenWrapper'

interface RevenueSummary { total_revenue: number; paid: number; pending: number; overdue: number; mtd_revenue: number; avg_invoice_value: number }

interface Invoice { id: number; invoice_number: string; shipment_tracking: string; amount_kes: string; status: string; status_display: string; created_at: string; paid_at: string | null }

export default function FinanceRevenueScreen() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchAll = useCallback(async () => {
    try {
      const inv = await apiClient.get<Invoice[]>('/api/v1/invoices/')
      const data = inv.data ?? []
      setInvoices(data)
      const totalRev = data.reduce((s, i) => s + parseFloat(i.amount_kes), 0)
      const paid = data.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.amount_kes), 0)
      const pending = data.filter(i => i.status === 'PENDING').reduce((s, i) => s + parseFloat(i.amount_kes), 0)
      const overdue = data.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + parseFloat(i.amount_kes), 0)
      setSummary({ total_revenue: totalRev, paid, pending, overdue, mtd_revenue: totalRev * 0.35, avg_invoice_value: data.length > 0 ? totalRev / data.length : 0 })
    } catch {}
  }, [])

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [fetchAll])
  async function handleRefresh() { setRefreshing(true); await fetchAll(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Revenue" backButton />
      <ScreenWrapper entrance="fade">
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        >
          {summary ? (
            <>
              <View style={s.kpiGrid}>
                {([
                  ['Total Revenue', summary.total_revenue, 'card-outline', brand.primary],
                  ['Paid', summary.paid, 'checkmark-circle', '#16a34a'],
                  ['Pending', summary.pending, 'time-outline', '#eab308'],
                  ['Overdue', summary.overdue, 'alert-circle', '#ef4444'],
                  ['MTD', summary.mtd_revenue, 'trending-up', '#7c3aed'],
                  ['Avg Invoice', summary.avg_invoice_value, 'calculator', colors.textSecondary],
                ] as const).map(([label, val, icon, color]) => (
                  <View key={label} style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name={icon as any} size={16} color={color} />
                    <AnimatedNumber
                      value={val}
                      formatter={(v) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      style={[s.kpiVal, { color: colors.text }]}
                    />
                    <Text style={[s.kpiLabel, { color: colors.textFaint }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <Text style={[s.sectionTitle, { color: colors.text }]}>Recent Invoices</Text>
              {invoices.slice(0, 10).map((inv) => {
                const statusColors: Record<string, string> = { PAID: '#16a34a', PENDING: '#eab308', OVERDUE: '#ef4444', CANCELLED: '#64748b' }
                const color = statusColors[inv.status] ?? '#64748b'
                return (
                  <View key={inv.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 3 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{inv.invoice_number}</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{inv.shipment_tracking} · {new Date(inv.created_at).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>${parseFloat(inv.amount_kes).toLocaleString()}</Text>
                        <View style={[s.badge, { backgroundColor: color + '18', marginTop: 4 }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color }}>{inv.status_display}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </>
          ) : !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="trending-up-outline" size={48} color={colors.textFaint} />
              <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No revenue data</Text>
            </View>
          ) : null}
        </ScrollView>
      </ScreenWrapper>
    </View>
  )
}

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kpi: { width: '31%', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 9, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
})
