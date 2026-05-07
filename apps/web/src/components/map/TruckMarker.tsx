/**
 * TruckMarker.tsx — Enhanced truck SVG marker with direction arrow,
 * status-based glow, and pulse animation for delayed shipments.
 *
 * Used inside Leaflet's L.divIcon() to create custom markers.
 */

export interface TruckMarkerStyle {
  status: string
  risk: number
  bearing: number
  selected: boolean
  size?: number
}

const STATUS_CFG: Record<string, { color: string }> = {
  IN_TRANSIT: { color: '#3b82f6' },
  CUSTOMS:    { color: '#f59e0b' },
  DELAYED:    { color: '#ef4444' },
  PENDING:    { color: '#94a3b8' },
  DELIVERED:  { color: '#22c55e' },
}

export function buildTruckMarkerSVG({ status, risk, bearing, selected, size = 40 }: TruckMarkerStyle): string {
  const color = STATUS_CFG[status]?.color ?? '#94a3b8'
  const r = size / 2
  const isPulsing = status === 'DELAYED' || status === 'IN_TRANSIT'

  const pulseAnim = isPulsing
    ? `<circle cx="${r}" cy="${r}" r="${r - 3}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5">
         <animate attributeName="r" values="${r - 5};${r - 1};${r - 5}" dur="2.2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite"/>
       </circle>`
    : ''

  // Enhanced truck shape with direction arrow (points "up" before rotation)
  const truckBody = `
    <g transform="rotate(${bearing}, ${r}, ${r})">
      <!-- Direction arrow -->
      <polygon points="${r - 3},${r - 14} ${r},${r - 20} ${r + 3},${r - 14}" fill="${color}" opacity="0.85"/>
      <!-- Cabin -->
      <rect x="${r - 5}" y="${r - 11}" width="10" height="8" rx="1.5" fill="${color}" opacity="0.9"/>
      <!-- Trailer -->
      <rect x="${r - 7}" y="${r - 3}" width="14" height="10" rx="2" fill="${color}" opacity="0.85"/>
      <!-- Cabin window -->
      <rect x="${r - 3}" y="${r - 9}" width="6" height="3" rx="0.8" fill="white" opacity="0.5"/>
      <!-- Wheels -->
      <circle cx="${r - 5}" cy="${r + 7}" r="2" fill="#111" opacity="0.75"/>
      <circle cx="${r + 5}" cy="${r + 7}" r="2" fill="#111" opacity="0.75"/>
      <circle cx="${r - 5}" cy="${r - 4}" r="1.6" fill="#111" opacity="0.75"/>
      <circle cx="${r + 5}" cy="${r - 4}" r="1.6" fill="#111" opacity="0.75"/>
      <!-- Headlight -->
      <circle cx="${r}" cy="${r - 17}" r="1.5" fill="#fef3c7" opacity="0.9"/>
    </g>`

  const ring = selected
    ? `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="none" stroke="${color}" stroke-width="2.5">
         <animate attributeName="r" values="${r - 2};${r + 1};${r - 2}" dur="1.8s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.8s" repeatCount="indefinite"/>
       </circle>`
    : ''

  // Outer glow for high-risk shipments
  const riskGlow = risk >= 0.7
    ? `<circle cx="${r}" cy="${r}" r="${r + 2}" fill="none" stroke="#ef4444" stroke-width="1" opacity="0.3">
         <animate attributeName="r" values="${r + 2};${r + 6};${r + 2}" dur="1.5s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite"/>
       </circle>`
    : ''

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r}" fill="${color}" fill-opacity="${selected ? 0.2 : 0.12}"/>
    ${riskGlow}${pulseAnim}${ring}${truckBody}
  </svg>`
}
