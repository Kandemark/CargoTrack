import { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { day, listOf, money } from '@/lib/data'
import { Button, Chip, Empty, HeroStats, KeyValue, ListRow, Loading, Pill, ScreenFrame, Section, Txt, type PillTone } from '@/components/ui'

interface Bid {
  id: number
  carrier_name: string
  amount: string
  estimated_days: number | null
  notes: string
  status: string
}

interface Listing {
  id: number
  posted_by_name: string
  cargo_type_display?: string
  cargo_type: string
  weight_kg: number
  origin: string
  destination: string
  pickup_date: string
  delivery_date: string
  budget_min: string | null
  budget_max: string | null
  description: string
  requires_hazmat: boolean
  requires_reefer: boolean
  status: string
  bid_count: number
  lowest_bid: number | null
  bids?: Bid[]
}

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  OPEN: { label: 'Open', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  AWARDED: { label: 'Awarded', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  PENDING: { label: 'Waiting', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REJECTED: { label: 'Not chosen', tone: 'neutral' },
}

const CARRIER_ROLES = new Set(['CARRIER', 'DISPATCHER'])
type Tab = 'mine' | 'browse' | 'bids'

/**
 * Loads put out to carriers. Shippers post loads and pick a bid; carriers
 * browse open loads and bid on them.
 */
export default function JobBoardScreen() {
  const back = useBack()
  const role = useAuthStore((s) => s.user?.role ?? '')
  const isCarrier = CARRIER_ROLES.has(role)
  const [tab, setTab] = useState<Tab>(isCarrier ? 'browse' : 'mine')
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Listing | null>(null)

  const load = useCallback(async () => {
    const path = tab === 'mine' ? '/api/v1/marketplace/my-listings/' : tab === 'bids' ? '/api/v1/marketplace/my-bids/' : '/api/v1/marketplace/listings/'
    try {
      const res = await apiClient.get(path)
      setItems(listOf<Listing>(res.data))
    } catch {
      setItems([])
    }
  }, [tab])

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)) }, [load])

  if (selected) {
    return <ListingDetail listing={selected} mine={tab === 'mine'} canBid={isCarrier && tab === 'browse'} onBack={() => { setSelected(null); load() }} />
  }

  const open = items.filter((l) => l.status === 'OPEN').length
  const bids = items.reduce((s, l) => s + (l.bid_count ?? 0), 0)
  const awarded = items.filter((l) => l.status === 'AWARDED' || l.status === 'COMPLETED').length

  return (
    <ScreenFrame
      title="Job board"
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
      hero={
        items.length && tab !== 'bids' ? (
          <HeroStats
            items={[
              { label: 'Open', value: String(open) },
              { label: tab === 'mine' ? 'Bids received' : 'Bids placed', value: String(bids) },
              { label: 'Awarded', value: String(awarded) },
            ]}
          />
        ) : null
      }>
      <View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {!isCarrier ? <Chip label="My loads" selected={tab === 'mine'} onPress={() => setTab('mine')} /> : null}
          <Chip label="Open loads" selected={tab === 'browse'} onPress={() => setTab('browse')} />
          {isCarrier ? <Chip label="My bids" selected={tab === 'bids'} onPress={() => setTab('bids')} /> : null}
        </View>
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty
            icon="briefcase-outline"
            title={tab === 'mine' ? 'No loads posted' : tab === 'bids' ? 'No bids yet' : 'No open loads'}
            body={tab === 'mine' ? 'Post a load on the web app and carriers will bid on it.' : 'Loads put out by shippers appear here.'}
          />
        ) : (
          <Section label={tab === 'mine' ? 'Your loads' : tab === 'bids' ? 'Your bids' : 'Open now'}>
            {items.map((l, i) => {
              const st = STATUS[l.status] ?? { label: l.status, tone: 'neutral' as PillTone }
              return (
                <ListRow
                  key={l.id}
                  title={`${l.origin} → ${l.destination}`}
                  subtitle={`${(l.weight_kg / 1000).toFixed(1)} t · pickup ${day(l.pickup_date)} · ${l.bid_count} bid${l.bid_count === 1 ? '' : 's'}${l.lowest_bid ? `, lowest ${money(l.lowest_bid)}` : ''}`}
                  trailing={<Pill label={st.label} tone={st.tone} />}
                  onPress={() => setSelected(l)}
                  last={i === items.length - 1}
                />
              )
            })}
          </Section>
        )}
      </View>
    </ScreenFrame>
  )
}

function ListingDetail({ listing: l, mine, canBid, onBack }: { listing: Listing; mine: boolean; canBid: boolean; onBack: () => void }) {
  const [bids, setBids] = useState<Bid[]>(l.bids ?? [])
  const [bidding, setBidding] = useState(false)

  function accept(b: Bid) {
    Alert.alert(`Accept ${b.carrier_name}?`, `${money(b.amount)}. The other bids will be declined.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            await apiClient.post(`/api/v1/marketplace/bids/${b.id}/accept/`)
            setBids((all) => all.map((x) => ({ ...x, status: x.id === b.id ? 'ACCEPTED' : 'REJECTED' })))
          } catch {
            Alert.alert('Not accepted', 'Check your connection and try again.')
          }
        },
      },
    ])
  }

  const budget = l.budget_min ? `${money(l.budget_min)}${l.budget_max ? ` to ${money(l.budget_max).replace('KES ', '')}` : ''}` : 'Open'
  const anyAccepted = bids.some((b) => b.status === 'ACCEPTED')

  return (
    <ScreenFrame eyebrow={l.cargo_type_display ?? l.cargo_type} title={`${l.origin} → ${l.destination}`} subtitle={`Posted by ${l.posted_by_name}`} onBack={onBack}>
      <Section label="Load">
        <KeyValue label="Weight" value={`${(l.weight_kg / 1000).toFixed(1)} t`} />
        <KeyValue label="Pickup" value={day(l.pickup_date)} />
        <KeyValue label="Delivery" value={day(l.delivery_date)} />
        <KeyValue label="Budget" value={budget} />
        {l.requires_hazmat || l.requires_reefer ? (
          <KeyValue label="Needs" value={[l.requires_hazmat && 'Hazardous goods licence', l.requires_reefer && 'Refrigerated truck'].filter(Boolean).join(', ')} />
        ) : null}
        <KeyValue label="Notes" value={l.description || '—'} last />
      </Section>

      {mine ? (
        <Section label={bids.length ? 'Bids, lowest first' : 'Bids'}>
          {bids.length === 0 ? (
            <Empty icon="hourglass-outline" title="No bids yet" body="Carriers usually bid within a day." />
          ) : (
            [...bids].sort((a, b) => Number(a.amount) - Number(b.amount)).map((b, i, all) => {
              const st = STATUS[b.status] ?? STATUS.PENDING
              return (
                <View key={b.id}>
                  <ListRow
                    icon="business-outline"
                    title={b.carrier_name}
                    subtitle={[money(b.amount), b.estimated_days ? `${b.estimated_days} days` : null, b.notes].filter(Boolean).join(' · ')}
                    subtitleLines={3}
                    trailing={<Pill label={st.label} tone={st.tone} />}
                    onPress={!anyAccepted && b.status === 'PENDING' ? () => accept(b) : undefined}
                    last={i === all.length - 1}
                  />
                </View>
              )
            })
          )}
          {!anyAccepted && bids.length ? <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>Tap a bid to accept it.</Txt> : null}
        </Section>
      ) : null}

      {canBid ? <Button variant="primary" onPress={() => setBidding(true)}>Place a bid</Button> : null}
      {bidding ? <BidSheet listing={l} onClose={() => setBidding(false)} /> : null}
    </ScreenFrame>
  )
}

function BidSheet({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { colors } = useAppTheme()
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function send() {
    setSaving(true)
    try {
      await apiClient.post(`/api/v1/marketplace/listings/${listing.id}/bid/`, { amount, estimated_days: days ? Number(days) : null, notes })
      Alert.alert('Bid sent', 'The shipper will see it straight away.')
      onClose()
    } catch {
      Alert.alert('Not sent', 'Check the amount and try again.')
    } finally {
      setSaving(false)
    }
  }

  const input = { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.muted, color: colors.text, fontFamily: 'DMSans-Medium', fontSize: 16 } as const

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="title">Place a bid</Txt>
            <Txt variant="caption" tone="muted">{listing.origin} → {listing.destination}</Txt>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View>
            <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>Your price, KES</Txt>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={input} />
          </View>
          <View>
            <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>Days to deliver</Txt>
            <TextInput value={days} onChangeText={setDays} keyboardType="number-pad" style={input} />
          </View>
          <View>
            <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>Note for the shipper</Txt>
            <TextInput value={notes} onChangeText={setNotes} multiline style={[input, { minHeight: 90, textAlignVertical: 'top' }]} />
          </View>
          <Button variant="primary" onPress={send} loading={saving} disabled={!amount}>Send bid</Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
