import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, ChevronDown, ChevronUp, Star, Phone, Mail, MapPin, Loader2, AlertCircle } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { carriersApi, type Carrier } from '@/api/carriers'

const fade = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INACTIVE:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function Carriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const canManageRates = usePermission(Permission.RATES_MANAGE)
  const [form, setForm] = useState<Partial<Carrier>>({
    status: 'ACTIVE', country: 'Kenya', on_time_rate: 95, rating: 4.5,
  })

  const load = () => {
    setLoading(true)
    carriersApi.list({ search, status: statusFilter === 'ALL' ? undefined : statusFilter, page_size: 100 })
      .then(r => setCarriers(r.data.results ?? (r.data as unknown as Carrier[])))
      .catch(() => setError('Failed to load carriers'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, statusFilter])

  const handleCreate = async () => {
    if (!form.name || !form.code) return
    setSaving(true)
    try {
      const res = await carriersApi.create(form)
      setCarriers(prev => [res.data, ...prev])
      setShowForm(false)
      setForm({ status: 'ACTIVE', country: 'Kenya', on_time_rate: 95, rating: 4.5 })
    } catch {
      alert('Failed to create carrier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this carrier?')) return
    await carriersApi.delete(id)
    setCarriers(prev => prev.filter(c => c.id !== id))
  }

  const stats = {
    active: carriers.filter(c => c.status === 'ACTIVE').length,
    avgOnTime: carriers.length ? Math.round(carriers.reduce((s, c) => s + c.on_time_rate, 0) / carriers.length) : 0,
    total: carriers.reduce((s, c) => s + c.total_shipments, 0),
    highRisk: carriers.reduce((s, c) => s + c.high_risk_count, 0),
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Carriers</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage carrier companies and performance</p>
        </div>
        {canManageRates && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Carrier
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Carriers', value: stats.active },
          { label: 'Avg On-Time Rate', value: `${stats.avgOnTime}%` },
          { label: 'Total Shipments', value: stats.total.toLocaleString() },
          { label: 'High Risk Count', value: stats.highRisk },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add Carrier Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Carrier</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                ['code', 'Carrier Code', 'text'],
                ['name', 'Company Name', 'text'],
                ['contact_name', 'Contact Name', 'text'],
                ['phone', 'Phone', 'tel'],
                ['email', 'Email', 'email'],
                ['headquarters', 'Headquarters', 'text'],
                ['country', 'Country', 'text'],
                ['on_time_rate', 'On-Time Rate (%)', 'number'],
                ['rating', 'Rating (0–5)', 'number'],
              ] as [keyof Carrier, string, string][]).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form[field] as string | number) ?? ''}
                    onChange={e => setForm(p => ({ ...p, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCreate} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create Carrier'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search carriers…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Carrier Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 p-4"><AlertCircle className="w-5 h-5" />{error}</div>
      ) : carriers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No carriers found. Add one to get started.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {carriers.map((c, i) => (
            <motion.div
              key={c.id} variants={fade} initial="hidden" animate="visible"
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{c.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{c.code}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                </div>

                {/* On-time bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>On-Time Rate</span><span className="font-medium text-gray-900 dark:text-white">{c.on_time_rate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div
                      className={`h-1.5 rounded-full ${c.on_time_rate >= 90 ? 'bg-green-500' : c.on_time_rate >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${c.on_time_rate}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  {[
                    { label: 'Total', value: c.total_shipments },
                    { label: 'Active', value: c.active_shipments },
                    { label: 'High Risk', value: c.high_risk_count },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{s.value}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} className={`w-3 h-3 ${si < Math.round(c.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                    ))}
                    <span className="text-xs text-gray-500 ml-1">{c.rating.toFixed(1)}</span>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {expandedId === c.id ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />Details</>}
                  </button>
                </div>

                {c.specialties?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.specialties.map(sp => (
                      <span key={sp} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">{sp}</span>
                    ))}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {expandedId === c.id && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-gray-100 dark:border-gray-700"
                  >
                    <div className="p-5 space-y-2 bg-gray-50 dark:bg-gray-700/30">
                      {c.contact_name && <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><span className="font-medium w-20 text-gray-500">Contact</span>{c.contact_name}</div>}
                      {c.phone && <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><Phone className="w-3.5 h-3.5 text-gray-400" />{c.phone}</div>}
                      {c.email && <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><Mail className="w-3.5 h-3.5 text-gray-400" />{c.email}</div>}
                      {c.headquarters && <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><MapPin className="w-3.5 h-3.5 text-gray-400" />{c.headquarters}, {c.country}</div>}
                      {c.contract_end && <div className="text-xs text-amber-600 dark:text-amber-400">Contract expires: {new Date(c.contract_end).toLocaleDateString()}</div>}
                      {canManageRates && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-xs text-red-500 hover:underline mt-2"
                        >
                          Delete carrier
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
