import { View, TouchableOpacity } from 'react-native'
import { BlurView } from 'expo-blur'
import { useThemeStore } from '@/lib/themeStore'
import { cn } from '@/lib/utils'

type GlassVariant = 'default' | 'elevated' | 'subtle'

interface GlassCardProps {
  variant?: GlassVariant
  accentColor?: string
  accentPosition?: 'top' | 'left'
  children: React.ReactNode
  className?: string
  onPress?: () => void
}

const INTENSITY: Record<GlassVariant, number> = { default: 80, elevated: 60, subtle: 40 }

export default function GlassCard({
  variant = 'default',
  accentColor,
  accentPosition = 'top',
  children,
  className,
  onPress,
}: GlassCardProps) {
  const resolved = useThemeStore((s) => s.resolved)
  const tint = resolved === 'dark' ? 'dark' : 'light'

  const content = (
    <View
      className={cn(
        'overflow-hidden rounded-ct-xl border border-white/[0.08]',
        variant === 'elevated' && 'shadow-lg shadow-black/20',
        className,
      )}
    >
      <BlurView intensity={INTENSITY[variant]} tint={tint}>
        <View className={cn(
          'bg-ct-dark-card/85',
          resolved === 'light' && 'bg-white/85',
        )}>
          {accentColor && accentPosition === 'top' && (
            <View className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />
          )}
          {accentColor && accentPosition === 'left' && (
            <View className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} />
          )}
          {children}
        </View>
      </BlurView>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="active:scale-[0.98]">
        {content}
      </TouchableOpacity>
    )
  }

  return content
}
