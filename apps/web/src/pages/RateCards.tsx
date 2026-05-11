import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Edit, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { carriersApi, type RateCard, type Carrier } from '@/api/carriers'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  EXPIRING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXPIRED:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DRAFT:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

export default function RateCards() {
  const [cards, setCards] = useState<RateCard[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const canManageRates = usePermission(Permission.RATES_MANAGE)
  const [form, setForm] = useState<Partial<RateCard>>({
    status: 'ACTIVE', currency: 'KES', is_hazmat: false, is_reefer: false,
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      carriersApi.listRateCards({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        carrier: carrierFilter !== 'ALL' ? Number(carrierFilter) : undefined,
        search: search || undefined,
        page_size: 100,
      }),
      carriersApi.list({ page_size: 100 }),
    ])
      .then(([ratesRes, carriersRes]) => {
        setCards(ratesRes.data.results ?? (ratesRes.data as unknown as RateCard[]))
        setCarriers(carriersRes.data.results ?? (carriersRes.data as unknown as Carrier[]))
      })
      .catch(() => setError('Failed to load rate cards'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, statusFilter, carrierFilter])

  const handleCreate = async () => {
    if (!form.carrier || !form.name || !form.origin || !form.destination) return
    setSaving(true)
    try {
      const res = await carriersApi.createRateCard(form)
      setCards(prev => [res.data, ...prev])
      setShowForm(false)
      setForm({ status: 'ACTIVE', currency: 'KES', is_hazmat: false, is_reefer: false,
        valid_from: new Date().toISOString().slice(0, 10),
        valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      })
    } catch { alert('Failed to create rate card') }
    finally { setSaving(false) }
  }

  const handleRenew = async (card: RateCard) => {
    const newUntil = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    const res = await carriersApi.updateRateCard(card.id, { status: 'ACTIVE', valid_until: newUntil })
    setCards(prev => prev.map(c => c.id === card.id ? res.data : c))
  }

  const stats = {
    active: cards.filter(c => c.status === 'ACTIVE').length,
    expiring: cards.filter(c => c.status === 'EXPIRING').length,
    expired: cards.filter(c => c.status === 'EXPIRED').length,
    draft: cards.filter(c => c.status === 'DRAFT').length,
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rate Cards</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Carrier pricing and route rates</p>
        </div>
        {canManageRates && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Rate Card
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active', value: stats.active, color: 'text-green-600' },
          { label: 'Expiring Soon', value: stats.expiring, color: 'text-amber-600' },
          { label: 'Expired', value: stats.expired, color: 'text-red-600' },
          { label: 'Draft', value: stats.draft, color: 'text-gray-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Rate Card</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Carrier</label>
                <select
                  value={form.carrier ?? ''}
                  onChange={e => setForm(p => ({ ...p, carrier: Number(e.target.value) }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select carrier…</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {([
                ['name', 'Rate Card Name', 'text'],
                ['origin', 'Origin', 'text'],
                ['destination', 'Destination', 'text'],
                ['cargo_type', 'Cargo Type', 'text'],
                ['per_kg', 'Per KG Rate', 'number'],
                ['per_km', 'Per KM Rate', 'number'],
                ['min_charge', 'Min Charge', 'number'],
                ['valid_from', 'Valid From', 'date'],
                ['valid_until', 'Valid Until', 'date'],
              ] as [keyof RateCard, string, string][]).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form[field] as string | number) ?? ''}
                    onChange={e => setForm(p => ({ ...p, [field]: type === 'number' ? e.target.value : e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label>
                <select
                  value={form.currency ?? 'KES'}
                  onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {['KES', 'USD', 'TZS', 'UGX', 'RWF'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_hazmat ?? false}
                    onChange={e => setForm(p => ({ ...p, is_hazmat: e.target.checked }))}
                    className="rounded" />
                  Hazmat
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_reefer ?? false}
                    onChange={e => setForm(p => ({ ...p, is_reefer: e.target.checked }))}
                    className="rounded" />
                  Reefer
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Create Rate Card'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rate cards…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'DRAFT'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {s}
            </button>
          ))}
        </div>
        {carriers.length > 0 && (
          <select
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="ALL">All Carriers</option>
            {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 p-4"><AlertCircle className="w-5 h-5" />{error}</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No rate cards found. Add a carrier first, then create rate cards.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card, i) => {
            const days = daysUntil(card.valid_until)
            const isExpiring = days >= 0 && days <= 30
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{card.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{card.carrier_name}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[card.status]}`}>{card.status}</span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-medium">
                  {card.origin} → {card.destination}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  {[
                    { label: `${card.currency}/kg`, value: Number(card.per_kg).toFixed(2) },
                    { label: `${card.currency}/km`, value: Number(card.per_km).toFixed(2) },
                    { label: 'Min Charge', value: Number(card.min_charge).toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{s.value}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">{card.cargo_type}</span>
                  {card.is_hazmat && <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">Hazmat</span>}
                  {card.is_reefer && <span className="text-xs bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-full">Reefer</span>}
                </div>

                <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Valid: {new Date(card.valid_from).toLocaleDateString()} – {new Date(card.valid_until).toLocaleDateString()}
                  {isExpiring && <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">Expires in {days}d</span>}
                  {days < 0 && <span className="ml-2 text-red-500 font-medium">Expired {Math.abs(days)}d ago</span>}
                </div>

                {canManageRates && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(editingId === card.id ? null : card.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  {(card.status === 'EXPIRED' || card.status === 'EXPIRING') && (
                    <button
                      onClick={() => handleRenew(card)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100"
                    >
                      <RefreshCw className="w-3 h-3" /> Renew
                    </button>
                  )}
                </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
