/**
 * Shadow presets — React Native shadow props.
 * Web consumes individual values and maps them to box-shadow / drop-shadow via Tailwind.
 */

export const card = {
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowOffset: { width: 0 as const, height: 1 as const },
  shadowRadius: 4,
  elevation: 2,
} as const

export const sheet = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowOffset: { width: 0 as const, height: -3 as const },
  shadowRadius: 10,
  elevation: 10,
} as const

export const fab = {
  shadowColor: '#f5801e',
  shadowOpacity: 0.45,
  shadowRadius: 12,
  elevation: 8,
} as const
