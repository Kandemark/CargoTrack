/**
 * ClusterMarker.tsx — Simple grid-based clustering for zoomed-out views.
 *
 * Groups nearby markers into cells when zoom < 8, showing a count badge.
 * Clicking a cluster zooms to fit its children.
 *
 * Accepts objects with a ``gpsPos: [lat, lng]`` property (matching MapEntity).
 */
import { useMemo } from 'react'
import { Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

interface Clusterable {
  gpsPos: [number, number]
}

interface ClusteredPoint<T extends Clusterable> {
  pos: [number, number]
  items: T[]
}

interface Props<T extends Clusterable> {
  items: T[]
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
      background:#ffffff;
      border:2px solid #f5801e;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 12px rgba(0,0,0,0.15);
      color:#1e293b;font-size:${Math.min(11 + count * 0.1, 14)}px;
      font-weight:700;font-family:monospace;
    ">${count}</div>`,
  })
}

export default function ClusterMarker<T extends Clusterable>({ items, zoom, clusterThreshold = 8 }: Props<T>) {
  const map = useMap()

  const clusters = useMemo((): ClusteredPoint<T>[] => {
    if (zoom >= clusterThreshold || items.length < 4) return []

    const cellSize = 3.0 / Math.pow(2, zoom - 4)

    const grid: Record<string, T[]> = {}
    for (const item of items) {
      const row = Math.floor(item.gpsPos[0] / cellSize)
      const col = Math.floor(item.gpsPos[1] / cellSize)
      const key = `${row},${col}`
      grid[key] = grid[key] || []
      grid[key].push(item)
    }

    return Object.entries(grid)
      .filter(([, group]) => group.length >= 2)
      .map(([, group]) => {
        const avgLat = group.reduce((s, x) => s + x.gpsPos[0], 0) / group.length
        const avgLng = group.reduce((s, x) => s + x.gpsPos[1], 0) / group.length
        return { pos: [avgLat, avgLng] as [number, number], items: group }
      })
  }, [items, zoom, clusterThreshold])

  function fitCluster(cluster: ClusteredPoint<T>) {
    const lats = cluster.items.map(s => s.gpsPos[0])
    const lngs = cluster.items.map(s => s.gpsPos[1])
    map.fitBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ], { padding: [40, 40], maxZoom: 10 })
  }

  return (
    <>
      {clusters.map((c, i) => (
        <Marker key={`cluster-${i}`} position={c.pos}
          icon={buildClusterIcon(c.items.length)}
          eventHandlers={{ click: () => fitCluster(c) }}
        />
      ))}
    </>
  )
}
