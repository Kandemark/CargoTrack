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
import { CITY_COORDS, lookupCoords } from '@/lib/coords'

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
