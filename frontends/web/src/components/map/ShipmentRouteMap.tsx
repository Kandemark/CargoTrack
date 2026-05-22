/**
 * ShipmentRouteMap.tsx — Focused mini-map for a single shipment's route.
 *
 * Shows the origin → destination route on a compact Leaflet map that
 * auto-fits the route bounds. Uses the same light Voyager tiles as LiveMap.
 */
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { lookupCoords } from '@/lib/coords'
import { fetchRoadRoute, type RouteGeometry } from '@/lib/routing'

// ── Fix Leaflet default icon ──────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const ORIGIN_ICON = L.divIcon({
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
})

const DEST_ICON = L.divIcon({
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#f5801e;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
})

interface Props {
  origin: string
  destination: string
  status: string
}

function statusColor(status: string): string {
  switch (status) {
    case 'IN_TRANSIT': return '#3b82f6'
    case 'CUSTOMS':    return '#f59e0b'
    case 'DELAYED':    return '#ef4444'
    case 'DELIVERED':  return '#22c55e'
    default:           return '#94a3b8'
  }
}

function FitRoute({ originPos, destPos }: { originPos: [number, number]; destPos: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds([originPos, destPos], { padding: [40, 40], maxZoom: 10 })
  }, [map, originPos, destPos])
  return null
}

export default function ShipmentRouteMap({ origin, destination, status }: Props) {
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null)

  const originPos = lookupCoords(origin)
  const destPos = lookupCoords(destination)

  useEffect(() => {
    if (!originPos || !destPos) return
    let cancelled = false
    fetchRoadRoute(originPos, destPos).then((geo) => {
      if (!cancelled) setGeometry(geo)
    })
    return () => { cancelled = true }
  }, [origin, destination]) // eslint-disable-line react-hooks/exhaustive-deps

  const routeCoords = useMemo(() => {
    if (geometry?.coordinates?.length) return geometry.coordinates
    if (originPos && destPos) return [originPos, destPos]
    return null
  }, [geometry, originPos, destPos])

  const center = useMemo((): [number, number] => {
    if (originPos && destPos) {
      return [(originPos[0] + destPos[0]) / 2, (originPos[1] + destPos[1]) / 2]
    }
    return originPos ?? destPos ?? [-1.5, 36.5]
  }, [originPos, destPos])

  if (!originPos && !destPos) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-xs text-slate-400">No coordinates available for this route.</p>
      </div>
    )
  }

  const color = statusColor(status)

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      dragging={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      {originPos && destPos && <FitRoute originPos={originPos} destPos={destPos} />}

      {/* Route line */}
      {routeCoords && routeCoords.length > 1 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color,
            weight: 3,
            opacity: 0.7,
            dashArray: status === 'PENDING' ? '6 4' : undefined,
          }}
        >
          {geometry?.distanceKm && (
            <Popup>
              <span className="text-xs font-semibold">{geometry.distanceKm} km via road</span>
            </Popup>
          )}
        </Polyline>
      )}

      {/* Origin marker */}
      {originPos && (
        <Marker position={originPos} icon={ORIGIN_ICON}>
          <Popup><span className="text-xs font-semibold">{origin}</span></Popup>
        </Marker>
      )}

      {/* Destination marker */}
      {destPos && (
        <Marker position={destPos} icon={DEST_ICON}>
          <Popup><span className="text-xs font-semibold">{destination}</span></Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
