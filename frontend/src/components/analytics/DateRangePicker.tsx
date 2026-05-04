import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  onChange: (range: { date_from?: string; date_to?: string }) => void
  className?: string
}

const PRESETS: { label: string; getValue: () => { date_from: string; date_to?: string } }[] = [
  { label: '7D', getValue: () => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return { date_from: d.toISOString().slice(0, 10) }
  }},
  { label: '30D', getValue: () => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return { date_from: d.toISOString().slice(0, 10) }
  }},
  { label: 'QTD', getValue: () => {
    const d = new Date()
    const qm = Math.floor(d.getMonth() / 3) * 3
    return { date_from: new Date(d.getFullYear(), qm, 1).toISOString().slice(0, 10) }
  }},
  { label: 'YTD', getValue: () => {
    return { date_from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10) }
  }},
  { label: 'All', getValue: () => ({ date_from: '' }) },
]

export default function DateRangePicker({ onChange, className }: DateRangePickerProps) {
  const [active, setActive] = useState('30D')
  const [custom, setCustom] = useState(false)
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  function applyPreset(preset: typeof PRESETS[0], key: string) {
    setActive(key)
    setCustom(false)
    const range = preset.getValue()
    onChange(range.date_from ? range : {})
  }

  function applyCustom() {
    setActive('custom')
    onChange({ date_from: from, date_to: to })
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Calendar className="w-4 h-4 text-gray-400 dark:text-white/30" />
      <div className="flex items-center rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-0.5">
        {PRESETS.map((p) => (
          <button key={p.label}
            onClick={() => applyPreset(p, p.label)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
              active === p.label
                ? 'bg-white dark:bg-[#1a2235] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70',
            )}>
            {p.label}
          </button>
        ))}
        <button
          onClick={() => { setCustom(!custom); if (!custom) setActive('custom') }}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
            active === 'custom'
              ? 'bg-white dark:bg-[#1a2235] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70',
          )}>
          Custom
        </button>
      </div>
      {custom && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-700 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-gray-700 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={applyCustom}
            className="px-2 py-1 rounded-md text-xs font-semibold text-white bg-ct-navy hover:opacity-90 transition-opacity">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
