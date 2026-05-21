/**
 * RoadRoute.tsx — Road-following route polyline using OSRM geometry.
 *
 * Renders the actual road path between origin and destination as a
 * smooth polyline on the map. Splits into completed (solid) and
 * remaining (dashed) portions based on shipment progress.
 */
import { useEffect, useState } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'
import { fetchRoadRoute, type RouteGeometry } from '@/lib/routing'
import { lookupCoords } from '@/lib/coords'

function statusColor(risk: number): string {
  if (risk >= 0.7) return '#ef4444'
  if (risk >= 0.4) return '#f59e0b'
  return '#3b82f6'
}

interface Props {
  origin: string
  destination: string
  risk: number
  progress: number         // 0-100
  selected: boolean
}

export default function RoadRoute({ origin, destination, risk, progress, selected }: Props) {
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null)
  const [loaded, setLoaded] = useState(false)

  const originPos = lookupCoords(origin)
  const destPos = lookupCoords(destination)

  useEffect(() => {
    if (!originPos || !destPos) return
    let cancelled = false
    fetchRoadRoute(originPos, destPos).then((geo) => {
      if (!cancelled) { setGeometry(geo); setLoaded(true) }
    })
    return () => { cancelled = true }
  }, [origin, destination])

  if (!originPos || !destPos) return null

  // While loading, show a faint straight line
  if (!loaded) {
    return (
      <Polyline positions={[originPos, destPos]}
        pathOptions={{
          color: statusColor(risk),
          weight: 1.5,
          opacity: 0.2,
          dashArray: '4 8',
        }}
      />
    )
  }

  // If OSRM failed, render straight line with curved style
  const coords = geometry?.coordinates ?? [originPos, destPos]
  const distKm = geometry?.distanceKm

  // Split at progress point
  const totalPoints = coords.length
  const splitIdx = Math.floor(totalPoints * (progress / 100))

  const completed = coords.slice(0, Math.max(splitIdx + 1, 2))
  const remaining = coords.slice(splitIdx)

  const color = statusColor(risk)

  return (
    <>
      {/* Completed — solid, bright */}
      <Polyline positions={completed}
        pathOptions={{
          color,
          weight: selected ? 4 : 2.5,
          opacity: selected ? 0.9 : 0.6,
        }}
      >
        {distKm && (
          <Tooltip sticky direction="top">
            <span className="text-[10px] font-semibold text-gray-700">{distKm} km via road</span>
          </Tooltip>
        )}
      </Polyline>

      {/* Remaining — dashed, dimmed */}
      {remaining.length > 1 && (
        <Polyline positions={remaining}
          pathOptions={{
            color: selected ? color : '#94a3b8',
            weight: selected ? 3 : 2,
            dashArray: '8 6',
            opacity: selected ? 0.5 : 0.3,
          }}
        />
      )}

      {/* Origin & Destination dots */}
      <Polyline positions={[originPos, originPos]}
        pathOptions={{ color: '#22c55e', weight: 6, opacity: 0.9 }}
      />
      <Polyline positions={[destPos, destPos]}
        pathOptions={{ color: '#f5801e', weight: 6, opacity: 0.9 }}
      />
    </>
  )
}
