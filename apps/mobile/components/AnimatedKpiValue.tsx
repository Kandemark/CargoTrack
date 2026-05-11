import { useEffect, useState, useRef } from 'react'
import { Text, type TextProps } from 'react-native'

interface Props {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  style?: TextProps['style']
}

/** Animated count-up using cubic ease-out matching the web frontend.
 *  Uses tabular-nums for stable width during animation. */
export default function AnimatedKpiValue({
  value,
  duration = 1100,
  prefix = '',
  suffix = '',
  decimals = 0,
  style,
}: Props) {
  const [display, setDisplay] = useState(() => value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = value
    const start = Date.now()
    let raf: number

    function tick() {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </Text>
  )
}
