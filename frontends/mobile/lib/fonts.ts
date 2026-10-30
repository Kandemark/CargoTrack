import * as Font from 'expo-font'

const SPACE_GROTESK = require('../assets/fonts/SpaceGrotesk-VariableFont_wght.ttf')
const DM_SANS = require('../assets/fonts/DMSans-VariableFont_opsz,wght.ttf')

let loaded = false

/**
 * Android cannot pick weights out of a variable font, so each weight is
 * also loaded as its own family (static instances generated from the
 * variable files). components/ui/Txt maps a weight to the right family;
 * text that names no family falls back to the phone's system font, which
 * differs from phone to phone.
 */
export const fontFamilies = {
  body: {
    regular: 'DMSans-Regular',
    medium: 'DMSans-Medium',
    semibold: 'DMSans-SemiBold',
    bold: 'DMSans-Bold',
  },
  heading: {
    semibold: 'SpaceGrotesk-SemiBold',
    bold: 'SpaceGrotesk-Bold',
  },
} as const

export async function loadFonts(): Promise<void> {
  if (loaded) return
  await Font.loadAsync({
    SpaceGrotesk: SPACE_GROTESK,
    DMSans: DM_SANS,
    'DMSans-Regular': require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('../assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold': require('../assets/fonts/DMSans-Bold.ttf'),
    'SpaceGrotesk-SemiBold': require('../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
    'SpaceGrotesk-Bold': require('../assets/fonts/SpaceGrotesk-Bold.ttf'),
  })
  loaded = true
}
