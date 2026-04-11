/**
 * LiveMap.tsx — Full-height react-leaflet map of active shipments.
 * - Custom SVG markers coloured by status
 * - Dashed polylines per IN_TRANSIT shipment (animated dash)
 * - Corridor reference overlays: Northern + Central
 * - Left sidebar: searchable/filterable shipment list
 * - Top-right: refresh, fullscreen, carrier filter
 * - Auto-refresh every 30s
 */
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Search, RefreshCw, Maximize2, X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import type { ShipmentListItem, ShipmentStatus } from '@/types'

// Fix default Leaflet icon URLs broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── East Africa coordinate table ─────────────────────────────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  'Mombasa':       [-4.0435,  39.6682],
  'Nairobi':       [-1.2921,  36.8219],
  'Kampala':       [ 0.3476,  32.5825],
  'Kigali':        [-1.9441,  30.0619],
  'Dar es Salaam': [-6.7924,  39.2083],
  'Kisumu':        [-0.1022,  34.7617],
  'Eldoret':       [ 0.5143,  35.2698],
  'Bujumbura':     [-3.3731,  29.3644],
  'Juba':          [ 4.8594,  31.5713],
  'Dodoma':        [-6.1731,  35.7395],
}

function lookupCoords(city: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

const FALLBACK: [number, number] = [-1.2921, 36.8219]

// ── Corridor polylines ────────────────────────────────────────────────────────

const CORRIDORS: { name: string; coords: [number, number][] }[] = [
  {
    name: 'Northern Corridor',
    coords: [CITY_COORDS['Mombasa'], CITY_COORDS['Nairobi'], CITY_COORDS['Kampala'], CITY_COORDS['Kigali']],
  },
  {
    name: 'Central Corridor',
    coords: [CITY_COORDS['Dar es Salaam'], CITY_COORDS['Dodoma'], CITY_COORDS['Kigali'], CITY_COORDS['Bujumbura']],
  },
]

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLOR: Partial<Record<ShipmentStatus, string>> = {
  IN_TRANSIT: '#3b82f6',
  CUSTOMS:    '#f59e0b',
  DELAYED:    '#ef4444',
  PENDING:    '#94a3b8',
  DELIVERED:  '#22c55e',
}
const STATUS_LABEL: Partial<Record<ShipmentStatus, string>> = {
  IN_TRANSIT: 'In Transit',
  CUSTOMS:    'At Customs',
  DELAYED:    'Delayed',
  PENDING:    'Pending',
  DELIVERED:  'Delivered',
}

function svgMarker(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    html: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="${color}" fill-opacity="0.25" />
      <circle cx="14" cy="14" r="6" fill="${color}" />
      <circle cx="14" cy="14" r="3" fill="white" />
    </svg>`,
  })
}

// ── Enriched shipment ─────────────────────────────────────────────────────────

interface MappedShipment extends ShipmentListItem {
  pos: [number, number]
  originPos: [number, number] | null
  destPos: [number, number] | null
}

// ── PanTo helper component ────────────────────────────────────────────────────

function PanToMarker({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 8, { duration: 0.8 })
  }, [target, map])
  return null
}

// ── Filter keys ───────────────────────────────────────────────────────────────

type FilterKey = 'ALL' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELAYED'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All'        },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'CUSTOMS',    label: 'Customs'    },
  { key: 'DELAYED',    label: 'Delayed'    },
]

// ── Main component ────────────────────────────────────────────────────────────

const INITIAL_CENTER: [number, number] = [-1.5, 35.0]
const INITIAL_ZOOM = 6

export default function LiveMap() {
  const [shipments,  setShipments]  = useState<MappedShipment[]>([])
  const [filter,     setFilter]     = useState<FilterKey>('ALL')
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [panTo,      setPanTo]      = useState<[number, number] | null>(null)
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL')
  const [fullscreen, setFullscreen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [trRes, cuRes, dlRes, peRes] = await Promise.all([
        shipmentsApi.getShipments({ status: 'IN_TRANSIT', page_size: 100 }),
        shipmentsApi.getShipments({ status: 'CUSTOMS',    page_size: 50  }),
        shipmentsApi.getShipments({ status: 'DELAYED',    page_size: 50  }),
        shipmentsApi.getShipments({ status: 'PENDING',    page_size: 50  }),
      ])
      const all: ShipmentListItem[] = [
        ...trRes.data.results,
        ...cuRes.data.results,
        ...dlRes.data.results,
        ...peRes.data.results,
      ]
      const enriched: MappedShipment[] = all.map((s) => {
        const originPos = lookupCoords(s.route.origin)
        const destPos   = lookupCoords(s.route.destination)
        const pos = originPos && destPos
          ? [
              (originPos[0] + destPos[0]) / 2,
              (originPos[1] + destPos[1]) / 2,
            ] as [number, number]
          : (originPos ?? destPos ?? FALLBACK)
        return { ...s, pos, originPos, destPos }
      })
      setShipments(enriched)
    } catch {
      setError('Failed to load map data.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + 30s auto-refresh
  useEffect(() => {
    void load()
    intervalRef.current = setInterval(load, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  const carriers = ['ALL', ...Array.from(new Set(shipments.map((s) => s.carrier_name))).sort()]

  const visible = shipments.filter((s) => {
    if (filter !== 'ALL' && s.status !== filter) return false
    if (carrierFilter !== 'ALL' && s.carrier_name !== carrierFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return s.tracking_number.toLowerCase().includes(q) || s.carrier_name.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className={cn(
      'flex gap-0 overflow-hidden rounded-xl border border-gray-200 dark:border-white/8 shadow-elevated',
      fullscreen ? 'fixed inset-4 z-50' : 'h-[calc(100vh-8rem)]',
    )}>

      {/* ── Left sidebar ────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col bg-white dark:bg-[#1a2235] border-r border-gray-100 dark:border-white/8 overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/8">
          <p className="text-sm font-semibold text-gray-800 dark:text-white font-heading">Active Shipments</p>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{visible.length} on map</p>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracking # or carrier…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-700 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Status filter pills */}
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn('px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
                filter === f.key ? 'bg-ct-navy text-white' : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/15')}
            >{f.label}</button>
          ))}
        </div>

        {/* Shipment list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
          <AnimatePresence initial={false}>
            {visible.map((s) => {
              const color = STATUS_COLOR[s.status] ?? '#94a3b8'
              const pct = Math.round(s.delay_risk_score * 100)
              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  layout
                  onClick={() => setPanTo(s.pos)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-white font-mono truncate">{s.tracking_number}</p>
                    <p className="text-xs text-gray-400 dark:text-white/30 truncate mt-0.5">{s.route.origin} → {s.route.destination}</p>
                  </div>
                  <div className="text-xs font-semibold tabular-nums" style={{ color: pct >= 70 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e' }}>
                    {pct}%
                  </div>
                </motion.button>
              )
            })}
          </AnimatePresence>
          {visible.length === 0 && !loading && (
            <p className="px-4 py-8 text-center text-xs text-gray-400 dark:text-white/30">No shipments match filters.</p>
          )}
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">

        {/* Top-right controls */}
        <div className="absolute top-3 right-3 z-[400] flex gap-2">
          {/* Carrier filter */}
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="pl-7 pr-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-white/20 bg-white dark:bg-[#1a2235] text-gray-700 dark:text-white shadow-card focus:outline-none"
            >
              {carriers.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All Carriers' : c}</option>)}
            </select>
          </div>
          <button onClick={() => void load()} title="Refresh"
            className="p-2 rounded-lg bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/20 text-gray-500 dark:text-white/60 hover:text-gray-800 dark:hover:text-white shadow-card transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => setFullscreen((v) => !v)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="p-2 rounded-lg bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/20 text-gray-500 dark:text-white/60 hover:text-gray-800 dark:hover:text-white shadow-card transition-colors">
            {fullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-[400] bg-gray-50">
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">{error}</p>
              <button onClick={() => void load()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--ct-navy)' }}>
                Retry
              </button>
            </div>
          </div>
        )}

        <MapContainer
          center={INITIAL_CENTER}
          zoom={INITIAL_ZOOM}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Pan helper */}
          <PanToMarker target={panTo} />

          {/* Corridor overlays */}
          {CORRIDORS.map((corridor) => (
            <Polyline
              key={corridor.name}
              positions={corridor.coords}
              pathOptions={{ color: '#94a3b8', weight: 1.5, dashArray: '8 6', opacity: 0.5 }}
            >
              <Popup><span className="text-xs font-medium">{corridor.name}</span></Popup>
            </Polyline>
          ))}

          {/* Route lines for IN_TRANSIT */}
          {visible
            .filter((s) => s.status === 'IN_TRANSIT' && s.originPos && s.destPos)
            .map((s) => {
              const pct = s.delay_risk_score
              const color = pct >= 0.7 ? '#ef4444' : pct >= 0.4 ? '#f59e0b' : '#3b82f6'
              return (
                <Polyline
                  key={`route-${s.id}`}
                  positions={[s.originPos!, s.destPos!]}
                  pathOptions={{ color, weight: 2, dashArray: '10 8', opacity: 0.7 }}
                />
              )
            })}

          {/* Markers */}
          {visible.map((s) => {
            const color = STATUS_COLOR[s.status] ?? '#94a3b8'
            return (
              <Marker key={s.id} position={s.pos} icon={svgMarker(color)}>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[180px]">
                    <p className="font-bold text-sm font-mono">{s.tracking_number}</p>
                    <p className="text-gray-500">{s.carrier_name}</p>
                    <p className="text-gray-500">{s.route.origin} → {s.route.destination}</p>
                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: `${color}22`, color }}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <p className="text-gray-500">Risk: <strong>{Math.round(s.delay_risk_score * 100)}%</strong></p>
                    <Link to={`/ops/shipments/${s.id}`} className="block mt-1.5 text-blue-600 hover:underline font-medium">
                      View full detail →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
