import { TouchableOpacity, View, type ViewProps } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'

interface CardProps {
  variant?: 'default' | 'gradient' | 'outlined'
  accentColor?: string
  accentPosition?: 'top' | 'left'
  onPress?: () => void
  style?: ViewProps['style']
  children: React.ReactNode
}

export default function Card({
  variant = 'default',
  accentColor,
  accentPosition = 'top',
  onPress,
  style,
  children,
}: CardProps) {
  const { colors, radius } = useAppTheme()
  const Container = onPress ? TouchableOpacity : View

  const accentBar = accentColor ? (
    <View
      style={{
        position: 'absolute',
        zIndex: 10,
        backgroundColor: accentColor,
        ...(accentPosition === 'top'
          ? { top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }
          : { top: 0, left: 0, bottom: 0, width: 3, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg }),
      }}
    />
  ) : null

  return (
    <Container
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[{
        position: 'relative',
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        ...(variant === 'outlined' && {
          borderWidth: 1,
          borderColor: colors.border,
        }),
        ...(variant === 'gradient' && { overflow: 'hidden' }),
      }, style]}
    >
      {(variant === 'gradient' || variant === 'default') && accentBar}
      {children}
    </Container>
  )
}
