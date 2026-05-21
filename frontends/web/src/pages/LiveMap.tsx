/**
 * LiveMap.tsx — Real-time shipment tracking with road-following routes.
 *
 * Features:
 *  - OSRM routing engine fetches actual road geometry (not straight lines)
 *  - Animated truck markers that slide smoothly along road waypoints
 *  - Real GPS positions from active drivers/trucks via fleet API
 *  - Progress-based route coloring (completed=solid, remaining=dashed)
 *  - Trade corridor overlays
 *  - Glassmorphism filter panel with live stats
 *  - Fullscreen mode, Fit-All, auto-refresh every 15s
 */
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, X, Layers, Package, AlertTriangle,
  Clock, CheckCircle2, Activity, Truck, Navigation,
  ArrowRight, Minimize2, Maximize2, MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fleetApi, type Driver } from '@/api/fleet'
import { shipmentsApi } from '@/api/shipments'
import type { ShipmentListItem } from '@/types'
import DriverInfoCard from '@/components/map/DriverInfoCard'
import RoadRoute from '@/components/map/RoadRoute'
import AnimatedTruck from '@/components/map/AnimatedTruck'
import ClusterMarker from '@/components/map/ClusterMarker'
import { preloadRoutes, type RouteGeometry } from '@/lib/routing'
import {
  lookupCoords, EAST_AFRICA_CENTER, MAP_DEFAULT_ZOOM,
  CORRIDORS, STATUS_COLORS,
} from '@/lib/coords'

// ── Fix Leaflet default icon ──────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Constants ─────────────────────────────────────────────────────────────────
const MAP_CENTER = EAST_AFRICA_CENTER
const MAP_ZOOM = MAP_DEFAULT_ZOOM
const FALLBACK: [number, number] = MAP_CENTER
const REFRESH_MS = 15_000

function bearingDeg(from: [number, number], to: [number, number]): number {
  const lat1 = (from[0] * Math.PI) / 180
  const lat2 = (to[0] * Math.PI) / 180
  const dLon = ((to[1] - from[1]) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  IN_TRANSIT: { color: STATUS_COLORS.IN_TRANSIT, label: 'In Transit',  icon: Activity      },
  CUSTOMS:    { color: STATUS_COLORS.CUSTOMS,    label: 'At Customs',  icon: Clock         },
  DELAYED:    { color: STATUS_COLORS.DELAYED,    label: 'Delayed',     icon: AlertTriangle },
  PENDING:    { color: STATUS_COLORS.PENDING,    label: 'Pending',     icon: Package       },
  DELIVERED:  { color: STATUS_COLORS.DELIVERED,  label: 'Delivered',   icon: CheckCircle2  },
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

function riskColor(score: number): string {
  if (score >= 0.7) return '#ef4444'
  if (score >= 0.4) return '#f59e0b'
  return '#22c55e'
}

// ── Enriched map entity ───────────────────────────────────────────────────────
interface MapEntity {
  id: number
  type: 'shipment'
  trackingNumber: string
  status: string
  carrierName: string
  origin: string
  destination: string
  originPos: [number, number] | null
  destPos: [number, number] | null
  gpsPos: [number, number]           // real GPS from driver/truck, or interpolated
  bearing: number
  progress: number                   // 0-100
  risk: number
  scheduledArrival: string
  route?: RouteGeometry | null
  shipment: ShipmentListItem
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
function FitAllButton({ entities }: { entities: MapEntity[] }) {
  const map = useMap()
  function fitAll() {
    if (entities.length === 0) return
    const lats = entities.map(s => s.gpsPos[0])
    const lngs = entities.map(s => s.gpsPos[1])
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

// ── Filter options ────────────────────────────────────────────────────────────
type FilterKey = 'ALL' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELAYED' | 'PENDING'
const FILTER_OPTS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All'        },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELAYED',    label: 'Delayed'    },
  { key: 'CUSTOMS',    label: 'Customs'    },
  { key: 'PENDING',    label: 'Pending'    },
]

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
  entities, visible, showCorridors, selectedId, panTo, onSelect, clusterZoom,
}: {
  entities: MapEntity[]
  visible: MapEntity[]
  showCorridors: boolean
  selectedId: number | null
  panTo: [number, number] | null
  onSelect: (e: MapEntity) => void
  clusterZoom: number
}) {
  const selected = entities.find(e => e.id === selectedId) ?? null

  return (
    <>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <PanToMarker target={panTo} />
      <FitAllButton entities={visible} />

      {/* Trade corridor overlays */}
      {showCorridors && CORRIDORS.map((c) => (
        <Polyline key={c.name} positions={c.coords}
          pathOptions={{ color: c.color, weight: 2, dashArray: '10 6', opacity: 0.4 }}>
          <Popup><div className="text-xs font-bold">{c.name}</div></Popup>
        </Polyline>
      ))}

      {/* Road-following routes */}
      {visible.filter(e => ['IN_TRANSIT', 'DELAYED'].includes(e.status) && e.originPos && e.destPos).map(e => (
        <RoadRoute
          key={`route-${e.id}`}
          origin={e.origin}
          destination={e.destination}
          risk={e.risk}
          progress={e.progress}
          selected={selectedId === e.id}
        />
      ))}

      {/* Risk hotspot halos */}
      {visible.filter(e => e.risk >= 0.7).map(e => (
        <Circle key={`risk-${e.id}`} center={e.gpsPos} radius={48000}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.06, weight: 1, opacity: 0.25 }}
        />
      ))}

      {/* Cluster markers for zoomed-out view */}
      <ClusterMarker shipments={visible as any} zoom={clusterZoom} />

      {/* Animated truck markers (hide when clustered) */}
      {clusterZoom >= 8 && visible.map(e => (
        <AnimatedTruck
          key={e.id}
          position={e.gpsPos}
          bearing={e.bearing}
          status={e.status}
          risk={e.risk}
          selected={selectedId === e.id}
          route={e.route}
          progress={e.progress}
          onClick={() => onSelect(e)}
        />
      ))}

      {/* Origin/Destination city labels for selected */}
      {selected && selected.originPos && selected.destPos && (
        <>
          <Polyline key={`orig-dot`} positions={[selected.originPos, selected.originPos]}
            pathOptions={{ color: '#22c55e', weight: 6, opacity: 0.9 }} />
          <Polyline key={`dest-dot`} positions={[selected.destPos, selected.destPos]}
            pathOptions={{ color: '#f5801e', weight: 6, opacity: 0.9 }} />
        </>
      )}
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveMap() {
  const [entities,       setEntities]       = useState<MapEntity[]>([])
  const [filter,         setFilter]         = useState<FilterKey>('ALL')
  const [search,         setSearch]         = useState('')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [panTo,          setPanTo]          = useState<[number, number] | null>(null)
  const [carrierFilter,  setCarrierFilter]  = useState<string>('ALL')
  const [fullscreen,     setFullscreen]     = useState(false)
  const [showCorridors,  setShowCorridors]  = useState(true)
  const [selectedId,     setSelectedId]     = useState<number | null>(null)
  const [panelOpen,      setPanelOpen]      = useState(true)
  const [clusterZoom] = useState(MAP_ZOOM)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch shipments + active drivers in parallel
      const [shipRes, driverRes] = await Promise.allSettled([
        shipmentsApi.getShipments({ page_size: 250, status: 'IN_TRANSIT,DELAYED,CUSTOMS,PENDING' }),
        fleetApi.listDrivers({ status: 'ON_ROUTE', page_size: 250 }),
      ])

      const allShipments: ShipmentListItem[] = shipRes.status === 'fulfilled'
        ? (shipRes.value.data.results ?? []).filter(s => s.status !== 'DELIVERED')
        : []
      const activeDrivers: Driver[] = driverRes.status === 'fulfilled'
        ? (driverRes.value.data.results ?? [])
        : []

      // Build GPS lookup: driver → position
      const gpsLookup = new Map<number, { lat: number; lng: number; label: string }>()
      for (const d of activeDrivers) {
        if (d.latitude && d.longitude) {
          gpsLookup.set(d.id, { lat: d.latitude, lng: d.longitude, label: d.current_location || '' })
        }
      }

      // Enrich shipments with real GPS or interpolated position
      const enriched: MapEntity[] = allShipments.map(s => {
        const originPos = lookupCoords(s.route.origin)
        const destPos   = lookupCoords(s.route.destination)

        // Try to get real GPS from assigned driver
        let gpsPos: [number, number]
        if (s.assigned_driver) {
          const agps = gpsLookup.get(s.assigned_driver)
          const truckLat = s.assigned_truck ? (s as any).truck_latitude : null
          const truckLng = s.assigned_truck ? (s as any).truck_longitude : null
          if (agps) {
            gpsPos = [agps.lat, agps.lng]
          } else if (truckLat && truckLng) {
            gpsPos = [truckLat, truckLng]
          } else {
            gpsPos = originPos && destPos
              ? [(originPos[0] + destPos[0]) / 2, (originPos[1] + destPos[1]) / 2]
              : (originPos ?? destPos ?? FALLBACK)
          }
        } else {
          gpsPos = originPos && destPos
            ? [(originPos[0] + destPos[0]) / 2, (originPos[1] + destPos[1]) / 2]
            : (originPos ?? destPos ?? FALLBACK)
        }

        // Progress: compute from GPS position between origin and destination
        let progress = 0
        if (s.status === 'PENDING') progress = 0
        else if (s.status === 'DELIVERED') progress = 100
        else if (originPos && destPos) {
          const totalDist = haversineKm(originPos, destPos)
          const coveredDist = haversineKm(originPos, gpsPos)
          progress = Math.min(Math.round((coveredDist / totalDist) * 100), 99)
          if (progress < 5 && s.status === 'IN_TRANSIT') progress = 15 // minimum for in-transit
        }

        const bearing = originPos && destPos ? bearingDeg(originPos, destPos) : 0

        return {
          id: s.id,
          type: 'shipment' as const,
          trackingNumber: s.tracking_number,
          status: s.status,
          carrierName: s.carrier_name,
          origin: s.route.origin,
          destination: s.route.destination,
          originPos,
          destPos,
          gpsPos,
          bearing,
          progress,
          risk: s.delay_risk_score,
          scheduledArrival: s.scheduled_arrival,
          shipment: s,
        }
      })

      setEntities(enriched)

      // Preload road routes in background
      const pairs = enriched
        .filter(e => e.originPos && e.destPos)
        .map(e => ({ from: e.originPos!, to: e.destPos! }))
      preloadRoutes(pairs)
    } catch {
      setError('Failed to load tracking data.')
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
    intervalRef.current = setInterval(load, REFRESH_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  // ── Derived data ────────────────────────────────────────────────────────────
  const carriers = ['ALL', ...Array.from(new Set(entities.map(s => s.carrierName))).sort()]

  const visible = useMemo(() => entities.filter(e => {
    if (filter !== 'ALL' && e.status !== filter) return false
    if (carrierFilter !== 'ALL' && e.carrierName !== carrierFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        e.trackingNumber.toLowerCase().includes(q) ||
        e.carrierName.toLowerCase().includes(q) ||
        e.origin.toLowerCase().includes(q) ||
        e.destination.toLowerCase().includes(q)
      )
    }
    return true
  }), [entities, filter, carrierFilter, search])

  const counts = useMemo(() => ({
    total:      entities.length,
    in_transit: entities.filter(e => e.status === 'IN_TRANSIT').length,
    delayed:    entities.filter(e => e.status === 'DELAYED').length,
    at_customs: entities.filter(e => e.status === 'CUSTOMS').length,
    high_risk:  entities.filter(e => e.risk >= 0.7).length,
  }), [entities])

  const selected = entities.find(e => e.id === selectedId) ?? null

  function handleSelect(e: MapEntity) {
    setSelectedId(e.id)
    setPanTo(e.gpsPos)
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
          entities={entities}
          visible={visible}
          showCorridors={showCorridors}
          selectedId={selectedId}
          panTo={panTo}
          onSelect={handleSelect}
          clusterZoom={clusterZoom}
        />
      </MapContainer>

      {/* ── DriverInfoCard ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[600]">
            <DriverInfoCard
              shipment={selected.shipment}
              onClose={() => setSelectedId(null)}
              onNavigate={() => setPanTo(selected.gpsPos)}
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

      {/* ── Toggle panel ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className="absolute top-3 left-3 z-[500] p-2 rounded-xl bg-[#0a1929]/90 border border-white/10 text-white/60 hover:text-white shadow-lg backdrop-blur-md transition-colors"
        title={panelOpen ? 'Hide panel' : 'Show panel'}>
        {panelOpen ? <X className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
      </button>

      {/* ── High-risk badge ────────────────────────────────────────────────── */}
      {counts.high_risk > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="absolute z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-600/90 backdrop-blur-sm border border-red-500/40 shadow-lg top-3 left-14">
          <AlertTriangle className="w-3.5 h-3.5 text-white" />
          <span className="text-xs font-bold text-white">{counts.high_risk} high-risk</span>
        </motion.div>
      )}

      {/* ── Floating left panel ────────────────────────────────────────────── */}
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
                  <button key={label}
                    onClick={() => setFilter(label === 'Transit' ? 'IN_TRANSIT' : label === 'Delayed' ? 'DELAYED' : 'CUSTOMS')}
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
                  placeholder="Tracking #, carrier, city..."
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
                  <select value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}
                    className="w-full pl-3 pr-3 py-1.5 rounded-xl bg-white/6 border border-white/8 text-[11px] text-white/70 focus:outline-none focus:ring-1 focus:ring-orange-500/40">
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
                {visible.map((e, i) => {
                  const cfg   = STATUS_CFG[e.status]
                  const color = cfg?.color ?? '#94a3b8'
                  const rc    = riskColor(e.risk)
                  const isSel = selectedId === e.id
                  const eta   = fmtETA(e.scheduledArrival)
                  return (
                    <motion.button key={e.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }} layout
                      onClick={() => handleSelect(e)}
                      className={cn('w-full px-4 py-3 text-left transition-all border-b border-white/4',
                        isSel ? 'bg-white/10 border-l-2' : 'hover:bg-white/5')}
                      style={isSel ? { borderLeftColor: color } : {}}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}20` }}>
                          <Truck className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-white/90 font-mono truncate">{e.trackingNumber}</p>
                            <span className="text-[10px] font-bold tabular-nums ml-2 shrink-0" style={{ color: rc }}>
                              {Math.round(e.risk * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-white/40">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{e.origin}</span>
                            <ArrowRight className="w-2.5 h-2.5 shrink-0 text-white/20" />
                            <span className="truncate">{e.destination}</span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${e.progress}%`, background: color }} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold"
                              style={{ background: `${color}20`, color }}>
                              {cfg?.label ?? e.status}
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

// ── Haversine helper ─────────────────────────────────────────────────────────
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const [lat1, lng1] = [a[0] * Math.PI / 180, a[1] * Math.PI / 180]
  const [lat2, lng2] = [b[0] * Math.PI / 180, b[1] * Math.PI / 180]
  const dlat = lat2 - lat1
  const dlng = lng2 - lng1
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
