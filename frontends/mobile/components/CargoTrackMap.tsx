import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { shipmentsApi } from '@/lib/api'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'
import { AnimatedTruckMarker, getCorridorFeatures, Legend } from '@/components/map'
import { fetchRoutes } from '@/lib/routing'

const MAPLIBRE_SUPPORTED = Constants.appOwnership !== 'expo'
const MapLibreGL = MAPLIBRE_SUPPORTED
  ? (require('@maplibre/maplibre-react-native').default as any)
  : null

const DARK_MAP_STYLE = JSON.stringify(require('@/assets/cargotrack-map-style-dark.json'))

const REFRESH_INTERVAL = 60_000
const DEFAULT_CENTER: [number, number] = [35.0, -1.5]

// ── East Africa city coordinate lookup ──────────────────────────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  'Mombasa':       [39.6682, -4.0435],
  'Nairobi':       [36.8219, -1.2921],
  'Kampala':       [32.5825,  0.3476],
  'Kigali':        [30.0619, -1.9441],
  'Dar es Salaam': [39.2083, -6.7924],
  'Kisumu':        [34.7617, -0.1022],
  'Eldoret':       [35.2698,  0.5143],
  'Bujumbura':     [29.3644, -3.3731],
  'Juba':          [31.5713,  4.8594],
  'Dodoma':        [35.7395, -6.1731],
  'Arusha':        [36.6928, -3.3667],
  'Mwanza':        [32.9000, -2.5167],
  'Goma':          [29.2371, -1.6741],
}

function lookupLngLat(city: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

// ── Progress estimation ─────────────────────────────────────────────────────────

function estimateProgress(
  scheduledDeparture: string | undefined,
  scheduledArrival: string | undefined,
): number {
  if (!scheduledDeparture || !scheduledArrival) return 0.5
  const dep = new Date(scheduledDeparture).getTime()
  const arr = new Date(scheduledArrival).getTime()
  const now = Date.now()
  if (now <= dep) return 0
  if (now >= arr) return 1
  return (now - dep) / (arr - dep)
}

function interpolateAlong(coords: Array<[number, number]>, t: number): [number, number] {
  if (coords.length < 2) return coords[0] ?? [0, 0]
  // Total route length
  const distances: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0]
    const dy = coords[i][1] - coords[i - 1][1]
    distances.push(distances[i - 1] + Math.sqrt(dx * dx + dy * dy))
  }
  const total = distances[distances.length - 1]
  const target = total * t

  for (let i = 1; i < coords.length; i++) {
    if (distances[i] >= target) {
      const segLen = distances[i] - distances[i - 1]
      const segT = segLen > 0 ? (target - distances[i - 1]) / segLen : 0
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * segT,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * segT,
      ]
    }
  }
  return coords[coords.length - 1]
}

function asTupleArray(coords: number[][]): Array<[number, number]> {
  return coords.filter((c): c is [number, number] => c.length >= 2)
}

// ── Depot marker ───────────────────────────────────────────────────────────────

function DepotMarker({ type }: { type: 'origin' | 'dest' }) {
  const color = type === 'origin' ? '#60a5fa' : '#4ade80'
  return (
    <View style={styles.depotOuter}>
      <View style={[styles.depotInner, { backgroundColor: color }]}>
        <Ionicons name={type === 'origin' ? 'radio-button-on' : 'flag'} size={10} color="#fff" />
      </View>
    </View>
  )
}

// ── Context ────────────────────────────────────────────────────────────────────

export interface MappedShipment extends ShipmentListItem {
  lngLat:        [number, number]
  originLL:      [number, number] | null
  destLL:        [number, number] | null
  routeCoords:   [number, number][] | null
  progress:      number
}

interface MapContextValue {
  shipments: MappedShipment[]
  selectedShipment: MappedShipment | null
  selectShipment: (id: number) => void
  clearSelection: () => void
  flyTo: (coords: [number, number], zoom?: number) => void
  loading: boolean
  error: string | null
  refresh: () => void
}

const MapCtx = createContext<MapContextValue>({
  shipments: [],
  selectedShipment: null,
  selectShipment: () => {},
  clearSelection: () => {},
  flyTo: () => {},
  loading: true,
  error: null,
  refresh: () => {},
})

export function useMapContext() {
  return useContext(MapCtx)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CargoTrackMap() {
  const cameraRef = useRef<any>(null)
  const [shipments, setShipments] = useState<MappedShipment[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const routesRequestedRef = useRef(false)

  const selectedShipment = shipments.find((s) => s.id === selectedId) ?? null

  const load = useCallback(async () => {
    setError(null)
    try {
      const [tRes, cRes, dRes] = await Promise.all([
        shipmentsApi.list({ status: 'IN_TRANSIT', page_size: 50 }),
        shipmentsApi.list({ status: 'CUSTOMS',    page_size: 50 }),
        shipmentsApi.list({ status: 'DELAYED',    page_size: 50 }),
      ])
      const all: ShipmentListItem[] = [
        ...(Array.isArray(tRes.data) ? tRes.data : (tRes.data as any).results ?? []),
        ...(Array.isArray(cRes.data) ? cRes.data : (cRes.data as any).results ?? []),
        ...(Array.isArray(dRes.data) ? dRes.data : (dRes.data as any).results ?? []),
      ]
      const enriched: MappedShipment[] = all.map((s) => {
        const originLL = lookupLngLat(s.route?.origin ?? '')
        const destLL   = lookupLngLat(s.route?.destination ?? '')
        const progress = estimateProgress(s.scheduled_departure, s.scheduled_arrival)
        // Initial position: fallback to midpoint if no route yet
        const lngLat = originLL && destLL
          ? interpolateAlong([originLL, destLL], progress)
          : originLL ?? [36.8219, -1.2921] as [number, number]
        return { ...s, lngLat, originLL, destLL, routeCoords: null, progress }
      })
      setShipments(enriched)
      routesRequestedRef.current = false
    } catch {
      setError('Failed to load shipments')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch OSRM road-following routes after shipments load ───────────────────
  const shipmentsLoaded = shipments.length > 0
  useEffect(() => {
    if (routesRequestedRef.current || !shipmentsLoaded) return
    routesRequestedRef.current = true

    const pairs = shipments
      .filter((s) => s.originLL && s.destLL)
      .map((s) => ({
        id: String(s.id),
        from: s.originLL!,
        to: s.destLL!,
      }))

    if (pairs.length === 0) return

    fetchRoutes(pairs).then((fc) => {
      const coordMap = new Map<string, Array<[number, number]>>()
      for (const f of fc.features) {
        if (f.geometry?.type === 'LineString') {
          const geom = f.geometry as GeoJSON.LineString
          coordMap.set(String(f.properties?.id), asTupleArray(geom.coordinates))
        }
      }

      setShipments((prev) =>
        prev.map((s) => {
          const coords = coordMap.get(String(s.id)) ?? null
          const lngLat = coords
            ? interpolateAlong(coords, s.progress)
            : s.lngLat
          return { ...s, routeCoords: coords, lngLat }
        }),
      )
    })
  }, [shipmentsLoaded])

  // ── Periodic refresh ────────────────────────────────────────────────────────
  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  function selectShipment(id: number) {
    setSelectedId(id)
    const s = shipments.find((x) => x.id === id)
    if (s && cameraRef.current) {
      cameraRef.current.flyTo(s.lngLat, 600)
      cameraRef.current.zoomTo(9)
    }
  }

  function clearSelection() { setSelectedId(null) }

  function flyTo(coords: [number, number], zoom = 9) {
    if (cameraRef.current) {
      cameraRef.current.flyTo(coords, 600)
      cameraRef.current.zoomTo(zoom)
    }
  }

  function refresh() { setLoading(true); load() }

  const ctx: MapContextValue = {
    shipments, selectedShipment, selectShipment, clearSelection, flyTo, loading, error, refresh,
  }

  // ── GeoJSON layers ──────────────────────────────────────────────────────────

  const clusterGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: shipments.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: s.lngLat },
      properties: { id: s.id, status: s.status, risk: s.delay_risk_score ?? 0 },
    })),
  }

  // Road-following routes (OSRM) + fallback straight lines
  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: shipments
      .filter((s) => s.originLL && s.destLL)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: s.routeCoords
          ? { type: 'LineString' as const, coordinates: s.routeCoords }
          : { type: 'LineString' as const, coordinates: [s.originLL!, s.destLL!] },
        properties: { id: s.id, hasRoute: !!s.routeCoords },
      })),
  }

  const corridorFeatures = getCorridorFeatures()

  const highRiskGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: shipments
      .filter((s) => (s.delay_risk_score ?? 0) >= 0.7)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: s.lngLat },
        properties: { id: s.id, risk: s.delay_risk_score ?? 0 },
      })),
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const canRenderMap = MAPLIBRE_SUPPORTED && MapLibreGL != null

  return (
    <MapCtx.Provider value={ctx}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {!canRenderMap ? (
          <View style={styles.fallback}>
            <Ionicons name="map-outline" size={36} color="#64748b" />
            <Text style={styles.fallbackTitle}>Live map needs a dev build</Text>
            <Text style={styles.fallbackSub}>
              Expo Go does not include MapLibre. Use `npx expo run:android` to see the live corridor map.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.fallback}>
            <Ionicons name="cloud-offline-outline" size={36} color="#94a3b8" />
            <Text style={styles.fallbackTitle}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={styles.retryBtn} activeOpacity={0.7}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <MapLibreGL.MapView
            style={StyleSheet.absoluteFill}
            mapStyle={DARK_MAP_STYLE}
            compassEnabled
            logoEnabled={false}
            attributionEnabled={false}
          >
            <MapLibreGL.Camera
              ref={cameraRef}
              zoomLevel={5}
              centerCoordinate={DEFAULT_CENTER}
              animationDuration={0}
            />

            {/* ── Trade corridor overlays ──────────────────────────────── */}
            <MapLibreGL.ShapeSource id="corridors" shape={corridorFeatures}>
              <MapLibreGL.LineLayer
                id="corridor-northern"
                filter={['==', ['get', 'id'], 'northern']}
                style={{
                  lineColor: '#2563EB',
                  lineWidth: 2.5,
                  lineOpacity: 0.35,
                  lineBlur: 3,
                }}
              />
              <MapLibreGL.LineLayer
                id="corridor-central"
                filter={['==', ['get', 'id'], 'central']}
                style={{
                  lineColor: '#F59E0B',
                  lineWidth: 2.5,
                  lineOpacity: 0.35,
                  lineBlur: 3,
                }}
              />
              <MapLibreGL.LineLayer
                id="corridor-lapsset"
                filter={['==', ['get', 'id'], 'lapsset']}
                style={{
                  lineColor: '#16A34A',
                  lineWidth: 2.5,
                  lineOpacity: 0.35,
                  lineBlur: 3,
                }}
              />
            </MapLibreGL.ShapeSource>

            {/* ── OSRM road-following routes ───────────────────────────── */}
            <MapLibreGL.ShapeSource id="routes" shape={routeGeoJSON}>
              {/* Route glow (wider, blurred) */}
              <MapLibreGL.LineLayer
                id="route-glow"
                style={{
                  lineColor: '#3b82f6',
                  lineWidth: 4,
                  lineOpacity: 0.25,
                  lineBlur: 4,
                }}
              />
              {/* Route center line */}
              <MapLibreGL.LineLayer
                id="route-lines"
                filter={['==', ['get', 'hasRoute'], true]}
                style={{
                  lineColor: '#60a5fa',
                  lineWidth: 2.5,
                  lineOpacity: 0.7,
                  lineDasharray: [6, 3],
                }}
              />
              {/* Fallback lines (before OSRM responds) */}
              <MapLibreGL.LineLayer
                id="route-fallback"
                filter={['!=', ['get', 'hasRoute'], true]}
                style={{
                  lineColor: '#475569',
                  lineWidth: 1.5,
                  lineOpacity: 0.35,
                  lineDasharray: [4, 6],
                }}
              />
            </MapLibreGL.ShapeSource>

            {/* ── High-risk halos ──────────────────────────────────────── */}
            <MapLibreGL.ShapeSource id="high-risk" shape={highRiskGeoJSON}>
              <MapLibreGL.CircleLayer
                id="risk-halos"
                style={{
                  circleRadius: 16,
                  circleColor: '#EF4444',
                  circleOpacity: 0.18,
                  circleBlur: 4,
                  circleStrokeWidth: 1.5,
                  circleStrokeColor: '#EF4444',
                  circleStrokeOpacity: 0.3,
                }}
              />
            </MapLibreGL.ShapeSource>

            {/* ── Clustered shipment dots ──────────────────────────────── */}
            <MapLibreGL.ShapeSource
              id="shipments"
              shape={clusterGeoJSON}
              cluster
              clusterRadius={48}
              clusterMaxZoomLevel={11}
              onPress={(e: { features: Array<{ properties?: { id?: number; point_count?: number } }> }) => {
                const props = e.features[0]?.properties
                if (!props || props.point_count) return
                if (props.id) selectShipment(props.id)
              }}
            >
              <MapLibreGL.CircleLayer
                id="clusters"
                filter={['has', 'point_count']}
                style={{
                  circleRadius: ['interpolate', ['linear'], ['get', 'point_count'], 1, 18, 20, 28],
                  circleColor: '#0a1929',
                  circleOpacity: 0.92,
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#f5801e',
                }}
              />
              <MapLibreGL.CircleLayer
                id="unclustered"
                filter={['!', ['has', 'point_count']]}
                style={{
                  circleRadius: 8,
                  circleColor: [
                    'match', ['get', 'status'],
                    'IN_TRANSIT', '#2563EB',
                    'CUSTOMS',    '#F59E0B',
                    'DELAYED',    '#EF4444',
                    '#94a3b8',
                  ],
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#e2e8f0',
                  circleOpacity: 0.9,
                }}
              />
            </MapLibreGL.ShapeSource>

            {/* ── Selected shipment annotations ────────────────────────── */}
            {selectedShipment && (
              <>
                <MapLibreGL.PointAnnotation
                  id="selected-truck"
                  coordinate={selectedShipment.lngLat}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/shipment/${selectedShipment.id}` as any)}
                  >
                    <AnimatedTruckMarker
                      status={selectedShipment.status as ShipmentStatus}
                      riskScore={selectedShipment.delay_risk_score ?? 0}
                    />
                  </TouchableOpacity>
                </MapLibreGL.PointAnnotation>

                {selectedShipment.originLL && (
                  <MapLibreGL.PointAnnotation id="sel-origin" coordinate={selectedShipment.originLL}>
                    <DepotMarker type="origin" />
                  </MapLibreGL.PointAnnotation>
                )}
                {selectedShipment.destLL && (
                  <MapLibreGL.PointAnnotation id="sel-dest" coordinate={selectedShipment.destLL}>
                    <DepotMarker type="dest" />
                  </MapLibreGL.PointAnnotation>
                )}
              </>
            )}

            {/* ── Origin/destination dots for all active shipments ──────── */}
            <MapLibreGL.ShapeSource
              id="depots"
              shape={{
                type: 'FeatureCollection',
                features: shipments
                  .filter((s) => s.originLL)
                  .map((s) => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: s.originLL! },
                    properties: { type: 'origin' },
                  })),
              }}
            >
              <MapLibreGL.CircleLayer
                id="depot-dots"
                style={{
                  circleRadius: 4,
                  circleColor: '#60a5fa',
                  circleOpacity: 0.6,
                  circleStrokeWidth: 1,
                  circleStrokeColor: '#e2e8f0',
                }}
              />
            </MapLibreGL.ShapeSource>
          </MapLibreGL.MapView>
        )}

        {loading && canRenderMap ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#f5801e" />
          </View>
        ) : null}

        {canRenderMap && !error ? <Legend /> : null}
      </View>
    </MapCtx.Provider>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#0a1929',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fallbackTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  fallbackSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f5801e',
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  loadingOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,25,41,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#0a1929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
