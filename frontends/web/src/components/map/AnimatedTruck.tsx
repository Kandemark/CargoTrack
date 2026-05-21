/**
 * AnimatedTruck.tsx — Truck marker that animates along a road-following route.
 *
 * Uses smooth CSS transitions to slide the marker between positions. When
 * route geometry is available, the truck follows actual road waypoints.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Marker } from 'react-leaflet'
import { interpolateAlongRoute, type RouteGeometry } from '@/lib/routing'
import { buildTruckMarkerSVG } from '@/components/map/TruckMarker'

interface Props {
  position: [number, number]          // current GPS position (lat, lng)
  bearing: number                      // heading in degrees
  status: string
  risk: number
  selected: boolean
  route?: RouteGeometry | null         // road-following route geometry
  progress: number                     // 0-100
  onClick: () => void
}

export default function AnimatedTruck({
  position, bearing, status, risk, selected, route, progress, onClick,
}: Props) {
  // Smooth position transitions
  const [smoothPos, setSmoothPos] = useState(position)
  const prevPos = useRef(position)
  const frameRef = useRef<number>()

  useEffect(() => {
    const from = prevPos.current
    const to = position
    const duration = 2000 // 2s smooth transition
    const start = performance.now()

    function animate(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const ease = 1 - (1 - t) ** 3
      setSmoothPos([
        from[0] + (to[0] - from[0]) * ease,
        from[1] + (to[1] - from[1]) * ease,
      ])
      if (t < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    prevPos.current = to

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [position[0], position[1]])

  // Snap the truck to the road route at the correct progress point
  const roadPosition = useMemo(() => {
    if (route && route.coordinates.length > 2) {
      return interpolateAlongRoute(route.coordinates, progress / 100)
    }
    return smoothPos
  }, [route, progress, smoothPos])

  const icon = useMemo(() => L.divIcon({
    className: '',
    iconSize: [selected ? 42 : 34, selected ? 42 : 34],
    iconAnchor: [selected ? 21 : 17, selected ? 21 : 17],
    popupAnchor: [0, -(selected ? 21 : 17) - 4],
    html: buildTruckMarkerSVG({
      status, risk, bearing, selected, size: selected ? 42 : 34,
    }),
  }), [status, risk, bearing, selected])

  return (
    <Marker
      position={roadPosition}
      icon={icon}
      eventHandlers={{ click: onClick }}
    />
  )
}
