/**
 * routing.ts — OSRM-based road-following route engine.
 *
 * Fetches actual road geometry from OSRM so truck routes follow real roads
 * instead of straight lines. Falls back to great-circle lines when OSRM is
 * unavailable.
 *
 * OSRM public demo server: https://router.project-osrm.org
 * Rate limits apply — we cache routes indefinitely.
 */

const OSRM_BASE = 'https://router.project-osrm.org'

interface OSRMResponse {
  code: string
  routes: Array<{
    distance: number
    duration: number
    geometry: { coordinates: [number, number][] }
    legs: Array<{
      distance: number
      duration: number
      steps: Array<{ name: string; distance: number; duration: number }>
    }>
  }>
}

export interface RouteGeometry {
  coordinates: [number, number][]   // [lat, lng] for Leaflet
  distanceKm: number
  durationMin: number
}

// In-memory cache — persists for session lifetime
const routeCache = new Map<string, RouteGeometry>()

function cacheKey(from: [number, number], to: [number, number]): string {
  return `${from[0].toFixed(4)},${from[1].toFixed(4)}_${to[0].toFixed(4)},${to[1].toFixed(4)}`
}

/**
 * Fetch road-following route from OSRM.
 * Coordinates are [lat, lng] — OSRM expects [lng, lat].
 */
export async function fetchRoadRoute(
  from: [number, number],
  to: [number, number],
): Promise<RouteGeometry | null> {
  const key = cacheKey(from, to)
  const cached = routeCache.get(key)
  if (cached) return cached

  try {
    // OSRM expects lng,lat
    const url = `${OSRM_BASE}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    const data: OSRMResponse = await resp.json()
    if (data.code !== 'Ok' || !data.routes.length) return null

    const route = data.routes[0]
    // Convert [lng, lat] → [lat, lng]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng],
    )

    const result: RouteGeometry = {
      coordinates,
      distanceKm: Math.round(route.distance / 100) / 10,
      durationMin: Math.round(route.duration / 6) / 10,
    }
    routeCache.set(key, result)
    return result
  } catch {
    return null
  }
}

/**
 * Returns a position along a route geometry at a given fraction (0–1).
 * Uses linear interpolation between waypoints.
 */
export function interpolateAlongRoute(
  coords: [number, number][],
  fraction: number,
): [number, number] {
  if (coords.length === 0) return [0, 0]
  if (coords.length === 1 || fraction <= 0) return coords[0]
  if (fraction >= 1) return coords[coords.length - 1]

  // Compute cumulative distances
  const segments: number[] = []
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const d = haversineKm(coords[i - 1], coords[i])
    segments.push(d)
    total += d
  }

  const target = total * fraction
  let accumulated = 0
  for (let i = 0; i < segments.length; i++) {
    if (accumulated + segments[i] >= target) {
      const segFrac = (target - accumulated) / segments[i]
      const [a, b] = [coords[i], coords[i + 1]]
      return [
        a[0] + (b[0] - a[0]) * segFrac,
        a[1] + (b[1] - a[1]) * segFrac,
      ]
    }
    accumulated += segments[i]
  }

  return coords[coords.length - 1]
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const [lat1, lng1] = [a[0] * Math.PI / 180, a[1] * Math.PI / 180]
  const [lat2, lng2] = [b[0] * Math.PI / 180, b[1] * Math.PI / 180]
  const dlat = lat2 - lat1
  const dlng = lng2 - lng1
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Preload routes for a batch of origin-destination pairs. */
export async function preloadRoutes(
  pairs: Array<{ from: [number, number]; to: [number, number] }>,
): Promise<void> {
  await Promise.allSettled(pairs.map(({ from, to }) => fetchRoadRoute(from, to)))
}
