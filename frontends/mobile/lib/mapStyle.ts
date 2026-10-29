/**
 * Base maps from OpenFreeMap: free, no API key, commercial use allowed.
 * Maps that use them must keep the OpenStreetMap attribution visible.
 */
export const MAP_STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

export function mapStyleFor(isDark: boolean): string {
  return isDark ? MAP_STYLE.dark : MAP_STYLE.light
}
