/**
 * CorridorHeatmap.tsx — Geographic heatmap of East African freight corridors.
 *
 * Renders country-level GeoJSON polygons coloured by shipment volume or risk,
 * with labels, tooltips, and interactive hover.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react'
import type { FeatureCollection } from 'geojson'
import apiClient from '@/api/client'

function countryColor(value: number, maxVal: number, mode: 'volume' | 'risk'): string {
  const ratio = Math.min(value / (maxVal || 1), 1)
  if (mode === 'volume') {
    // Blue (low) → Orange → Red (high)
    const r = Math.round(30 + 225 * ratio)
    const g = Math.round(120 - 60 * ratio)
    const b = Math.round(220 - 190 * ratio)
    return `rgb(${r},${g},${b})`
  }
  // Green (low risk) → Yellow → Red (high risk)
  const r = Math.round(30 + 225 * ratio)
  const g = Math.round(220 - 170 * ratio)
  const b = Math.round(50 - 20 * ratio)
  return `rgb(${r},${g},${b})`
}

function HeatmapLayer({ data, mode }: { data: FeatureCollection; mode: 'volume' | 'risk' }) {
  const map = useMap()

  useEffect(() => {
    if (!data || !data.features.length) return
    try {
      const oldLayer = (window as any).__heatmapLayer
      if (oldLayer) map.removeLayer(oldLayer)

      const maxVal = Math.max(
        ...data.features.map((f: any) =>
          mode === 'volume' ? (f.properties?.total_weight_kg ?? 0) : (f.properties?.risk_score ?? 0)
        ),
        1
      )

      const layer = (window as any).L.geoJSON(data, {
        style: (feature: any) => {
          const p = feature?.properties ?? {}
          const value = mode === 'volume' ? (p.total_weight_kg ?? 0) : (p.risk_score ?? 0)
          return {
            fillColor: countryColor(value, maxVal, mode),
            color: 'rgba(255,255,255,0.5)',
            weight: 1.5,
            fillOpacity: 0.75,
          }
        },
        onEachFeature: (feature: any, lyr: any) => {
          const p = feature.properties
          if (!p) return
          const kg = (p.total_weight_kg ?? 0).toLocaleString()
          const count = p.shipment_count ?? 0
          lyr.bindTooltip(
            `<div style="font-family:sans-serif;font-size:12px;line-height:1.4">` +
            `<strong style="font-size:13px">${p.country}</strong><br/>` +
            `Shipments: <strong>${count}</strong><br/>` +
            `Volume: <strong>${kg} kg</strong><br/>` +
            `Risk: <strong>${Math.round((p.risk_score ?? 0) * 100)}%</strong>` +
            `</div>`,
            { sticky: true, direction: 'top', offset: [0, -8] }
          )

          // Country label
          const [lat, lon] = p.centroid ?? [0, 0]
          const icon = (window as any).L.divIcon({
            className: 'country-label-icon',
            html: `<span style="font-size:11px;font-weight:700;color:#1e293b;text-shadow:0 1px 2px rgba(255,255,255,0.8);white-space:nowrap">${p.country}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          })
          ;(window as any).L.marker([lat, lon], { icon, interactive: false }).addTo(map)
        },
      })
      layer.addTo(map)
      ;(window as any).__heatmapLayer = layer

      const bounds = (window as any).L.geoJSON(data).getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })
    } catch { /* ignore map errors */ }
    return () => {
      const lyr = (window as any).__heatmapLayer
      if (lyr) map.removeLayer(lyr)
    }
  }, [data, mode, map])

  return null
}

export default function CorridorHeatmap() {
  const [data, setData] = useState<FeatureCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'volume' | 'risk'>('volume')

  useEffect(() => {
    apiClient.get<FeatureCollection>('/api/v1/analytics/heatmap/')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load heatmap data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (error) return <div className="flex items-center justify-center h-96 text-red-500 text-sm">{error}</div>

  const totalShipments = data?.features?.reduce((s: number, f: any) => s + (f.properties?.shipment_count ?? 0), 0) ?? 0
  const totalKg = data?.features?.reduce((s: number, f: any) => s + (f.properties?.total_weight_kg ?? 0), 0) ?? 0

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('volume')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'volume'
                ? 'bg-ct-navy text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}>
            <TrendingUp className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Volume
          </button>
          <button onClick={() => setMode('risk')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'risk'
                ? 'bg-ct-orange text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}>
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Risk
          </button>
        </div>
        <span className="text-xs text-gray-400">
          {totalShipments} shipments · {(totalKg / 1000).toFixed(1)}t across {data?.features?.length ?? 0} countries
        </span>
      </div>

      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden" style={{ height: 520 }}>
        <MapContainer
          center={[-2.5, 35]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {data && <HeatmapLayer data={data} mode={mode} />}
        </MapContainer>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        {mode === 'volume'
          ? 'Colour: Blue (low volume) → Orange → Red (high volume) · Hover for details'
          : 'Colour: Green (low risk) → Yellow → Red (high risk) · Hover for details'}
      </div>
    </motion.div>
  )
}
