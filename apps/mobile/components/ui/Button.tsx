import { TouchableOpacity, Text, ActivityIndicator, View, type ViewProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'

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
  style?: ViewProps['style']
}

const variantBg: Record<ButtonVariant, string> = {
  primary:   T.color.brand.primary,
  secondary: T.color.brand.accent,
  outline:   'transparent',
  ghost:     'transparent',
  danger:    T.color.ui.danger,
}

const variantBorder: Record<ButtonVariant, string | undefined> = {
  primary:   undefined,
  secondary: undefined,
  outline:   T.light.border.mid,
  ghost:     undefined,
  danger:    undefined,
}

const variantText: Record<ButtonVariant, string> = {
  primary:   '#FFFFFF',
  secondary: '#FFFFFF',
  outline:   T.light.text.primary,
  ghost:     T.color.brand.primary,
  danger:    '#FFFFFF',
}

const sizeHeight: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 }
const sizePadding: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 24 }
const sizeRadius: Record<ButtonSize, number> = { sm: T.radius.md, md: T.radius.md, lg: T.radius.lg }
const sizeText: Record<ButtonSize, number> = { sm: T.font.size.sm, md: T.font.size.base, lg: T.font.size.md }
const iconSize: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 }

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  onPress,
  style,
}: ButtonProps) {
  const { font } = useAppTheme()
  const isDisabled = disabled || loading
  const isOutlineOrGhost = variant === 'outline' || variant === 'ghost'
  const spinnerColor = isOutlineOrGhost ? T.color.brand.primary : '#fff'
  const textColor = isOutlineOrGhost ? (variant === 'ghost' ? T.color.brand.primary : T.light.text.primary) : '#fff'
  const iconColor = isOutlineOrGhost ? T.color.brand.primary : '#fff'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: variantBg[variant],
        borderColor: variantBorder[variant],
        borderWidth: variant === 'outline' ? 1.5 : 0,
        height: sizeHeight[size],
        paddingHorizontal: sizePadding[size],
        borderRadius: sizeRadius[size],
        opacity: isDisabled ? 0.5 : 1,
      }, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize[size]}
              color={iconColor}
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={{
            fontFamily: font.family.heading,
            fontWeight: font.weight.bold,
            color: textColor,
            fontSize: sizeText[size],
          }}>
            {children}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
