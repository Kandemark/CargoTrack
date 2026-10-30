import type { ComponentProps, ReactNode } from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/** What a list says when it has nothing to show, and what to do next. */
export default function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: ComponentProps<typeof Ionicons>['name']
  title: string
  body?: string
  action?: ReactNode
}) {
  const { colors } = useAppTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16, gap: 10 }}>
      <Ionicons name={icon} size={36} color={colors.textFaint} />
      <Txt variant="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      {body ? <Txt variant="body" tone="muted" style={{ textAlign: 'center' }}>{body}</Txt> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  )
}
