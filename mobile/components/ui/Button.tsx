import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  children: string
  onPress?: () => void
  className?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-ct-navy dark:bg-ct-orange',
  secondary:
    'bg-ct-orange',
  outline:
    'bg-transparent border border-ct-border-mid dark:border-ct-dark-border',
  ghost:
    'bg-transparent',
  danger:
    'bg-ct-danger',
}

const variantTextClasses: Record<ButtonVariant, string> = {
  primary:
    'text-white',
  secondary:
    'text-white',
  outline:
    'text-ct-text-primary dark:text-ct-dark-text',
  ghost:
    'text-ct-navy dark:text-ct-dark-text',
  danger:
    'text-white',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 rounded-ct-md',
  md: 'h-11 px-5 rounded-ct-md',
  lg: 'h-[52px] px-6 rounded-ct-lg',
}

const textSizeClasses: Record<ButtonSize, string> = {
  sm: 'text-ct-sm',
  md: 'text-ct-base',
  lg: 'text-ct-md',
}

const iconSize: Record<ButtonSize, number> = {
  sm: 16,
  md: 18,
  lg: 20,
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  onPress,
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={cn(
        'flex-row items-center justify-center',
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#0f2d5e' : '#fff'}
        />
      ) : (
        <View className="flex-row items-center">
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize[size]}
              color={variant === 'outline' || variant === 'ghost' ? '#0f2d5e' : '#fff'}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            className={cn(
              'font-heading font-bold',
              variantTextClasses[variant],
              textSizeClasses[size],
            )}
          >
            {children}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
