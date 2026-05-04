import { Check } from 'lucide-react'

interface Step {
  number: number
  label: string
}

const STEPS: Step[] = [
  { number: 1, label: 'Account' },
  { number: 2, label: 'Role & Org' },
  { number: 3, label: 'Profile' },
]

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isActive = step.number === current
        const isDone = step.number < current

        return (
          <div key={step.number} className="flex items-center gap-2">
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                isActive
                  ? 'bg-[#0f2d5e] text-white'
                  : isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-400',
              ].join(' ')}
            >
              {isDone ? <Check className="w-4 h-4" /> : step.number}
            </div>
            <span
              className={[
                'text-sm font-medium hidden sm:inline',
                isActive ? 'text-[#0f2d5e]' : isDone ? 'text-emerald-600' : 'text-gray-400',
              ].join(' ')}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'w-8 sm:w-12 h-0.5',
                  step.number < current ? 'bg-emerald-500' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
