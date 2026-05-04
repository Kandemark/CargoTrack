import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Link2, CheckCircle, XCircle, AlertCircle, Settings,
  ExternalLink, Plus, Loader2, RefreshCw,
} from 'lucide-react'
import { integrationsApi, type Integration } from '@/api/integrations'

const STATUS_CFG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CONNECTED:    { label: 'Connected',    icon: CheckCircle,  color: 'text-green-500' },
  DISCONNECTED: { label: 'Disconnected', icon: XCircle,      color: 'text-gray-400' },
  ERROR:        { label: 'Error',        icon: AlertCircle,  color: 'text-red-500' },
}

const CATEGORIES = ['CUSTOMS', 'PORT', 'CARRIER', 'PAYMENTS', 'FINANCE', 'MAPS', 'COMMS']

export default function IntegrationHub() {
  const [items, setItems] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Integration>>({ category: 'CUSTOMS', status: 'DISCONNECTED' })

  const load = () => {
    setLoading(true)
    integrationsApi.list(category ? { category } : undefined)
      .then(r => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [category])

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await integrationsApi.create(form)
      setItems(prev => [...prev, res.data])
      setShowForm(false)
      setForm({ category: 'CUSTOMS', status: 'DISCONNECTED' })
    } catch { alert('Failed to add integration') }
    finally { setSaving(false) }
  }

  const toggleStatus = async (item: Integration) => {
    const newStatus = item.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED'
    const res = await integrationsApi.update(item.id, { status: newStatus })
    setItems(prev => prev.map(i => i.id === item.id ? res.data : i))
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this integration?')) return
    await integrationsApi.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const connected = items.filter(i => i.status === 'CONNECTED').length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integration Hub</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {connected} of {items.length} integrations connected
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Integration
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Integration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['name', 'Integration Name', 'text'],
              ['api_url', 'API URL', 'url'],
            ] as [keyof Integration, string, string][]).map(([f, l, t]) => (
              <div key={f}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{l}</label>
                <input
                  type={t}
                  value={(form[f] as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
              <select
                value={form.category ?? 'CUSTOMS'}
                onChange={e => setForm(p => ({ ...p, category: e.target.value as Integration['category'] }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Integration'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!category ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c === category ? null : c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${category === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Integration cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Link2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No integrations configured yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Click "Add Integration" to connect your first service</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item, i) => {
            const cfg = STATUS_CFG[item.status]
            const Icon = cfg.icon
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.category}</div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                    <Icon className="w-4 h-4" />{cfg.label}
                  </div>
                </div>

                {item.api_usage_pct > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1 text-gray-500 dark:text-gray-400">
                      <span>API Usage</span><span>{item.api_usage_pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${item.api_usage_pct > 80 ? 'bg-red-500' : item.api_usage_pct > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${item.api_usage_pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {item.last_sync && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                    Last sync: {new Date(item.last_sync).toLocaleString()}
                  </p>
                )}

                {item.has_webhook && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">Webhook</span>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => toggleStatus(item)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium ${
                      item.status === 'CONNECTED'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                        : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    {item.status === 'CONNECTED' ? 'Disconnect' : 'Connect'}
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {item.api_url && (
                    <a href={item.api_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="ml-auto text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
