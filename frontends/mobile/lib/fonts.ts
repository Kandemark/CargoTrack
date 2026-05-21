import * as Font from 'expo-font'

const SPACE_GROTESK = require('../assets/fonts/SpaceGrotesk-VariableFont_wght.ttf')
const DM_SANS = require('../assets/fonts/DMSans-VariableFont_opsz,wght.ttf')

let loaded = false

export async function loadFonts(): Promise<void> {
  if (loaded) return
  await Font.loadAsync({
    SpaceGrotesk: SPACE_GROTESK,
    DMSans: DM_SANS,
  })
  loaded = true
}
