/**
 * @file AdminDashboard.tsx
 * @description System administrator dashboard — KPI overview + user management.
 *
 * Data sources:
 *   GET /api/v1/dashboard/stats/       — KPI summary
 *   GET /api/v1/accounts/users/        — all platform users (paginated)
 *
 * @route /admin/dashboard
 * @auth ADMIN only
 */
import { useEffect, useState } from 'react'
import {
  Users, Package, AlertTriangle,
  RefreshCw, ShieldCheck, UserCog, Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardApi } from '@/api/dashboard'
import { adminApi, type AdminUser } from '@/api/admin'
import type { DashboardSummary } from '@/types'

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPICard({
  label, value, icon: Icon, iconBg,
}: {
  label: string; value: string | number
  icon: React.ElementType; iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={cn('p-3 rounded-lg', iconBg)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [summary, setSummary]   = useState<DashboardSummary | null>(null)
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, usersRes] = await Promise.all([
        dashboardApi.getStats(),
        adminApi.listUsers({ page_size: 50 }),
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
      const { data: updated } = await adminApi.updateUser(user.id, {
        role: newRole as AdminUser['role'],
      })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch {
      // silently ignore; the select reverts on re-render
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleActive(user: AdminUser) {
    setSavingId(user.id)
    try {
      const { data: updated } = await adminApi.updateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch {
      // ignore
    } finally {
      setSavingId(null)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--ct-navy)' }}
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  const activeUsers = users.filter((u) => u.is_active).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">System-wide overview and user management</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
          ))
        ) : (
          <>
            <KPICard label="Total Users"      value={users.length}                    icon={Users}        iconBg="bg-blue-500"    />
            <KPICard label="Active Users"     value={activeUsers}                     icon={ShieldCheck}  iconBg="bg-emerald-500" />
            <KPICard label="Total Shipments"  value={summary?.total_shipments ?? '—'} icon={Package}      iconBg="bg-amber-500"   />
            <KPICard label="Open Alerts"      value={summary?.open_alerts ?? '—'}     icon={AlertTriangle} iconBg="bg-red-500"   />
          </>
        )}
      </div>

      {/* System stats row */}
      {!loading && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Shipments',   value: summary.active_shipments   },
            { label: 'Delayed Shipments',  value: summary.delayed_shipments  },
            { label: 'Delivered',          value: summary.delivered_shipments },
            { label: 'On-Time Rate',       value: `${summary.on_time_rate.toFixed(1)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* User management table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-gray-400" />
              User Management
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {users.length} registered users · {activeUsers} active
            </p>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-gray-100" />
                  <div className="h-3 w-56 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">User</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Company</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Role</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className={cn('hover:bg-gray-50 transition-colors', !u.is_active && 'opacity-50')}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: 'var(--ct-navy)' }}
                        >
                          {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Building2 className="w-3 h-3 text-gray-300 shrink-0" />
                        {u.company || <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="LOGISTICS_MGR">Ops Manager</option>
                        <option value="CARRIER">Carrier</option>
                        <option value="CLIENT">Client</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={savingId === u.id}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50',
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 hover:bg-red-100',
                        )}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 tabular-nums">
                      {new Date(u.date_joined).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
