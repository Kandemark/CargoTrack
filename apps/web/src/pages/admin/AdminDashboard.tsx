/**
 * AdminDashboard.tsx — System administrator dashboard with analytics & user management.
 *
 * @route /admin/dashboard
 * @auth ADMIN only
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Users, Package, AlertTriangle, RefreshCw, ShieldCheck, UserCog, Building2,
  Activity, TrendingUp, Search, Filter, ChevronRight, UserPlus, UserX,
  Clock, Globe2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import { adminApi, type AdminUser } from '@/api/admin'
import type { DashboardSummary } from '@/types'

// ── Color constants ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#0f2d5e',
  LOGISTICS_MGR: '#f97316',
  CARRIER: '#3b82f6',
  CLIENT: '#22c55e',
  DISPATCHER: '#8b5cf6',
  CUSTOMS_BROKER: '#ec4899',
  WAREHOUSE_MGR: '#14b8a6',
  PORT_AGENT: '#f59e0b',
  FINANCE_OFFICER: '#6366f1',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  LOGISTICS_MGR: 'Ops Manager',
  CARRIER: 'Carrier',
  CLIENT: 'Client',
  DISPATCHER: 'Dispatcher',
  CUSTOMS_BROKER: 'Customs',
  WAREHOUSE_MGR: 'Warehouse',
  PORT_AGENT: 'Port Agent',
  FINANCE_OFFICER: 'Finance',
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fullName?: string } }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-elevated px-3 py-2 text-xs">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-700 dark:text-white/80">{p.payload.fullName ?? p.name}:</span>
          <span className="text-gray-500 dark:text-white/50">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, color, delay }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/8 p-5
        hover:shadow-lg hover:border-gray-200 dark:hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-200 dark:text-white/10 group-hover:text-gray-400 transition-colors" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{value}</p>
      <p className="text-sm font-medium text-gray-500 dark:text-white/40 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-white/25 mt-1">{sub}</p>}
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, usersRes] = await Promise.all([
        dashboardApi.getStats(),
        adminApi.listUsers({ page_size: 200 }),
      ])
      setSummary(statsRes.data.summary)
      setUsers(usersRes.data.results)
    } catch {
      setError('Unable to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRoleChange(user: AdminUser, newRole: string) {
    setSavingId(user.id)
    try {
      const { data: updated } = await adminApi.updateUser(user.id, { role: newRole as AdminUser['role'] })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch { /* ignore */ }
    finally { setSavingId(null) }
  }

  async function handleToggleActive(user: AdminUser) {
    setSavingId(user.id)
    try {
      const { data: updated } = await adminApi.updateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch { /* ignore */ }
    finally { setSavingId(null) }
  }

  // ── Computed data ──────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    let list = users
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((u) =>
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company ?? '').toLowerCase().includes(q),
      )
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter)
    return list
  }, [users, search, roleFilter])

  const activeUsers = users.filter((u) => u.is_active).length

  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1
    return Object.entries(counts).map(([role, count]) => ({
      name: ROLE_LABELS[role] ?? role,
      fullName: ROLE_LABELS[role] ?? role,
      value: count,
      fill: ROLE_COLORS[role] ?? '#94a3b8',
    }))
  }, [users])

  const userRegistrations = useMemo(() => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const now = new Date()
    const buckets: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets[`${MONTHS[d.getMonth()]} ${d.getFullYear()}`] = 0
    }
    for (const u of users) {
      const d = new Date(u.date_joined)
      if (isNaN(d.getTime())) continue
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      if (key in buckets) buckets[key]++
    }
    return Object.entries(buckets).map(([month, count]) => ({ month, count }))
  }, [users])

  const last24h = users.filter((u) => {
    if (!u.last_login) return false
    return (Date.now() - new Date(u.last_login).getTime()) < 86_400_000
  }).length

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-white/60">{error}</p>
        <button onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--ct-navy)' }}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">System Administration</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Platform overview & user management
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-white/60
            border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </motion.div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/8 p-5 h-28 animate-pulse" />
          ))
        ) : (
          <>
            <KPICard label="Total Users" value={users.length} sub={`${activeUsers} active`} icon={Users} color="#3b82f6" delay={0} />
            <KPICard label="Active Today" value={last24h} sub="last 24 hours" icon={Activity} color="#22c55e" delay={0.03} />
            <KPICard label="Total Shipments" value={summary?.total_shipments ?? '—'} sub="all time" icon={Package} color="#f97316" delay={0.06} />
            <KPICard label="In Transit" value={summary?.active_shipments ?? '—'} sub="currently active" icon={Globe2} color="#8b5cf6" delay={0.09} />
            <KPICard label="Open Alerts" value={summary?.open_alerts ?? '—'} sub="needs attention" icon={AlertTriangle} color="#ef4444" delay={0.12} />
            <KPICard label="On-Time Rate" value={summary ? `${summary.on_time_rate.toFixed(1)}%` : '—'} sub="last 30 days" icon={TrendingUp} color="#14b8a6" delay={0.15} />
          </>
        )}
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* User registrations trend */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="xl:col-span-8 bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">User Registrations</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-4">New accounts — rolling 6 months</p>
          {loading ? (
            <div className="h-48 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={userRegistrations} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="New Users" fill="#0f2d5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Role distribution donut */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-4 bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/8 p-5 flex flex-col">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">Role Distribution</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-2">Users by role</p>
          {loading ? (
            <div className="flex-1 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
          ) : (
            <div className="flex flex-col items-center gap-2 flex-1">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                    {roleDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full grid grid-cols-2 gap-x-2 gap-y-1">
                {roleDistribution.filter(r => r.value > 0).slice(0, 8).map((r) => (
                  <div key={r.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.fill }} />
                    <span className="text-gray-500 dark:text-white/40 truncate">{r.name}</span>
                    <span className="font-semibold text-gray-700 dark:text-white/70 ml-auto">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── System health ───────────────────────────────────────────────── */}
      {!loading && summary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Shipments', value: summary.active_shipments, color: '#3b82f6' },
            { label: 'Delayed', value: summary.delayed_shipments, color: '#ef4444' },
            { label: 'Delivered', value: summary.delivered_shipments, color: '#22c55e' },
            { label: 'Carriers Active', value: summary.carrier_count, color: '#f97316' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-white/8 px-5 py-4 flex items-center gap-4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <div>
                <p className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white font-heading">{value}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── User management table ────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-white/8 overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 font-heading">
                <UserCog className="w-4 h-4 text-gray-400" />
                User Management
              </h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                {users.length} registered · {activeUsers} active · {users.length - activeUsers} inactive
              </p>
            </div>

            {/* Search & filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                    text-sm text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f2d5e]
                    dark:focus:ring-[#f5801e] focus:border-transparent w-44 transition-all"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                  text-sm text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0f2d5e]
                  dark:focus:ring-[#f5801e] focus:border-transparent"
              >
                <option value="">All roles</option>
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table body */}
        {loading ? (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-gray-100 dark:bg-white/5" />
                  <div className="h-3 w-48 rounded bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left bg-gray-50/50 dark:bg-white/[0.02]">
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">User</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Company</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Role</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Status</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Joined</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filteredUsers.map((u) => (
                  <tr key={u.id}
                    className={cn(
                      'hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors',
                      !u.is_active && 'opacity-50',
                    )}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                          style={{ background: ROLE_COLORS[u.role] ?? '#0f2d5e' }}
                        >
                          {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 dark:text-white/90 text-sm truncate">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-white/30 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-white/60">
                        <Building2 className="w-3 h-3 text-gray-300 dark:text-white/15 shrink-0" />
                        <span className="truncate max-w-[120px]">{u.company || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5
                          bg-white dark:bg-gray-800 text-gray-700 dark:text-white
                          focus:outline-none focus:ring-2 focus:ring-[#0f2d5e] dark:focus:ring-[#f5801e]
                          disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {Object.entries(ROLE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={savingId === u.id}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-50',
                          u.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
                        )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-emerald-500' : 'bg-red-500')} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 dark:text-white/30 tabular-nums whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(u.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 dark:text-white/30 tabular-nums whitespace-nowrap">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : <span className="text-gray-300 dark:text-white/15">Never</span>}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {search || roleFilter ? (
                          <>
                            <Search className="w-8 h-8 text-gray-300 dark:text-white/15" />
                            <p className="text-sm text-gray-400 dark:text-white/30">No users match your filters.</p>
                            <button onClick={() => { setSearch(''); setRoleFilter('') }}
                              className="text-xs font-semibold text-[#f5801e] hover:text-orange-600">
                              Clear filters
                            </button>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-8 h-8 text-gray-300 dark:text-white/15" />
                            <p className="text-sm text-gray-400 dark:text-white/30">No users registered yet.</p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/6 flex items-center justify-between text-xs text-gray-400 dark:text-white/30">
          <span>{filteredUsers.length} of {users.length} users shown</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Admin view — all roles visible
          </span>
        </div>
      </motion.div>

    </div>
  )
}
