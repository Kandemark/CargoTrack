/** Small geometry helpers for drawing trucks on road paths ([lng, lat] points). */

export type LngLat = [number, number]

/** Great-circle distance in kilometres. */
export function km(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** Index of the path point closest to `p`. */
export function nearestIndex(path: LngLat[], p: LngLat): number {
  let best = 0
  let bestD = Infinity
  path.forEach((q, i) => {
    const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

/** Length of the path up to point `upTo` (inclusive), in kilometres. */
export function lengthKm(path: LngLat[], upTo = path.length - 1): number {
  let total = 0
  for (let i = 1; i <= upTo && i < path.length; i++) total += km(path[i - 1], path[i])
  return total
}

/**
 * Where a known place sits on a road path: the nearest road point, and how
 * far along the road it is (0 to 1). Puts the truck on the road, not
 * floating between two towns.
 */
export function snapToPath(path: LngLat[], p: LngLat): { point: LngLat; progress: number } {
  const i = nearestIndex(path, p)
  const total = lengthKm(path)
  return { point: path[i], progress: total > 0 ? lengthKm(path, i) / total : 0 }
}
