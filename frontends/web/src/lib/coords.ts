/**
 * coords.ts — Shared East African city coordinates and corridor definitions.
 *
 * Single source of truth for map coordinates used across LiveMap, RoutePolyline,
 * and the landing page's HeroMap.
 */

// ── East Africa city coordinates ────────────────────────────────────────────
export const CITY_COORDS: Record<string, [number, number]> = {
  Mombasa:         [-4.0435,  39.6682],
  Nairobi:         [-1.2921,  36.8219],
  Kampala:         [ 0.3476,  32.5825],
  Kigali:          [-1.9441,  30.0619],
  'Dar es Salaam': [-6.7924,  39.2083],
  Kisumu:          [-0.1022,  34.7617],
  Eldoret:         [ 0.5143,  35.2698],
  Bujumbura:       [-3.3731,  29.3644],
  Juba:            [ 4.8594,  31.5713],
  Dodoma:          [-6.1731,  35.7395],
  Nakuru:          [-0.3031,  36.0800],
  Thika:           [-1.0332,  37.0693],
  Garissa:         [-0.4532,  39.6461],
  Nyeri:           [-0.4218,  36.9479],
  Malindi:         [-3.2175,  40.1169],
  Voi:             [-3.3969,  38.5565],
  Machakos:        [-1.5177,  37.2634],
  Kericho:         [-0.3687,  35.2863],
  Kakamega:        [ 0.2827,  34.7519],
  Taveta:          [-3.3961,  37.6761],
  Kajiado:         [-1.8521,  36.7756],
  Embu:            [-0.5303,  37.4501],
  Lamu:            [-2.2694,  40.9022],
  Nanyuki:         [ 0.0072,  37.0741],
  Kwale:           [-4.1740,  39.4526],
}

export function lookupCoords(city: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

// ── Map defaults ────────────────────────────────────────────────────────────
export const EAST_AFRICA_CENTER: [number, number] = [-1.5, 36.5]
export const MAP_DEFAULT_ZOOM = 6

// ── Trade corridors ─────────────────────────────────────────────────────────
export interface Corridor {
  name: string
  color: string
  coords: [number, number][]
}

export const CORRIDORS: Corridor[] = [
  {
    name: 'Northern Corridor',
    color: '#f5801e',
    coords: [CITY_COORDS.Mombasa, CITY_COORDS.Nairobi, CITY_COORDS.Nakuru, CITY_COORDS.Eldoret, CITY_COORDS.Kampala, CITY_COORDS.Kigali],
  },
  {
    name: 'Central Corridor',
    color: '#60a5fa',
    coords: [CITY_COORDS['Dar es Salaam'], CITY_COORDS.Dodoma, CITY_COORDS.Kigali, CITY_COORDS.Bujumbura],
  },
  {
    name: 'LAPSSET',
    color: '#34d399',
    coords: [CITY_COORDS.Lamu, CITY_COORDS.Garissa, CITY_COORDS.Juba],
  },
]

// ── Status color map ────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  IN_TRANSIT: '#3b82f6',
  CUSTOMS:    '#f59e0b',
  DELAYED:    '#ef4444',
  DELIVERED:  '#22c55e',
  PENDING:    '#94a3b8',
}
