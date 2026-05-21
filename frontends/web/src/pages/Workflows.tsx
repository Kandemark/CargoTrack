/**
 * Workflows.tsx — Automated workflow/rule engine with visual rule builder.
 *
 * Triggers: shipment status changes, GPS/geo-fence entry, sensor alerts,
 * time-based schedules, document uploads.
 * Actions: send notification, update status, create task, call webhook.
 */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, X, Play, Pause, Trash2, Clock, MapPin, Thermometer,
  FileText, Bell, ArrowRight, Loader2, AlertCircle, CheckCircle,
  Activity, Code, Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/lib/roleUtils'
import { workflowsApi, type WorkflowRule } from '@/api/workflows'

const TRIGGERS = [
  { value: 'STATUS_CHANGE', label: 'Status Change', icon: Activity, desc: 'Fires when a shipment status changes' },
  { value: 'GEOFENCE_ENTER', label: 'Geofence Enter', icon: MapPin, desc: 'Fires when a truck enters a zone' },
  { value: 'GEOFENCE_EXIT', label: 'Geofence Exit', icon: MapPin, desc: 'Fires when a truck leaves a zone' },
  { value: 'TEMPERATURE', label: 'Temperature Alert', icon: Thermometer, desc: 'Fires when coldchain temp exceeds threshold' },
  { value: 'DOCUMENT_UPLOAD', label: 'Document Upload', icon: FileText, desc: 'Fires when a document is uploaded' },
  { value: 'TIME_SCHEDULE', label: 'Scheduled', icon: Clock, desc: 'Fires on a cron schedule' },
  { value: 'DELAY_DETECTED', label: 'Delay Detected', icon: AlertCircle, desc: 'Fires when ML predicts high delay risk' },
]

const ACTIONS = [
  { value: 'NOTIFY_USER', label: 'Notify User', icon: Bell },
  { value: 'NOTIFY_ROLE', label: 'Notify Role', icon: Bell },
  { value: 'UPDATE_STATUS', label: 'Update Status', icon: Activity },
  { value: 'CREATE_TASK', label: 'Create Task', icon: CheckCircle },
  { value: 'WEBHOOK', label: 'Call Webhook', icon: Code },
]

const STATUS_OPTIONS = ['PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELAYED', 'DELIVERED']
const SEVERITY: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-gray-100 text-gray-600',
}

// ── Rule Builder Modal ─────────────────────────────────────────────────────
function RuleBuilder({ rule, onSave, onClose }: {
  rule?: WorkflowRule; onSave: (data: Partial<WorkflowRule>) => void; onClose: () => void
}) {
  const isEdit = !!rule
  const [name, setName] = useState(rule?.name ?? '')
  const [trigger, setTrigger] = useState(rule?.trigger_type ?? 'STATUS_CHANGE')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(rule?.trigger_config ?? {})
  const [action, setAction] = useState(rule?.action_type ?? 'NOTIFY_USER')
  const [actionConfig, setActionConfig] = useState<Record<string, string>>(rule?.action_config ?? {})
  const [severity, setSeverity] = useState(rule?.severity ?? 'MEDIUM')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required.'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ name, trigger_type: trigger, trigger_config: triggerConfig, action_type: action, action_config: actionConfig, severity, is_active: rule?.is_active ?? true })
      onClose()
    } catch { setErr('Failed to save rule.') }
    finally { setSaving(false) }
  }

  void (TRIGGERS.find(t => t.value === trigger))
  void (ACTIONS.find(a => a.value === action))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }}
        className="w-full max-w-lg bg-white dark:bg-[#1a2235] rounded-2xl shadow-elevated border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/8 sticky top-0 bg-white dark:bg-[#1a2235] z-10">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{isEdit ? 'Edit Rule' : 'New Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{err}</p>}

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">Rule Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Notify customs on Kenya entry"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Trigger */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">When...</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {TRIGGERS.map(t => (
                <button key={t.value} onClick={() => setTrigger(t.value)}
                  className={cn('flex items-start gap-2 p-3 rounded-xl border text-left transition-colors',
                    trigger === t.value ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5')}>
                  <t.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: trigger === t.value ? '#3b82f6' : undefined }} />
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-white/80">{t.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Trigger config */}
          {trigger === 'STATUS_CHANGE' && (
            <div>
              <label className="text-xs text-gray-500">From status</label>
              <select value={triggerConfig.from_status ?? ''} onChange={e => setTriggerConfig(prev => ({ ...prev, from_status: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                <option value="">Any status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="text-xs text-gray-400 mx-2 my-2 block">to</span>
              <select value={triggerConfig.to_status ?? ''} onChange={e => setTriggerConfig(prev => ({ ...prev, to_status: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                <option value="">Any status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {trigger === 'TEMPERATURE' && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Threshold (°C)</label>
                <input type="number" value={triggerConfig.threshold_c ?? '4'} onChange={e => setTriggerConfig(prev => ({ ...prev, threshold_c: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Duration (min)</label>
                <input type="number" value={triggerConfig.duration_min ?? '30'} onChange={e => setTriggerConfig(prev => ({ ...prev, duration_min: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
              </div>
            </div>
          )}
          {trigger === 'TIME_SCHEDULE' && (
            <div>
              <label className="text-xs text-gray-500">Cron expression</label>
              <input value={triggerConfig.cron ?? ''} onChange={e => setTriggerConfig(prev => ({ ...prev, cron: e.target.value }))}
                placeholder="0 9 * * 1-5"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white font-mono" />
            </div>
          )}

          {/* Action */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">Then...</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {ACTIONS.map(a => (
                <button key={a.value} onClick={() => setAction(a.value)}
                  className={cn('flex items-center gap-2 p-3 rounded-xl border text-left transition-colors',
                    action === a.value ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5')}>
                  <a.icon className="w-4 h-4 shrink-0" style={{ color: action === a.value ? '#f5801e' : undefined }} />
                  <span className="text-xs font-semibold text-gray-800 dark:text-white/80">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {action === 'NOTIFY_USER' && (
            <div>
              <label className="text-xs text-gray-500">User ID(s) — comma-separated</label>
              <input value={actionConfig.user_ids ?? ''} onChange={e => setActionConfig(prev => ({ ...prev, user_ids: e.target.value }))}
                placeholder="1, 2, 3"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
            </div>
          )}
          {action === 'NOTIFY_ROLE' && (
            <div>
              <label className="text-xs text-gray-500">Target role</label>
              <select value={actionConfig.role ?? ''} onChange={e => setActionConfig(prev => ({ ...prev, role: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                <option value="">Select role...</option>
                {['SHIPPER', 'CARRIER', 'DRIVER', 'CUSTOMS_BROKER', 'WAREHOUSE_MANAGER', 'FINANCE', 'ADMIN'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          {action === 'UPDATE_STATUS' && (
            <div>
              <label className="text-xs text-gray-500">New status</label>
              <select value={actionConfig.new_status ?? ''} onChange={e => setActionConfig(prev => ({ ...prev, new_status: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {action === 'WEBHOOK' && (
            <div>
              <label className="text-xs text-gray-500">Webhook URL</label>
              <input value={actionConfig.url ?? ''} onChange={e => setActionConfig(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://hooks.slack.com/..."
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white" />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">Severity</label>
            <div className="flex gap-2 mt-1">
              {['LOW', 'MEDIUM', 'HIGH'].map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    severity === s ? SEVERITY[s] + ' border-current' : 'border-gray-200 dark:border-white/10 text-gray-500')}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/8">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--ct-navy)' }}>
            {saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Workflows() {
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingRule, setEditingRule] = useState<WorkflowRule | undefined>()
  const canManage = usePermission(Permission.ADMIN_SYSTEM)

  useEffect(() => {
    workflowsApi.list()
      .then(r => setRules(r.data))
      .catch(() => setError('Failed to load workflow rules'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(data: Partial<WorkflowRule>) {
    if (editingRule?.id) {
      const r = await workflowsApi.update(editingRule.id, data)
      setRules(prev => prev.map(w => w.id === editingRule.id ? r.data : w))
    } else {
      const r = await workflowsApi.create(data as any)
      setRules(prev => [...prev, r.data])
    }
  }

  async function handleToggle(rule: WorkflowRule) {
    const r = await workflowsApi.update(rule.id, { is_active: !rule.is_active })
    setRules(prev => prev.map(w => w.id === rule.id ? r.data : w))
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this rule?')) return
    await workflowsApi.delete(id)
    setRules(prev => prev.filter(w => w.id !== id))
  }

  const counts = useMemo(() => ({
    total: rules.length,
    active: rules.filter(r => r.is_active).length,
    high: rules.filter(r => r.severity === 'HIGH').length,
  }), [rules])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Engine</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Automate logistics operations with rules</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditingRule(undefined); setShowBuilder(true) }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--ct-orange)' }}>
            <Plus className="w-4 h-4" /> New Rule
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Rules', value: counts.total, icon: Workflow, color: 'text-blue-600' },
          { label: 'Active', value: counts.active, icon: Play, color: 'text-green-600' },
          { label: 'High Severity', value: counts.high, icon: AlertCircle, color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4">
            <k.icon className={cn('w-5 h-5 mb-2', k.color)} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{k.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Zap className="w-12 h-12 text-gray-200 dark:text-white/10" />
          <p className="text-sm text-gray-500 dark:text-white/30">No workflow rules configured</p>
          {canManage && (
            <button onClick={() => setShowBuilder(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
              Create Your First Rule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const trig = TRIGGERS.find(t => t.value === rule.trigger_type)
            const act = ACTIONS.find(a => a.value === rule.action_type)
            const TrigIcon = trig?.icon ?? Zap
            const ActIcon = act?.icon ?? Bell
            return (
              <motion.div key={rule.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={cn('bg-white dark:bg-gray-800/60 rounded-xl border p-4 transition-opacity',
                  !rule.is_active && 'opacity-50',
                  'border-gray-200 dark:border-gray-700/50')}>
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn('p-2 rounded-xl', rule.is_active ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-white/5')}>
                      <TrigIcon className="w-5 h-5" style={{ color: rule.is_active ? '#3b82f6' : undefined }} />
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <div className={cn('p-2 rounded-xl', rule.is_active ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-100 dark:bg-white/5')}>
                      <ActIcon className="w-5 h-5" style={{ color: rule.is_active ? '#f5801e' : undefined }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{rule.name}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30">
                        {trig?.label} → {act?.label}
                        {rule.execution_count > 0 && <span className="ml-2">· Fired {rule.execution_count}x</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', SEVERITY[rule.severity])}>{rule.severity}</span>
                    <button onClick={() => handleToggle(rule)}
                      className={cn('p-1.5 rounded-lg transition-colors',
                        rule.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8')}>
                      {rule.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditingRule(rule); setShowBuilder(true) }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8">
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(rule.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showBuilder && (
          <RuleBuilder rule={editingRule} onSave={handleSave} onClose={() => setShowBuilder(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
