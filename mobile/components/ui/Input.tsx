import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Appearance } from 'react-native'
import type { TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/lib/utils'

interface InputProps extends TextInputProps {
  label?: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
  error?: string
  rightSlot?: React.ReactNode
}

export default function Input({
  label,
  icon,
  error,
  rightSlot,
  className,
  secureTextEntry,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = secureTextEntry
  const isDark = Appearance.getColorScheme() === 'dark'

  const placeholderColor = isDark ? '#64748b' : '#9ca3af'

  const iconColor = focused
    ? (isDark ? '#f5801e' : '#0f2d5e')
    : (isDark ? '#64748b' : '#9ca3af')

  return (
    <View className="w-full">
      {label && (
        <Text className="text-ct-xs font-heading font-bold text-ct-text-secondary dark:text-slate-300 mb-1.5 uppercase tracking-wider">
          {label}
        </Text>
      )}
      <View
        className={cn(
          'flex-row items-center rounded-ct-lg bg-white dark:bg-slate-800',
          'border-[1.5px]',
          focused
            ? 'border-ct-navy dark:border-ct-orange'
            : error
              ? 'border-red-400 dark:border-red-500'
              : 'border-slate-200 dark:border-slate-700',
          'min-h-[52px]',
          error && 'bg-red-50 dark:bg-red-900/10',
          className,
        )}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={iconColor}
            style={{ marginLeft: 14 }}
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
          className={cn(
            'flex-1 py-3.5 px-3 font-body text-ct-base text-ct-text-primary dark:text-white',
            !icon && 'pl-4',
            (isPassword || !!rightSlot) && 'pr-0',
          )}
          style={{ minHeight: 48 }}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            className="px-3 h-full justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={isDark ? '#64748b' : '#9ca3af'}
            />
          </TouchableOpacity>
        )}
        {rightSlot}
      </View>
      {error && (
        <Text className="text-ct-xs text-red-600 dark:text-red-400 mt-1.5 ml-1">{error}</Text>
      )}
    </View>
  )
}
