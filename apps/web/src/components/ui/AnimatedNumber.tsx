import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  active?: boolean
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

export function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [val, setVal] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) return
    const start = Date.now()
    ref.current = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed >= duration) {
        setVal(target)
        if (ref.current) clearInterval(ref.current)
        return
      }
      const ease = 1 - Math.pow(1 - elapsed / duration, 3)
      setVal(Math.round(ease * target))
    }, 16)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [target, active, duration])

  return val
}

export default function AnimatedNumber({
  value,
  active = true,
  duration = 1100,
  prefix,
  suffix,
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const displayed = useCountUp(value, active, duration)

  const formatted = decimals > 0
    ? displayed.toFixed(decimals)
    : displayed.toLocaleString()

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
