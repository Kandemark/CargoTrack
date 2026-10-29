import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/**
 * A titled block on the sheet. The label matches the sign-in form's field
 * labels; the optional action reads like its "Create one" link. No box,
 * border or shadow: space separates sections.
 */
export default function Section({
  label,
  action,
  onAction,
  children,
}: {
  label: string
  action?: string
  onAction?: () => void
  children: ReactNode
}) {
  const { isDark, brand } = useAppTheme()
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Txt variant="label" tone="faint" style={{ flex: 1 }}>
          {label}
        </Txt>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
            <Txt variant="bodyStrong" style={{ color: isDark ? brand.accent : brand.primary }}>
              {action}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}
