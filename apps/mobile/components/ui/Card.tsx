import { TouchableOpacity, View } from 'react-native'
import { cn } from '@/lib/utils'

interface CardProps {
  variant?: 'default' | 'gradient' | 'outlined'
  accentColor?: string
  accentPosition?: 'top' | 'left'
  onPress?: () => void
  className?: string
  children: React.ReactNode
}

export default function Card({
  variant = 'default',
  accentColor,
  accentPosition = 'top',
  onPress,
  className,
  children,
}: CardProps) {
  const Container = onPress ? TouchableOpacity : View

  const accentBar = accentColor ? (
    <View
      className={cn(
        'absolute z-10',
        accentPosition === 'top'
          ? 'top-0 left-0 right-0 h-[3px] rounded-t-ct-lg'
          : 'top-0 left-0 bottom-0 w-[3px] rounded-l-ct-lg',
      )}
      style={{ backgroundColor: accentColor }}
    />
  ) : null

  return (
    <Container
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      className={cn(
        'relative bg-ct-surface-card dark:bg-ct-dark-card rounded-ct-lg',
        'shadow-sm shadow-black/5',
        variant === 'outlined' && 'border border-ct-border-light dark:border-ct-dark-border',
        variant === 'gradient' && 'overflow-hidden',
        className,
      )}
      style={{
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {variant === 'gradient' && accentBar}
      {variant === 'default' && accentBar}
      {children}
    </Container>
  )
}
