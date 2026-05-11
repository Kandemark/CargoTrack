import { Text, type TextProps } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'

interface SectionLabelProps {
  label: string
  style?: TextProps['style']
}

export default function SectionLabel({ label, style }: SectionLabelProps) {
  const { font, colors } = useAppTheme()

  return (
    <Text
      style={[{
        fontSize: font.size.xs,
        color: colors.textFaint,
        fontFamily: 'SpaceGrotesk',
        fontWeight: font.weight.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
      }, style]}
    >
      {label}
    </Text>
  )
}
