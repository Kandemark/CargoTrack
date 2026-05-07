// ── East African trade corridor GeoJSON ───────────────────────────────────────

export interface CorridorDef {
  id: string
  label: string
  color: string
  geometry: GeoJSON.LineString
}

const CORRIDORS: CorridorDef[] = [
  {
    id: 'northern',
    label: 'Northern Corridor',
    color: '#2563EB',
    geometry: {
      type: 'LineString',
      coordinates: [
        [39.6682, -4.0435],   // Mombasa
        [37.9083, -3.3762],   // Voi
        [36.8219, -1.2921],   // Nairobi
        [35.2698,  0.5143],   // Eldoret
        [34.5577,  0.5690],   // Malaba border
        [32.5825,  0.3476],   // Kampala
        [30.0619, -1.9441],   // Kigali
        [29.3644, -3.3731],   // Bujumbura
      ],
    },
  },
  {
    id: 'central',
    label: 'Central Corridor',
    color: '#F59E0B',
    geometry: {
      type: 'LineString',
      coordinates: [
        [39.2083, -6.7924],   // Dar es Salaam
        [35.7395, -6.1731],   // Dodoma
        [33.8134, -2.5096],   // Singida
        [33.4422, -1.5227],   // Nzega
        [31.6953, -1.3350],   // Bukoba / Rusumo
        [30.0619, -1.9441],   // Kigali
        [29.3644, -3.3731],   // Bujumbura
      ],
    },
  },
  {
    id: 'lapsset',
    label: 'LAPSSET Corridor',
    color: '#16A34A',
    geometry: {
      type: 'LineString',
      coordinates: [
        [40.9087, -2.2692],   // Lamu
        [40.4714, -0.4847],   // Garissa
        [37.5833,  0.3542],   // Isiolo
        [35.2698,  0.5143],   // Eldoret (junction)
        [34.5577,  3.6275],   // Lokichogio
        [31.5713,  4.8594],   // Juba
      ],
    },
  },
]

export function getCorridorFeatures(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: CORRIDORS.map((c) => ({
      type: 'Feature' as const,
      id: c.id,
      geometry: c.geometry,
      properties: { id: c.id, label: c.label, color: c.color },
    })),
  }
}

export function getCorridorLegend(): { id: string; label: string; color: string }[] {
  return CORRIDORS.map(({ id, label, color }) => ({ id, label, color }))
}
