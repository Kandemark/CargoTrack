import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Loader2 } from 'lucide-react'
import { auditApi, type AuditEntry } from '@/api/audit'

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILURE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const ACTIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'VIEW']
const RESULTS = ['ALL', 'SUCCESS', 'FAILURE', 'WARNING']

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const load = useCallback(() => {
    setLoading(true)
    auditApi.list({
      action: actionFilter === 'ALL' ? undefined : actionFilter,
      result: resultFilter === 'ALL' ? undefined : resultFilter,
      q: search || undefined,
      page,
      page_size: PAGE_SIZE,
    })
      .then(r => {
        const data = r.data
        setEntries(data.results ?? (data as unknown as AuditEntry[]))
        setTotal(data.count ?? 0)
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [actionFilter, resultFilter, search, page])

  useEffect(() => { load() }, [load])

  const failed = entries.filter(e => e.result === 'FAILURE').length
  const warned = entries.filter(e => e.result === 'WARNING').length
  const uniqueUsers = new Set(entries.map(e => e.username).filter(Boolean)).size

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Complete system activity trail for compliance and security</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: total, color: 'text-blue-600' },
          { label: 'Unique Users', value: uniqueUsers, color: 'text-indigo-600' },
          { label: 'Failed Actions', value: failed, color: 'text-red-600' },
          { label: 'Warnings', value: warned, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search actions, resources…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-1">
            {ACTIONS.map(a => (
              <button key={a} onClick={() => { setActionFilter(a); setPage(1) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${actionFilter === a ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >{a}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {RESULTS.map(r => (
              <button key={r} onClick={() => { setResultFilter(r); setPage(1) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${resultFilter === r ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >{r}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Time', 'User', 'Action', 'Resource', 'Description', 'IP Address', 'Result'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No audit entries found</td></tr>
              ) : (
                entries.map(e => (
                  <tr
                    key={e.id}
                    className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      e.result === 'FAILURE' ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{e.full_name || e.username || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs font-medium">{e.resource}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">{e.description}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.ip_address ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESULT_COLORS[e.result]}`}>
                        {e.result}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500">{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40">
                Prev
              </button>
              <button disabled={page * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
