/**
 * shared/utils/statusColors.ts
 *
 * Platform-agnostic color mappings for shipment statuses and alert severities.
 * Values are hex strings — consumed directly by React Native (StyleSheet.create)
 * and by the web app (inline style or Tailwind class look-up).
 */
import type { ShipmentStatus, AlertSeverity } from '../api/types'

export interface StatusColors {
  background: string
  text: string
  border: string
  dot: string
}

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, StatusColors> = {
  PENDING: {
    background: '#F3F4F6',
    text:       '#4B5563',
    border:     '#D1D5DB',
    dot:        '#9CA3AF',
  },
  IN_TRANSIT: {
    background: '#EFF6FF',
    text:       '#1D4ED8',
    border:     '#BFDBFE',
    dot:        '#60A5FA',
  },
  CUSTOMS: {
    background: '#F5F3FF',
    text:       '#6D28D9',
    border:     '#DDD6FE',
    dot:        '#A78BFA',
  },
  DELIVERED: {
    background: '#ECFDF5',
    text:       '#065F46',
    border:     '#A7F3D0',
    dot:        '#34D399',
  },
  DELAYED: {
    background: '#FEF2F2',
    text:       '#991B1B',
    border:     '#FECACA',
    dot:        '#F87171',
  },
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING:    'Pending',
  IN_TRANSIT: 'In Transit',
  CUSTOMS:    'At Customs',
  DELIVERED:  'Delivered',
  DELAYED:    'Delayed',
}

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, StatusColors> = {
  LOW: {
    background: '#F0FDF4',
    text:       '#166534',
    border:     '#BBF7D0',
    dot:        '#4ADE80',
  },
  MEDIUM: {
    background: '#FFFBEB',
    text:       '#92400E',
    border:     '#FDE68A',
    dot:        '#FCD34D',
  },
  HIGH: {
    background: '#FFF7ED',
    text:       '#9A3412',
    border:     '#FED7AA',
    dot:        '#FB923C',
  },
  CRITICAL: {
    background: '#FEF2F2',
    text:       '#991B1B',
    border:     '#FECACA',
    dot:        '#EF4444',
  },
}

/** Returns a Tailwind CSS class string for web (no RN dependency). */
export function statusTailwind(status: ShipmentStatus): string {
  const map: Record<ShipmentStatus, string> = {
    PENDING:    'bg-gray-100 text-gray-600',
    IN_TRANSIT: 'bg-blue-50 text-blue-700',
    CUSTOMS:    'bg-purple-50 text-purple-700',
    DELIVERED:  'bg-emerald-50 text-emerald-700',
    DELAYED:    'bg-red-50 text-red-700',
  }
  return map[status] ?? map.PENDING
}

/** Risk score (0-1) → { color, label } */
export function riskLevel(score: number): { color: string; label: string } {
  if (score >= 0.7) return { color: '#DC2626', label: 'High'   }
  if (score >= 0.4) return { color: '#D97706', label: 'Medium' }
  return               { color: '#059669', label: 'Low'    }
}
