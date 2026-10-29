import { Text, type TextProps, type TextStyle } from 'react-native'
import { fontFamilies } from '@/lib/fonts'
import { useAppTheme } from '@/lib/useAppTheme'

/**
 * The app's one text component. Every variant names its font file
 * explicitly, so text never falls back to the phone's system font (which
 * differs between phones, and on some is a handwriting style).
 *
 * Headings use Space Grotesk, everything else DM Sans, at the sizes the
 * sign-in screen uses.
 */
type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'number'
type Tone = 'primary' | 'secondary' | 'muted' | 'faint' | 'inverse' | 'brand' | 'accent' | 'danger' | 'success' | 'warning'

const variants: Record<Variant, TextStyle> = {
  display:    { fontFamily: fontFamilies.heading.bold,     fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  title:      { fontFamily: fontFamilies.heading.bold,     fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  heading:    { fontFamily: fontFamilies.heading.semibold, fontSize: 17, lineHeight: 22 },
  body:       { fontFamily: fontFamilies.body.regular,     fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamilies.body.semibold,    fontSize: 15, lineHeight: 21 },
  caption:    { fontFamily: fontFamilies.body.regular,     fontSize: 13, lineHeight: 18 },
  label:      { fontFamily: fontFamilies.body.bold,        fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  number:     { fontFamily: fontFamilies.heading.bold,     fontSize: 26, lineHeight: 30, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
}

export default function Txt({
  variant = 'body',
  tone = 'primary',
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors, brand, ui, status } = useAppTheme()
  const color = {
    primary: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    faint: colors.textFaint,
    inverse: '#FFFFFF',
    brand: colors.textBrand,
    accent: brand.accent,
    danger: ui.danger,
    success: status.delivered,
    warning: status.customs,
  }[tone]
  return <Text {...props} style={[variants[variant], { color }, style]} />
}
