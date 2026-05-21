/**
 * ClusterMarker.tsx — Simple grid-based clustering for zoomed-out views.
 *
 * Groups nearby markers into cells when zoom < 8, showing a count badge.
 * Clicking a cluster zooms to fit its children.
 */
import { useMemo } from 'react'
import { Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { ShipmentListItem } from '@/types'

interface ClusteredPoint {
  pos: [number, number]
  shipments: (ShipmentListItem & { pos: [number, number] })[]
}

interface Props {
  shipments: (ShipmentListItem & { pos: [number, number] })[]
  zoom: number
  clusterThreshold?: number
}

function buildClusterIcon(count: number): L.DivIcon {
  const size = Math.min(28 + count * 2, 56)
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:linear-gradient(135deg,#0f2d5e,#1e3a5f);
      border:2px solid rgba(249,115,22,0.6);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 12px rgba(0,0,0,0.5);
      color:white;font-size:${Math.min(11 + count * 0.1, 14)}px;
      font-weight:700;font-family:monospace;
      backdrop-filter:blur(8px);
    ">${count}</div>`,
  })
}

export default function ClusterMarker({ shipments, zoom, clusterThreshold = 8 }: Props) {
  const map = useMap()

  const clusters = useMemo((): ClusteredPoint[] => {
    if (zoom >= clusterThreshold || shipments.length < 4) return []

    // Grid size in degrees — larger at lower zoom
    const cellSize = 3.0 / Math.pow(2, zoom - 4)

    const grid: Record<string, (typeof shipments)[0][]> = {}
    for (const s of shipments) {
      const row = Math.floor(s.pos[0] / cellSize)
      const col = Math.floor(s.pos[1] / cellSize)
      const key = `${row},${col}`
      grid[key] = grid[key] || []
      grid[key].push(s)
    }

    return Object.entries(grid)
      .filter(([_, group]) => group.length >= 2)
      .map(([_, group]) => {
        const avgLat = group.reduce((s, x) => s + x.pos[0], 0) / group.length
        const avgLng = group.reduce((s, x) => s + x.pos[1], 0) / group.length
        return { pos: [avgLat, avgLng] as [number, number], shipments: group }
      })
  }, [shipments, zoom, clusterThreshold])

  function fitCluster(cluster: ClusteredPoint) {
    const lats = cluster.shipments.map(s => s.pos[0])
    const lngs = cluster.shipments.map(s => s.pos[1])
    map.fitBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ], { padding: [40, 40], maxZoom: 10 })
  }

  return (
    <>
      {clusters.map((c, i) => (
        <Marker key={`cluster-${i}`} position={c.pos}
          icon={buildClusterIcon(c.shipments.length)}
          eventHandlers={{ click: () => fitCluster(c) }}
        />
      ))}
    </>
  )
}
