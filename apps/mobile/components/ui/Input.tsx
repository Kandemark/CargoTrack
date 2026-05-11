import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, type TextInputProps, type ViewProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'

interface InputProps extends TextInputProps {
  label?: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
  error?: string
  rightSlot?: React.ReactNode
  containerStyle?: ViewProps['style']
  inputBackground?: string
}

export default function Input({
  label,
  icon,
  error,
  rightSlot,
  containerStyle,
  inputBackground,
  secureTextEntry,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = secureTextEntry
  const { colors, font, radius, isDark } = useAppTheme()

  const placeholderColor = colors.textFaint
  const iconColor = focused ? (isDark ? T.color.brand.accent : T.color.brand.primary) : colors.textFaint
  const focusBorder = focused ? (isDark ? T.color.brand.accent : T.color.brand.primary) : undefined

  return (
    <View style={[{ width: '100%' }, containerStyle]}>
      {label && (
        <Text style={{
          fontSize: font.size.xs,
          fontFamily: font.family.heading,
          fontWeight: font.weight.bold,
          color: colors.textSecondary,
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}>
          {label}
        </Text>
      )}
      <View style={[{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.lg,
        backgroundColor: inputBackground ?? colors.muted,
        borderWidth: 1,
        borderColor: focusBorder ?? (error ? T.color.ui.danger : colors.border),
        height: 40,
        ...(error && { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2' }),
      }]}>
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={iconColor}
            style={{ marginLeft: 12 }}
          />
        )}
        <TextInput
          {...rest}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setFocused(true)
            rest.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            rest.onBlur?.(e)
          }}
          placeholderTextColor={placeholderColor}
          style={[{
            flex: 1,
            paddingHorizontal: 12,
            fontFamily: font.family.body,
            fontSize: font.size.base,
            color: colors.text,
            paddingLeft: icon ? undefined : 16,
            paddingRight: (isPassword || !!rightSlot) ? 0 : undefined,
          }, rest.style]}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={{ paddingHorizontal: 10, justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textFaint}
            />
          </TouchableOpacity>
        )}
        {rightSlot}
      </View>
      {error && (
        <Text style={{
          fontSize: font.size.xs,
          color: T.color.ui.danger,
          marginTop: 6,
          marginLeft: 4,
        }}>
          {error}
        </Text>
      )}
    </View>
  )
}
