/**
 * PlatformDashboard.tsx — CargoTrack system administration dashboard.
 *
 * Shows all organizations, all users, and platform-wide shipment/revenue KPIs.
 * PLATFORM_OWNER role bypasses tenant scoping — sees everything.
 *
 * @route /platform/dashboard
 * @auth CargoTrack (system admin) only
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import {
  Building2, Users, Package, TrendingUp, Globe2, ShieldCheck,
  Activity, RefreshCw, Search, Layers,
  AlertTriangle, MessageCircle, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi, type PlatformRevenueResponse } from '@/api/dashboard'
import { adminApi, type AdminUser } from '@/api/admin'
import type { DashboardSummary } from '@/types'

const ORG_COLORS = ['#0f2d5e', '#f5801e', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#ef4444']

const ROLE_COLORS: Record<string, string> = {
  PLATFORM_OWNER: '#dc2626',
  ADMIN: '#0f2d5e',
  LOGISTICS_MGR: '#f5801e',
  CARRIER: '#3b82f6',
  CLIENT: '#22c55e',
  DRIVER: '#0891b2',
  DISPATCHER: '#8b5cf6',
  CUSTOMS_BROKER: '#ec4899',
  WAREHOUSE_MGR: '#14b8a6',
  PORT_AGENT: '#f59e0b',
  FINANCE_OFFICER: '#6366f1',
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_OWNER: 'CargoTrack',
  ADMIN: 'Company Admin',
  LOGISTICS_MGR: 'Ops Manager',
  CARRIER: 'Carrier',
  CLIENT: 'Client',
  DRIVER: 'Driver',
  DISPATCHER: 'Dispatcher',
  CUSTOMS_BROKER: 'Customs',
  WAREHOUSE_MGR: 'Warehouse',
  PORT_AGENT: 'Port Agent',
  FINANCE_OFFICER: 'Finance',
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-elevated px-3 py-2 text-xs">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-700 dark:text-white/80">{p.name}:</span>
          <span className="text-gray-500 dark:text-white/50">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function PlatformDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [platformData, setPlatformData] = useState<PlatformRevenueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, usersRes, platformRes] = await Promise.all([
        dashboardApi.getStats(),
        adminApi.listUsers({ page_size: 500 }),
        dashboardApi.getPlatformRevenue(),
      ])
      setSummary(statsRes.data.summary)
      setUsers(usersRes.data.results)
      setPlatformData(platformRes.data)
    } catch {
      setError('Unable to load platform data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Computed ──────────────────────────────────────────────────────────────────
  const orgs = useMemo(() => {
    const map = new Map<string, { name: string; members: number; admins: number }>()
    for (const u of users) {
      const key = u.company || 'Unassigned'
      if (!map.has(key)) map.set(key, { name: key, members: 0, admins: 0 })
      const entry = map.get(key)!
      entry.members++
      if (u.role === 'ADMIN') entry.admins++
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ ...data, name }))
      .sort((a, b) => b.members - a.members)
  }, [users])

  const activeUsers = users.filter(u => u.is_active).length
  const last24h = users.filter(u => {
    if (!u.last_login) return false
    return (Date.now() - new Date(u.last_login).getTime()) < 86_400_000
  }).length

  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1
    return Object.entries(counts).map(([role, count]) => ({
      name: ROLE_LABELS[role] ?? role,
      value: count,
      fill: ROLE_COLORS[role] ?? '#94a3b8',
    }))
  }, [users])

  const userGrowth = useMemo(() => {
    const sorted = [...users].sort((a, b) =>
      new Date(a.date_joined).getTime() - new Date(b.date_joined).getTime()
    )
    const monthly = new Map<string, number>()
    for (const u of sorted) {
      const d = new Date(u.date_joined)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthly.set(key, (monthly.get(key) ?? 0) + 1)
    }
    const months = Array.from(monthly.keys()).sort()
    let cumulative = 0
    return months.map(m => {
      cumulative += monthly.get(m) ?? 0
      return { month: m, users: cumulative }
    })
  }, [users])

  const corridorChartData = useMemo(() => {
    if (!platformData?.corridor_volume) return []
    return platformData.corridor_volume.slice(0, 8).map(c => ({
      name: c.corridor.length > 22 ? c.corridor.slice(0, 21) + '…' : c.corridor,
      fullName: c.corridor,
      'In Transit': c.in_transit,
      Delivered: c.delivered,
      Customs: c.customs,
      Delayed: c.delayed,
      Pending: c.pending,
    }))
  }, [platformData])

  const revenueChartData = useMemo(() => {
    if (!platformData?.revenue_by_org) return []
    return platformData.revenue_by_org.slice(0, 10).map(r => ({
      name: r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name,
      fullName: r.name,
      revenue: Math.round(r.revenue_kes / 1000),
    }))
  }, [platformData])

  const orgChartData = useMemo(() => {
    return orgs.slice(0, 10).map((o, i) => ({
      name: o.name.length > 18 ? o.name.slice(0, 17) + '…' : o.name,
      fullName: o.name,
      members: o.members,
      fill: ORG_COLORS[i % ORG_COLORS.length],
    }))
  }, [orgs])

  const filteredOrgs = useMemo(() => {
    if (!search) return orgs
    const q = search.toLowerCase()
    return orgs.filter(o => o.name.toLowerCase().includes(q))
  }, [orgs, search])

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
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Platform Overview</h1>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Cross-tenant platform administration
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-white/60
            border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 h-28 animate-pulse" />
          ))
        ) : (
          <>
            <KPICard label="Organizations" value={orgs.length} sub="across platform" icon={Building2} color="#f5801e" delay={0} />
            <KPICard label="Total Users" value={users.length} sub={`${activeUsers} active`} icon={Users} color="#3b82f6" delay={0.03} />
            <KPICard label="Active Today" value={last24h} sub="last 24 hours" icon={Activity} color="#22c55e" delay={0.06} />
            <KPICard label="Total Shipments" value={summary?.total_shipments ?? '—'} sub="all time" icon={Package} color="#8b5cf6" delay={0.09} />
            <KPICard label="In Transit" value={summary?.active_shipments ?? '—'} sub="currently active" icon={Globe2} color="#14b8a6" delay={0.12} />
            <KPICard label="On-Time Rate" value={summary ? `${summary.on_time_rate.toFixed(1)}%` : '—'} sub="last 30 days" icon={TrendingUp} color="#6366f1" delay={0.15} />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Organizations bar chart */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="xl:col-span-7 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">Organizations by Members</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-4">Top 10 organizations — user count per tenant</p>
          {loading ? (
            <div className="h-48 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={orgChartData} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="members" name="Members" radius={[0, 4, 4, 0]}>
                  {orgChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Role distribution donut */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-5 bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5 flex flex-col">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">Platform Role Distribution</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-2">All users across all organizations</p>
          {loading ? (
            <div className="flex-1 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
          ) : (
            <div className="flex items-center gap-4 flex-1">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={2} dataKey="value">
                    {roleDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {roleDistribution.filter(r => r.value > 0).map((r) => (
                  <div key={r.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.fill }} />
                    <span className="text-gray-500 dark:text-white/40 truncate">{r.name}</span>
                    <span className="font-semibold text-gray-700 dark:text-white/70 ml-auto tabular-nums">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* System health */}
      {!loading && summary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Active Shipments', value: summary.active_shipments, icon: Package, color: '#3b82f6' },
            { label: 'Delayed', value: summary.delayed_shipments, icon: AlertTriangle, color: '#ef4444' },
            { label: 'Delivered', value: summary.delivered_shipments, icon: TrendingUp, color: '#22c55e' },
            { label: 'Active Carriers', value: summary.carrier_count, icon: Globe2, color: '#f5801e' },
            { label: 'Clearance Rate', value: platformData ? `${platformData.clearance_rate}%` : '—', icon: CheckCheck, color: '#14b8a6' },
            { label: 'Active Chats', value: platformData?.active_conversations ?? '—', icon: MessageCircle, color: '#8b5cf6' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 px-5 py-4 flex items-center gap-4">
              <div className="p-2 rounded-lg" style={{ background: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-white/40 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white font-heading tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Revenue & Corridor Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Revenue by organization */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">Revenue by Organization</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-4">MTD revenue in KES thousands</p>
          {loading ? (
            <div className="h-48 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
          ) : revenueChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChartData} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="k" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="KES (k)" radius={[0, 4, 4, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Shipment volume by corridor */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">Shipment Volume by Corridor</h2>
          <p className="text-xs text-gray-400 dark:text-white/30 mb-4">Stacked by status — top 8 corridors</p>
          {loading ? (
            <div className="h-48 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
          ) : corridorChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">No corridor data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={corridorChartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Pending" stackId="a" fill="#94a3b8" />
                <Bar dataKey="In Transit" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Customs" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Delayed" stackId="a" fill="#ef4444" />
                <Bar dataKey="Delivered" stackId="a" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* User growth trend */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
        <h2 className="text-sm font-bold text-gray-800 dark:text-white font-heading mb-1">User Growth Trend</h2>
        <p className="text-xs text-gray-400 dark:text-white/30 mb-4">Cumulative users across all organizations by month</p>
        {loading ? (
          <div className="h-56 rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse" />
        ) : userGrowth.length < 2 ? (
          <div className="flex items-center justify-center h-56 text-sm text-gray-400">Not enough data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="users" name="Total Users" stroke="#0f2d5e" strokeWidth={2.5}
                dot={{ fill: '#0f2d5e', r: 3 }} activeDot={{ r: 5, fill: '#f5801e', stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Organization table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 font-heading">
                <Building2 className="w-4 h-4 text-gray-400" />
                Tenant Organizations
              </h2>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                {orgs.length} organizations · {users.length} total users
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                  text-sm text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f2d5e]
                  dark:focus:ring-[#f5801e] focus:border-transparent w-52 transition-all"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-gray-100 dark:bg-white/5" />
                  <div className="h-3 w-48 rounded bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left bg-gray-50/50 dark:bg-white/[0.02]">
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Organization</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Members</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Admins</th>
                  <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filteredOrgs.map((org, i) => (
                  <tr key={org.name} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: ORG_COLORS[i % ORG_COLORS.length] }}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-white/90 text-sm">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-300 dark:text-white/15" />
                        <span className="text-sm text-gray-600 dark:text-white/60 tabular-nums">{org.members}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-600 dark:text-white/60 tabular-nums">{org.admins}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/5 max-w-[100px]">
                          <div className="h-full rounded-full" style={{
                            width: `${users.length ? (org.members / users.length * 100).toFixed(1) : 0}%`,
                            background: ORG_COLORS[i % ORG_COLORS.length],
                          }} />
                        </div>
                        <span className="text-xs text-gray-400 dark:text-white/30 tabular-nums">
                          {users.length ? (org.members / users.length * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 className="w-8 h-8 text-gray-300 dark:text-white/15" />
                        <p className="text-sm text-gray-400 dark:text-white/30">
                          {search ? 'No organizations match your search.' : 'No organizations found.'}
                        </p>
                        {search && (
                          <button onClick={() => setSearch('')}
                            className="text-xs font-semibold text-[#f5801e] hover:text-orange-600">
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/6 flex items-center justify-between text-xs text-gray-400 dark:text-white/30">
          <span>{filteredOrgs.length} of {orgs.length} organizations</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            CargoTrack view — all tenants visible
          </span>
        </div>
      </motion.div>
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, color, delay }: {
  label: string; value: string | number; sub?: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group bg-white dark:bg-[#1a2235] rounded-2xl border border-gray-200 dark:border-white/8 p-5
        hover:shadow-lg hover:border-gray-300 dark:hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white font-heading tabular-nums">{value}</p>
      <p className="text-sm font-medium text-gray-500 dark:text-white/40 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-white/25 mt-1">{sub}</p>}
    </motion.div>
  )
}
