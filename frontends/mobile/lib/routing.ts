/**
 * OSRM-based road-following routing for the CargoTrack map.
 * Calls the public OSRM demo server to get actual road geometries
 * instead of drawing straight lines between cities.
 */

const OSRM_BASE = 'https://router.project-osrm.org'

interface OSRMRouteResponse {
  code: string
  routes: Array<{
    distance: number
    duration: number
    geometry: { coordinates: [number, number][] }
  }>
}

// In-memory cache to avoid OSRM rate-limiting
const routeCache = new Map<string, { coords: [number, number][]; ts: number }>()
const CACHE_TTL = 30 * 60_000 // 30 minutes

function cacheKey(from: [number, number], to: [number, number]): string {
  return `${from[0].toFixed(4)},${from[1].toFixed(4)}-${to[0].toFixed(4)},${to[1].toFixed(4)}`
}

/**
 * Fetch a road-following route between two coordinates.
 * Falls back to a straight line if OSRM is unreachable.
 */
export async function fetchRoadRoute(
  from: [number, number],
  to: [number, number],
): Promise<GeoJSON.LineString> {
  const key = cacheKey(from, to)

  // Check cache
  const cached = routeCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { type: 'LineString', coordinates: cached.coords }
  }

  try {
    const url = `${OSRM_BASE}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`OSRM returned ${res.status}`)

    const data: OSRMRouteResponse = await res.json()
    if (data.code !== 'Ok' || !data.routes.length) {
      throw new Error('OSRM no route')
    }

    const coords = data.routes[0].geometry.coordinates
    routeCache.set(key, { coords, ts: Date.now() })

    return { type: 'LineString', coordinates: coords }
  } catch {
    // Fallback: straight line between the two points
    return { type: 'LineString', coordinates: [from, to] }
  }
}

/**
 * Batch-fetch routes for multiple origin→destination pairs.
 * Returns a GeoJSON FeatureCollection with road-following LineStrings.
 */
export async function fetchRoutes(
  pairs: Array<{ id: string; from: [number, number]; to: [number, number] }>,
): Promise<GeoJSON.FeatureCollection> {
  const results = await Promise.allSettled(
    pairs.map(async ({ id, from, to }) => {
      const geometry = await fetchRoadRoute(from, to)
      return {
        type: 'Feature' as const,
        id,
        geometry,
        properties: { id },
      }
    }),
  )

  return {
    type: 'FeatureCollection',
    features: results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value),
  }
}
