/**
 * RoadRoute.tsx — Road-following route polyline using OSRM geometry.
 *
 * Renders the actual road path between origin and destination with a
 * prominent glow effect. Splits into completed (solid) and remaining
 * (dashed) portions based on shipment progress.
 *
 * Falls back to a styled straight line if OSRM is unavailable.
 */
import { useEffect, useState, useRef } from 'react'
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
  const mountedRef = useRef(true)

  const originPos = lookupCoords(origin)
  const destPos = lookupCoords(destination)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!originPos || !destPos) return
    let cancelled = false
    setLoaded(false)
    setGeometry(null)

    fetchRoadRoute(originPos, destPos).then((geo) => {
      if (!cancelled && mountedRef.current) { setGeometry(geo); setLoaded(true) }
    }).catch(() => {
      if (!cancelled && mountedRef.current) setLoaded(true) // signal fallback
    })
    return () => { cancelled = true }
  }, [origin, destination]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!originPos || !destPos) return null

  const color = statusColor(risk)
  const coords = geometry?.coordinates ?? [originPos, destPos]
  const distKm = geometry?.distanceKm
  const isRoadRoute = geometry && geometry.coordinates.length > 2

  // Split at progress point for road routes
  const totalPoints = coords.length
  const splitIdx = Math.floor(totalPoints * (progress / 100))
  const completed = coords.slice(0, Math.max(splitIdx + 1, 2))
  const remaining = coords.slice(splitIdx)

  const baseWeight = selected ? 5 : 3.5
  const glowWeight = baseWeight + 6

  return (
    <>
      {/* ── Glow layer (wider translucent stroke) ──────────────────── */}
      <Polyline positions={completed}
        pathOptions={{
          color, weight: glowWeight, opacity: 0.18,
        }}
      />
      {remaining.length > 1 && (
        <Polyline positions={remaining}
          pathOptions={{
            color: isRoadRoute ? '#94a3b8' : color,
            weight: glowWeight, opacity: 0.1,
          }}
        />
      )}

      {/* ── Completed portion — solid, bright ─────────────────────── */}
      <Polyline positions={completed}
        pathOptions={{
          color,
          weight: baseWeight,
          opacity: selected ? 0.95 : 0.75,
        }}
      >
        {distKm && (
          <Tooltip sticky direction="top">
            <span className="text-[10px] font-semibold text-gray-700">
              {isRoadRoute ? `${distKm} km via road` : '~ route preview'}
            </span>
          </Tooltip>
        )}
      </Polyline>

      {/* ── Remaining portion — dashed ────────────────────────────── */}
      {remaining.length > 1 && (
        <Polyline positions={remaining}
          pathOptions={{
            color: isRoadRoute ? '#94a3b8' : color,
            weight: selected ? 3.5 : 2.5,
            dashArray: isRoadRoute ? '10 6' : '6 6',
            opacity: selected ? 0.5 : 0.35,
          }}
        />
      )}

      {/* Origin & Destination dots */}
      <Polyline positions={[originPos, originPos]}
        pathOptions={{ color: '#22c55e', weight: 7, opacity: 0.9 }}
      />
      <Polyline positions={[destPos, destPos]}
        pathOptions={{ color: '#f5801e', weight: 7, opacity: 0.9 }}
      />
    </>
  )
}
