import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import { dashboardApi } from '@/api/dashboard'

interface Dot { lat: number; lng: number; status: string }

const STATUS_COLORS: Record<string, string> = {
  IN_TRANSIT: '#3b82f6',
  CUSTOMS: '#a855f7',
  DELAYED: '#ef4444',
  PENDING: '#6b7280',
}

export default function MiniLiveMap() {
  const [dots, setDots] = useState<Dot[]>([])

  useEffect(() => {
    dashboardApi.getPublicStats()
      .then(({ data }) => { if (data.map_dots) setDots(data.map_dots) })
      .catch(() => {})
  }, [])

  return (
    <div className="relative w-full h-64 md:h-72 rounded-2xl overflow-hidden border border-white/10">
      <MapContainer
        center={[-1.5, 36]}
        zoom={5}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {dots.map((d, i) => (
          <CircleMarker
            key={i}
            center={[d.lat, d.lng]}
            radius={4}
            pathOptions={{
              fillColor: STATUS_COLORS[d.status] || '#6b7280',
              fillOpacity: 0.8,
              color: 'rgba(255,255,255,0.3)',
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
              <span className="text-xs">{d.status.replace('_', ' ')}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute bottom-3 left-3 text-xs text-white/40 bg-black/40 px-2 py-0.5 rounded">
        Live active shipments
      </div>
    </div>
  )
}
