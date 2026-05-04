/**
 * LiveMap.tsx — Uber-style real-time shipment tracking map.
 *
 * Features:
 *  - Animated truck markers with direction arrows and status glow
 *  - Progress-based route lines (completed= solid, remaining= dashed)
 *  - Uber-style floating DriverInfoCard on marker click (live ETA countdown)
 *  - Cluster markers at low zoom levels
 *  - Trade corridor overlays (Northern, Central, LAPSSET)
 *  - Filter panel with glassmorphism styling
 *  - "Fit All" zoom-to-bounds
 *  - 60-second auto-refresh
 */
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Search, RefreshCw, X, Filter, Layers, Package, AlertTriangle,
  Clock, CheckCircle2, ChevronRight, Activity, Truck, Navigation,
  ArrowRight, TrendingUp, Minimize2, Maximize2, MapPin, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { shipmentsApi } from '@/api/shipments'
import type { ShipmentListItem } from '@/types'
import { buildTruckMarkerSVG } from '@/components/map/TruckMarker'
import DriverInfoCard from '@/components/map/DriverInfoCard'
import RoutePolyline from '@/components/map/RoutePolyline'
import ClusterMarker from '@/components/map/ClusterMarker'

// ── Fix Leaflet default icon ──────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── East Africa city coordinates ──────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  Mombasa:         [-4.0435,  39.6682],
  Nairobi:         [-1.2921,  36.8219],
  Kampala:         [ 0.3476,  32.5825],
  Kigali:          [-1.9441,  30.0619],
  'Dar es Salaam': [-6.7924,  39.2083],
  Kisumu:          [-0.1022,  34.7617],
  Eldoret:         [ 0.5143,  35.2698],
  Bujumbura:       [-3.3731,  29.3644],
  Juba:            [ 4.8594,  31.5713],
  Dodoma:          [-6.1731,  35.7395],
  Nakuru:          [-0.3031,  36.0800],
  Thika:           [-1.0332,  37.0693],
  Garissa:         [-0.4532,  39.6461],
  Nyeri:           [-0.4218,  36.9479],
  Malindi:         [-3.2175,  40.1169],
  Voi:             [-3.3969,  38.5565],
  Machakos:        [-1.5177,  37.2634],
  Kericho:         [-0.3687,  35.2863],
  Kakamega:        [ 0.2827,  34.7519],
  Taveta:          [-3.3961,  37.6761],
  Kajiado:         [-1.8521,  36.7756],
  Embu:            [-0.5303,  37.4501],
  Lamu:            [-2.2694,  40.9022],
  Nanyuki:         [ 0.0072,  37.0741],
  Kwale:           [-4.1740,  39.4526],
}

function lookupCoords(city: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

function bearingDeg(from: [number, number], to: [number, number]): number {
  const lat1 = (from[0] * Math.PI) / 180
  const lat2 = (to[0] * Math.PI) / 180
  const dLon = ((to[1] - from[1]) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function simProgress(trackingNum: string, status: string): number {
  if (status === 'PENDING') return 0
  if (status === 'DELIVERED') return 100
  let hash = 0
  for (const ch of trackingNum) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  const base = (Math.abs(hash) % 60) + 15
  if (status === 'CUSTOMS') return Math.min(base + 18, 88)
  if (status === 'DELAYED') return Math.min(base + 5, 78)
  return base
}

function fmtETA(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'Overdue'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 1) return `${days}d ${hours}h`
  if (days === 1) return `1d ${hours}h`
  if (hours > 0) return `${hours}h ${Math.floor((diff % 3_600_000) / 60_000)}m`
  return 'Arriving soon'
}

const MAP_CENTER: [number, number] = [-1.5, 36.5]
const MAP_ZOOM = 6
const FALLBACK: [number, number] = MAP_CENTER

// ── Trade corridors ───────────────────────────────────────────────────────────
const CORRIDORS = [
  { name: 'Northern Corridor', color: '#f97316', coords: [CITY_COORDS.Mombasa, CITY_COORDS.Nairobi, CITY_COORDS.Nakuru, CITY_COORDS.Eldoret, CITY_COORDS.Kampala, CITY_COORDS.Kigali] },
  { name: 'Central Corridor',  color: '#60a5fa', coords: [CITY_COORDS['Dar es Salaam'], CITY_COORDS.Dodoma, CITY_COORDS.Kigali, CITY_COORDS.Bujumbura] },
  { name: 'LAPSSET',           color: '#34d399', coords: [CITY_COORDS.Lamu, CITY_COORDS.Garissa, CITY_COORDS.Juba] },
]

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  IN_TRANSIT: { color: '#3b82f6', label: 'In Transit',  icon: Activity      },
  CUSTOMS:    { color: '#f59e0b', label: 'At Customs',  icon: Clock         },
  DELAYED:    { color: '#ef4444', label: 'Delayed',     icon: AlertTriangle },
  PENDING:    { color: '#94a3b8', label: 'Pending',     icon: Package       },
  DELIVERED:  { color: '#22c55e', label: 'Delivered',   icon: CheckCircle2  },
}

function riskColor(score: number): string {
  if (score >= 0.7) return '#ef4444'
  if (score >= 0.4) return '#f59e0b'
  return '#22c55e'
}

// ── Enriched shipment type ────────────────────────────────────────────────────
interface MappedShipment extends ShipmentListItem {
  pos:       [number, number]
  originPos: [number, number] | null
  destPos:   [number, number] | null
  bearing:   number
  progress:  number
}

// ── PanTo helper ──────────────────────────────────────────────────────────────
function PanToMarker({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 9, { duration: 1.0, easeLinearity: 0.25 })
  }, [target, map])
  return null
}

// ── FitAll helper ─────────────────────────────────────────────────────────────
function FitAllButton({ shipments }: { shipments: MappedShipment[] }) {
  const map = useMap()
  function fitAll() {
    if (shipments.length === 0) return
    const lats = shipments.map(s => s.pos[0])
    const lngs = shipments.map(s => s.pos[1])
    map.fitBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ], { padding: [50, 50], maxZoom: 10 })
  }
  return (
    <button onClick={fitAll}
      className="p-2 rounded-xl bg-[#0a1929]/90 border border-white/10 text-white/60 hover:text-white shadow-lg backdrop-blur-md transition-colors"
      title="Fit all shipments">
      <Maximize2 className="w-4 h-4" />
    </button>
  )
}

// ── Zoom watcher for clusters ────────────────────────────────────────────────
function useZoom(): number {
  const [zoom, setZoom] = useState(MAP_ZOOM)
  useMapEvents({
    zoomend: (e) => setZoom((e.target as L.Map).getZoom()),
    load:    (e) => setZoom((e.target as L.Map).getZoom()),
  } as Parameters<typeof useMapEvents>[0])
  return zoom
}

// ── Filter options ────────────────────────────────────────────────────────────
type FilterKey = 'ALL' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELAYED' | 'PENDING'
const FILTER_OPTS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All'        },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELAYED',    label: 'Delayed'    },
  { key: 'CUSTOMS',    label: 'Customs'    },
  { key: 'PENDING',    label: 'Pending'    },
]

// ── Live dot ──────────────────────────────────────────────────────────────────
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  )
}

// ── MapContent (child of MapContainer) ─────────────────────────────────────────
function MapContent({
  shipments, visible, showCorridors, selectedId, panTo, onSelect, clusterZoom, loading,
}: {
  shipments: MappedShipment[]
  visible: MappedShipment[]
  showCorridors: boolean
  selectedId: number | null
  panTo: [number, number] | null
  onSelect: (s: MappedShipment) => void
  clusterZoom: number
  loading: boolean
}) {
  const selected = shipments.find(s => s.id === selectedId) ?? null

  return (
    <>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <PanToMarker target={panTo} />
      <FitAllButton shipments={visible} />

      {/* Trade corridor overlays */}
      {showCorridors && CORRIDORS.map((c) => (
        <Polyline key={c.name} positions={c.coords}
          pathOptions={{ color: c.color, weight: 2, dashArray: '10 6', opacity: 0.4 }}>
          <Popup><div className="text-xs font-bold">{c.name}</div></Popup>
        </Polyline>
      ))}

      {/* Progress-based route lines */}
      {visible.filter(s => ['IN_TRANSIT', 'DELAYED'].includes(s.status) && s.originPos && s.destPos).map(s => (
        <RoutePolyline key={`route-${s.id}`} shipment={s} selected={selectedId === s.id} />
      ))}

      {/* Risk hotspot halos */}
      {visible.filter(s => s.delay_risk_score >= 0.7).map(s => (
        <Circle key={`risk-${s.id}`} center={s.pos} radius={48000}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.06, weight: 1, opacity: 0.25 }}
        />
      ))}

      {/* Cluster markers for zoomed-out view */}
      <ClusterMarker shipments={visible} zoom={clusterZoom} />

      {/* Truck markers (hide when clustered) */}
      {clusterZoom >= 8 && visible.map(s => (
        <Marker key={s.id} position={s.pos}
          icon={L.divIcon({
            className: '',
            iconSize: [selectedId === s.id ? 42 : 34, selectedId === s.id ? 42 : 34],
            iconAnchor: [selectedId === s.id ? 21 : 17, selectedId === s.id ? 21 : 17],
            popupAnchor: [0, -(selectedId === s.id ? 21 : 17) - 4],
            html: buildTruckMarkerSVG({
              status: s.status, risk: s.delay_risk_score, bearing: s.bearing,
              selected: selectedId === s.id, size: selectedId === s.id ? 42 : 34,
            }),
          })}
          eventHandlers={{ click: () => onSelect(s) }}
        >
          <Popup>
            <div className="min-w-[200px] font-sans">
              <div className="px-3 py-2 -mx-3 -mt-2 mb-2 rounded-t" style={{ background: STATUS_CFG[s.status]?.color ?? '#94a3b8' }}>
                <p className="text-white text-xs font-bold font-mono">{s.tracking_number}</p>
                <p className="text-white/70 text-[10px] mt-0.5">{STATUS_CFG[s.status]?.label ?? s.status}</p>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Route</span>
                  <span className="font-medium text-gray-700">{s.route.origin} → {s.route.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Carrier</span>
                  <span className="font-medium text-gray-700">{s.carrier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk</span>
                  <span className="font-bold" style={{ color: riskColor(s.delay_risk_score) }}>{Math.round(s.delay_risk_score * 100)}%</span>
                </div>
              </div>
              <Link to={`/ops/shipments/${s.id}`} className="mt-2 flex items-center gap-1 text-xs font-semibold text-orange-500 hover:underline">
                Full detail <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveMap() {
  const [shipments,     setShipments]     = useState<MappedShipment[]>([])
  const [filter,        setFilter]        = useState<FilterKey>('ALL')
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [panTo,         setPanTo]         = useState<[number, number] | null>(null)
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL')
  const [fullscreen,    setFullscreen]    = useState(false)
  const [showCorridors, setShowCorridors] = useState(true)
  const [selectedId,    setSelectedId]    = useState<number | null>(null)
  const [panelOpen,     setPanelOpen]     = useState(true)
  const [clusterZoom,   setClusterZoom]   = useState(MAP_ZOOM)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await shipmentsApi.getShipments({ page_size: 250 })
      const all: ShipmentListItem[] = (res.data.results ?? []).filter(s => s.status !== 'DELIVERED')
      const enriched: MappedShipment[] = all.map(s => {
        const originPos = lookupCoords(s.route.origin)
        const destPos   = lookupCoords(s.route.destination)
        const pos: [number, number] = originPos && destPos
          ? [(originPos[0] + destPos[0]) / 2, (originPos[1] + destPos[1]) / 2]
          : (originPos ?? destPos ?? FALLBACK)
        const bearing = originPos && destPos ? bearingDeg(originPos, destPos) : 0
        const progress = simProgress(s.tracking_number, s.status)
        return { ...s, pos, originPos, destPos, bearing, progress }
      })
      setShipments(enriched)
    } catch {
      setError('Failed to load shipment data.')
    } finally {
      setLoading(false)
    }
  }, [])

  const initialLoadedRef = useRef(false)
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true
      void load()
    }
    intervalRef.current = setInterval(load, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  const carriers = ['ALL', ...Array.from(new Set(shipments.map(s => s.carrier_name))).sort()]

  const visible = shipments.filter(s => {
    if (filter !== 'ALL' && s.status !== filter) return false
    if (carrierFilter !== 'ALL' && s.carrier_name !== carrierFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        s.tracking_number.toLowerCase().includes(q) ||
        s.carrier_name.toLowerCase().includes(q) ||
        s.route.origin.toLowerCase().includes(q) ||
        s.route.destination.toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = {
    total:      shipments.length,
    in_transit: shipments.filter(s => s.status === 'IN_TRANSIT').length,
    delayed:    shipments.filter(s => s.status === 'DELAYED').length,
    at_customs: shipments.filter(s => s.status === 'CUSTOMS').length,
    high_risk:  shipments.filter(s => s.delay_risk_score >= 0.7).length,
  }

  const selected = shipments.find(s => s.id === selectedId) ?? null

  function handleSelect(s: MappedShipment) {
    setSelectedId(s.id)
    setPanTo(s.pos)
  }

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl shadow-2xl border border-white/5',
      fullscreen ? 'fixed inset-3 z-50' : 'h-[calc(100vh-7rem)]',
    )}>

      {/* ── Full-area Leaflet map ──────────────────────────────────────────── */}
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={true}
      >
        <MapContent
          shipments={shipments}
          visible={visible}
          showCorridors={showCorridors}
          selectedId={selectedId}
          panTo={panTo}
          onSelect={handleSelect}
          clusterZoom={clusterZoom}
          loading={loading}
        />
      </MapContainer>

      {/* ── Uber-style DriverInfoCard ──────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[600]">
            <DriverInfoCard
              shipment={selected}
              onClose={() => setSelectedId(null)}
              onNavigate={() => setPanTo(selected.pos)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Top-right controls ─────────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
        <button onClick={() => setShowCorridors(v => !v)}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-lg backdrop-blur-md border',
            showCorridors ? 'bg-[#0a1929]/95 border-orange-500/40 text-orange-400' : 'bg-[#0a1929]/80 border-white/10 text-white/50 hover:text-white/80')}>
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Corridors</span>
        </button>
        <button onClick={() => void load()} title="Refresh"
          className="p-2 rounded-xl bg-[#0a1929]/90 border border-white/10 text-white/60 hover:text-white shadow-lg backdrop-blur-md transition-colors">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setFullscreen(v => !v)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="p-2 rounded-xl bg-[#0a1929]/90 border border-white/10 text-white/60 hover:text-white shadow-lg backdrop-blur-md transition-colors">
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Toggle panel button ────────────────────────────────────────────── */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className="absolute top-3 left-3 z-[500] p-2 rounded-xl bg-[#0a1929]/90 border border-white/10 text-white/60 hover:text-white shadow-lg backdrop-blur-md transition-colors"
        title={panelOpen ? 'Hide panel' : 'Show panel'}>
        {panelOpen ? <X className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
      </button>

      {/* ── High-risk badge ────────────────────────────────────────────────── */}
      {counts.high_risk > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={cn('absolute z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-600/90 backdrop-blur-sm border border-red-500/40 shadow-lg top-3 left-14')}>
          <AlertTriangle className="w-3.5 h-3.5 text-white" />
          <span className="text-xs font-bold text-white">{counts.high_risk} high-risk</span>
        </motion.div>
      )}

      {/* ── Floating left panel (glassmorphism) ────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-14 left-3 bottom-3 z-[450] w-[300px] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'rgba(10,25,41,0.93)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Panel header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LiveDot />
                  <p className="text-white font-bold text-sm tracking-tight">Live Tracking</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {loading && <div className="w-3.5 h-3.5 border-2 border-orange-400/60 border-t-orange-400 rounded-full animate-spin" />}
                  <span className="text-white/30 text-[10px]">{visible.length}/{counts.total}</span>
                </div>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[
                  { label: 'Transit', value: counts.in_transit, color: '#3b82f6' },
                  { label: 'Delayed', value: counts.delayed,    color: '#ef4444' },
                  { label: 'Customs', value: counts.at_customs, color: '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <button key={label} onClick={() => setFilter(label === 'Transit' ? 'IN_TRANSIT' : label === 'Delayed' ? 'DELAYED' : 'CUSTOMS')}
                    className="rounded-xl px-2 py-2 text-center transition-opacity hover:opacity-80 active:scale-95"
                    style={{ background: `${color}1a` }}>
                    <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
                    <p className="text-[9px] text-white/35 uppercase tracking-wide mt-0.5">{label}</p>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tracking #, carrier, city…"
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-white/6 border border-white/8 text-xs text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500/30 transition-colors" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex gap-1 flex-wrap">
                {FILTER_OPTS.map(({ key, label }) => {
                  const color = STATUS_CFG[key]?.color
                  return (
                    <button key={key} onClick={() => setFilter(key)}
                      className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all',
                        filter === key ? 'text-white shadow-sm' : 'bg-white/6 text-white/40 hover:bg-white/10 hover:text-white/70')}
                      style={filter === key ? { background: color ?? 'var(--ct-navy)' } : {}}>
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Carrier filter */}
              {carriers.length > 2 && (
                <div className="relative mt-2">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  <select value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/6 border border-white/8 text-[11px] text-white/70 focus:outline-none focus:ring-1 focus:ring-orange-500/40">
                    {carriers.map(c => (
                      <option key={c} value={c} className="bg-[#0a1929]">
                        {c === 'ALL' ? 'All Carriers' : c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Shipment list */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence initial={false}>
                {visible.map((s, i) => {
                  const cfg   = STATUS_CFG[s.status]
                  const color = cfg?.color ?? '#94a3b8'
                  const rc    = riskColor(s.delay_risk_score)
                  const isSelected = selectedId === s.id
                  const eta = fmtETA(s.scheduled_arrival)
                  return (
                    <motion.button key={s.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }} layout
                      onClick={() => handleSelect(s)}
                      className={cn('w-full px-4 py-3 text-left transition-all border-b border-white/4',
                        isSelected ? 'bg-white/10 border-l-2' : 'hover:bg-white/5')}
                      style={isSelected ? { borderLeftColor: color } : {}}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}20` }}>
                          <Truck className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-white/90 font-mono truncate">{s.tracking_number}</p>
                            <span className="text-[10px] font-bold tabular-nums ml-2 shrink-0" style={{ color: rc }}>
                              {Math.round(s.delay_risk_score * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-white/40">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{s.route.origin}</span>
                            <ArrowRight className="w-2.5 h-2.5 shrink-0 text-white/20" />
                            <span className="truncate">{s.route.destination}</span>
                          </div>
                          <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${s.progress}%`, background: color }} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold"
                              style={{ background: `${color}20`, color }}>
                              {cfg?.label ?? s.status}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-white/30">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{eta}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
              {!loading && visible.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <Package className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="text-xs text-white/25">No shipments match your filters.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 z-[400] rounded-2xl px-3 py-3 shadow-xl"
        style={{ background: 'rgba(10,25,41,0.90)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2">Status</p>
        <div className="space-y-1.5">
          {Object.entries(STATUS_CFG).filter(([k]) => k !== 'DELIVERED').map(([, cfg]) => (
            <div key={cfg.label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
              <span className="text-[10px] text-white/55">{cfg.label}</span>
            </div>
          ))}
        </div>
        {showCorridors && (
          <div className="border-t border-white/8 mt-2 pt-2">
            {CORRIDORS.map(c => (
              <div key={c.name} className="flex items-center gap-2 mb-1">
                <div className="w-4 h-0.5 rounded" style={{ background: c.color }} />
                <span className="text-[10px] text-white/40">{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-[600]"
          style={{ background: 'rgba(10,25,41,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="text-center space-y-3 p-6 rounded-2xl border border-white/10"
            style={{ background: 'rgba(10,25,41,0.95)' }}>
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-white/70">{error}</p>
            <button onClick={() => void load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors">
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
