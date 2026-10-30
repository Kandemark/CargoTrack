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

function resolveBorder(variant: ButtonVariant, isDark: boolean): string | undefined {
  const mode = isDark ? T.dark : T.light
  const map: Record<ButtonVariant, string | undefined> = {
    primary:   undefined,
    secondary: undefined,
    outline:   mode.border.mid,
    ghost:     undefined,
    danger:    undefined,
  }
  return map[variant]
}

function resolveText(variant: ButtonVariant, isDark: boolean): string {
  const mode = isDark ? T.dark : T.light
  const map: Record<ButtonVariant, string> = {
    primary:   '#FFFFFF',
    secondary: '#FFFFFF',
    outline:   mode.text.primary,
    ghost:     isDark ? mode.text.primary : T.color.brand.primary,
    danger:    '#FFFFFF',
  }
  return map[variant]
}

function resolveAccent(isDark: boolean): string {
  return isDark ? T.dark.text.primary : T.color.brand.primary
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
  const { font, isDark } = useAppTheme()
  const isDisabled = disabled || loading
  const isOutlineOrGhost = variant === 'outline' || variant === 'ghost'
  const accentColor = resolveAccent(isDark)
  const spinnerColor = isOutlineOrGhost ? accentColor : '#fff'
  const textColor = isOutlineOrGhost ? resolveText(variant, isDark) : '#fff'
  const iconColor = isOutlineOrGhost ? accentColor : '#fff'

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
        borderColor: resolveBorder(variant, isDark),
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
            // The family is already the bold file; adding a weight makes Android fall back to the system font.
            fontFamily: font.family.heading,
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
