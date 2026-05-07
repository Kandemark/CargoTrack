/**
 * RoutePolyline.tsx — Progress-based route line rendering.
 *
 * Splits the route into two segments:
 *  - Completed portion (origin → current position): solid, status color
 *  - Remaining portion (current position → destination): dashed, dimmed
 *
 * Uses turf.js to calculate the split point along the great-circle path.
 */
import { Polyline } from 'react-leaflet'
import { along, lineString } from '@turf/turf'
import type { ShipmentListItem } from '@/types'

// ── City coords (mirrors LiveMap) ───────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
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

function lookupCoords(city: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

function riskColor(score: number): string {
  if (score >= 0.7) return '#ef4444'
  if (score >= 0.4) return '#f59e0b'
  return '#22c55e'
}

interface Props {
  shipment: ShipmentListItem & { progress: number }
  selected: boolean
}

export default function RoutePolyline({ shipment, selected }: Props) {
  const originPos = lookupCoords(shipment.route.origin)
  const destPos = lookupCoords(shipment.route.destination)
  if (!originPos || !destPos) return null

  const routeColor = riskColor(shipment.delay_risk_score)
  const progress = shipment.progress / 100

  // Build the full line, then split at progress point
  let completedPositions: [number, number][] = []
  let remainingPositions: [number, number][] = []

  try {
    // Turf expects [lng, lat] format
    const line = lineString([
      [originPos[1], originPos[0]],
      [destPos[1], destPos[0]],
    ])

    const totalDist = 100 // use normalized distance
    const splitDist = totalDist * progress

    const mid = along(line, splitDist, { units: 'kilometers' })
    if (mid && mid.geometry) {
      const [mlng, mlat] = mid.geometry.coordinates
      completedPositions = [originPos, [mlat, mlng]]
      remainingPositions = [[mlat, mlng], destPos]
    } else {
      completedPositions = [originPos, destPos]
    }
  } catch {
    completedPositions = [originPos, destPos]
    remainingPositions = []
  }

  return (
    <>
      {/* Completed portion */}
      <Polyline positions={completedPositions}
        pathOptions={{
          color: routeColor,
          weight: selected ? 4 : 2.5,
          opacity: selected ? 0.9 : 0.55,
        }}
      />
      {/* Remaining portion (if any) */}
      {remainingPositions.length > 1 && (
        <Polyline positions={remainingPositions}
          pathOptions={{
            color: '#94a3b8',
            weight: selected ? 3 : 2,
            dashArray: '6 6',
            opacity: selected ? 0.45 : 0.25,
          }}
        />
      )}
    </>
  )
}
